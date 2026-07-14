import { randomInt } from "node:crypto";
import {
  Cargo,
  MetodoPagamento,
  StatusGaragem,
  StatusPagamento,
  StatusReserva,
  StatusVeiculo,
} from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import {
  CreateReservaRequest,
  ListReservasRequest,
  ReservaFilters,
  ReservaResponse,
  UpdateReservaRequest,
} from "../repositories/contracts/reserva.contract.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import { IDeficienciaRepository } from "../repositories/deficiencia.repository.js";
import { IServicoOpcionalRepository } from "../repositories/servico-opcional.repository.js";
import { ICondutorRepository } from "../repositories/condutor.repository.js";
import {
  CondutorResponse,
  CreateCondutorRequest,
} from "../repositories/contracts/condutor.contract.js";
import { ReservaServicoInput } from "../repositories/contracts/reserva.contract.js";
import { BloqueioService } from "./bloqueio.js";
import { IReservaNotifier } from "./notificacao-reserva.js";
import { LocatarioResponse } from "../repositories/contracts/locatario.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

interface ReservaAccessContext {
  id: string;
  cargo: Cargo;
}

// Alfabeto sem caracteres ambíguos (sem O, 0, I, 1, L).
const CODIGO_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODIGO_BLOCO = 4; // XXXX-XXXX
const CODIGO_MAX_TENTATIVAS = 5; // tentativas para evitar colisão de unique
// Janela de validade do código a partir da data de início (2 dias).
const CODIGO_VALIDADE_MS = 2 * 24 * 60 * 60 * 1000;

// RN05: duração da reserva. Mínimo de 1 hora, máximo de 30 dias consecutivos.
const DURACAO_MINIMA_MS = 60 * 60 * 1000;
const DURACAO_MAXIMA_MS = 30 * 24 * 60 * 60 * 1000;

// RN02: máximo de condutores adicionais por reserva.
const MAX_CONDUTORES_ADICIONAIS = 3;

export class ReservaService {
  constructor(
    private readonly reservaRepository: IReservaRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly locatarioRepository: ILocatarioRepository,
    private readonly garagemRepository: IGaragemRepository,
    private readonly deficienciaRepository: IDeficienciaRepository,
    private readonly bloqueioService: BloqueioService,
    private readonly servicoOpcionalRepository: IServicoOpcionalRepository,
    private readonly condutorRepository: ICondutorRepository,
    // Notificação (relatório por e-mail). Opcional para não acoplar a regra de
    // negócio ao envio; quando ausente, a reserva funciona normalmente.
    private readonly reservaNotifier?: IReservaNotifier,
  ) {}

  // Valida os serviços opcionais selecionados contra o catálogo e resolve o
  // valor de cada um (snapshot). Todos os IDs informados devem existir e estar
  // ativos; caso contrário a reserva não é criada. Centraliza aqui a regra para
  // evitar cálculos espalhados pela aplicação.
  private async resolverServicosOpcionais(
    servicosIds?: string[],
  ): Promise<{ servicos: ReservaServicoInput[]; valorServicos: number }> {
    if (!servicosIds || servicosIds.length === 0) {
      return { servicos: [], valorServicos: 0 };
    }

    // Remove duplicatas para não cobrar o mesmo serviço duas vezes.
    const idsUnicos = [...new Set(servicosIds)];

    const encontrados =
      await this.servicoOpcionalRepository.findByIds(idsUnicos);

    // findByIds só retorna serviços ativos; divergência = id inexistente ou inativo.
    if (encontrados.length !== idsUnicos.length) {
      throw new HttpError(
        400,
        "Um ou mais serviços opcionais informados são inválidos ou indisponíveis.",
      );
    }

    const servicos = encontrados.map((s) => ({
      idServico: s.id,
      valor: s.valor,
    }));
    const valorServicos = encontrados.reduce((acc, s) => acc + s.valor, 0);

    return { servicos, valorServicos };
  }

  // Gera uma string no formato XXXX-XXXX usando o alfabeto sem ambíguos.
  private gerarCodigoAleatorio(): string {
    const bloco = () =>
      Array.from(
        { length: CODIGO_BLOCO },
        () => CODIGO_ALPHABET[randomInt(CODIGO_ALPHABET.length)],
      ).join("");
    return `${bloco()}-${bloco()}`;
  }

  // Gera um código único (consulta o repositório para evitar colisões).
  private async gerarCodigoUnico(): Promise<string> {
    for (let i = 0; i < CODIGO_MAX_TENTATIVAS; i++) {
      const codigo = this.gerarCodigoAleatorio();
      const existente =
        await this.reservaRepository.findByCodigoDesbloqueio(codigo);
      if (!existente) {
        return codigo;
      }
    }
    throw new HttpError(
      500,
      "Não foi possível gerar um código de desbloqueio único.",
    );
  }

  // Instante em que o código expira: min(dataHoraInicio + 2 dias, dataHoraFim).
  private calcularExpiracaoCodigo(reserva: ReservaResponse): Date {
    const limitePorValidade = new Date(
      reserva.dataHoraInicio.getTime() + CODIGO_VALIDADE_MS,
    );
    return limitePorValidade < reserva.dataHoraFim
      ? limitePorValidade
      : reserva.dataHoraFim;
  }

  // Valida se o código pode ser usado neste exato momento.
  private assertCodigoUsavel(reserva: ReservaResponse): void {
    if (!reserva.codigoDesbloqueio || !reserva.codigoGeradoEm) {
      throw new HttpError(
        409,
        "Código de desbloqueio ainda não gerado. Confirme o pagamento primeiro.",
      );
    }

    if (reserva.status === StatusReserva.CANCELADA) {
      throw new HttpError(409, "Reserva cancelada.");
    }

    if (reserva.codigoUsadoEm) {
      throw new HttpError(409, "Código de desbloqueio já utilizado.");
    }

    const agora = new Date();

    if (agora < reserva.dataHoraInicio) {
      throw new HttpError(
        409,
        "O código só pode ser usado a partir da data de início da reserva.",
      );
    }

    if (agora > this.calcularExpiracaoCodigo(reserva)) {
      throw new HttpError(409, "Código de desbloqueio expirado.");
    }
  }

  // Garante que o solicitante pode ver/alterar a reserva:
  // ADMIN sempre; LOCATARIO se for o dono; LOCADOR se o veículo for dele.
  private async assertReservaAccess(
    requester: ReservaAccessContext,
    reserva: ReservaResponse,
  ): Promise<void> {
    if (requester.cargo === Cargo.ADMIN) {
      return;
    }

    if (requester.cargo === Cargo.LOCATARIO) {
      if (requester.id === reserva.idLocatario) {
        return;
      }
      throw new HttpError(403, "Acesso negado");
    }

    if (requester.cargo === Cargo.LOCADOR) {
      const veiculo = await this.veiculoRepository.findById(reserva.idVeiculo);
      if (veiculo && veiculo.idLocador === requester.id) {
        return;
      }
      throw new HttpError(403, "Acesso negado");
    }

    throw new HttpError(403, "Acesso negado");
  }

  // Valida regras de período + disponibilidade do veículo.
  private async assertPeriodoValido(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<void> {
    if (dataHoraFim <= dataHoraInicio) {
      throw new HttpError(
        400,
        "A data/hora de término deve ser posterior à de início.",
      );
    }

    // RN05: duração entre 1 hora e 30 dias (bordas exatas válidas).
    const duracao = dataHoraFim.getTime() - dataHoraInicio.getTime();
    if (duracao < DURACAO_MINIMA_MS) {
      throw new HttpError(400, "A reserva deve ter no mínimo 1 hora.");
    }
    if (duracao > DURACAO_MAXIMA_MS) {
      throw new HttpError(400, "A reserva não pode exceder 30 dias.");
    }

    if (dataHoraInicio < new Date()) {
      throw new HttpError(
        400,
        "A data/hora de início não pode estar no passado.",
      );
    }

    const overlap = await this.reservaRepository.hasOverlapForVeiculo(
      idVeiculo,
      dataHoraInicio,
      dataHoraFim,
      excludeReservaId,
    );
    if (overlap) {
      throw new HttpError(
        409,
        "O veículo já possui uma reserva nesse período.",
      );
    }
  }

  // O local de retirada é a garagem onde o veículo está atualmente alocado.
  // Se o solicitante informar um local de retirada, ele deve coincidir.
  private resolverGaragemRetirada(
    garagemAtualVeiculo: string | null,
    idGaragemRetiradaInformada?: string,
  ): string | undefined {
    if (
      idGaragemRetiradaInformada !== undefined &&
      idGaragemRetiradaInformada !== garagemAtualVeiculo
    ) {
      throw new HttpError(
        400,
        "O local de retirada deve corresponder à garagem onde o veículo está atualmente alocado.",
      );
    }
    return garagemAtualVeiculo ?? undefined;
  }

  // Veículo adaptado (PCD) só pode ser reservado por locatário com deficiência.
  // Se o locatário ainda não possuir uma, aceita a deficiência informada no
  // fluxo da reserva, valida-a e a associa ao cadastro.
  private async assertLocatarioElegivelParaVeiculoAdaptado(
    locatario: LocatarioResponse,
    deficienciaIdInformada?: string,
  ): Promise<void> {
    // Já possui deficiência cadastrada -> elegível.
    if (locatario.deficienciaId) {
      return;
    }

    // Sem cadastro e sem deficiência informada -> bloqueia a reserva.
    if (!deficienciaIdInformada) {
      throw new HttpError(
        403,
        "Veículo adaptado: o locatário deve possuir uma necessidade especial cadastrada.",
      );
    }

    const deficiencia =
      await this.deficienciaRepository.findById(deficienciaIdInformada);
    if (!deficiencia) {
      throw new HttpError(404, "Deficiência não encontrada.");
    }

    // Associa a deficiência informada ao locatário (reutiliza o update existente).
    await this.locatarioRepository.update(locatario.id, {
      deficiencia_id: deficienciaIdInformada,
    });
  }

  // Garagem inativa/em manutenção não entra em novas reservas (RF19).
  private assertGaragemAtiva(status: StatusGaragem, contexto: string): void {
    if (status !== StatusGaragem.ATIVA) {
      throw new HttpError(
        409,
        `O local de ${contexto} não está disponível (garagem inativa ou em manutenção).`,
      );
    }
  }

  // O local de devolução deve pertencer ao locador dono do veículo e estar ATIVA.
  private async assertGaragemDevolucao(
    idGaragemDevolucao: string,
    idLocadorVeiculo: string,
  ): Promise<void> {
    const garagem = await this.garagemRepository.findById(idGaragemDevolucao);
    if (!garagem) {
      throw new HttpError(404, "Garagem de devolução não encontrada.");
    }
    if (garagem.idLocador !== idLocadorVeiculo) {
      throw new HttpError(
        400,
        "O local de devolução deve pertencer ao locador dono do veículo.",
      );
    }
    this.assertGaragemAtiva(garagem.status, "devolução");
  }

  // Garagem atual do veículo (local de retirada) deve estar ATIVA para reservar.
  private async assertGaragemRetiradaAtiva(idGaragem: string): Promise<void> {
    const garagem = await this.garagemRepository.findById(idGaragem);
    if (!garagem) {
      throw new HttpError(404, "Garagem de retirada não encontrada.");
    }
    this.assertGaragemAtiva(garagem.status, "retirada");
  }

  list = async (
    data: ListReservasRequest,
  ): Promise<PaginatedResult<ReservaResponse>> => {
    switch (data.cargo) {
      case Cargo.ADMIN:
        return data.filters
          ? await this.reservaRepository.search(data.filters, data.pagination)
          : await this.reservaRepository.findAll(data.pagination);

      case Cargo.LOCATARIO:
        return await this.reservaRepository.search(
          {
            ...(data.filters ?? {}),
            idLocatario: data.id, // garante que só vê as próprias
          },
          data.pagination,
        );

      case Cargo.LOCADOR:
        return await this.reservaRepository.search(
          {
            ...(data.filters ?? {}),
            idLocador: data.id, // só vê reservas dos próprios veículos
          },
          data.pagination,
        );

      default:
        throw new HttpError(403, "Acesso negado");
    }
  };

  findById = async (
    id: string,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> => {
    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    return reserva;
  };

  findByLocatarioId = async (
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> => {
    const reservas = await this.reservaRepository.findByLocatarioId(
      idLocatario,
      pagination,
    );
    if (reservas.total === 0) {
      throw new HttpError(404, "Nenhuma reserva encontrada para este locatário");
    }
    return reservas;
  };

  findByVeiculoId = async (
    idVeiculo: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> => {
    const reservas = await this.reservaRepository.findByVeiculoId(
      idVeiculo,
      pagination,
    );
    if (reservas.total === 0) {
      throw new HttpError(404, "Nenhuma reserva encontrada para este veículo");
    }
    return reservas;
  };

  create = async (
    data: CreateReservaRequest,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> => {
    // LOCATARIO só reserva pra si mesmo; ADMIN reserva em nome de qualquer um.
    if (requester.cargo !== Cargo.ADMIN && requester.id !== data.idLocatario) {
      throw new HttpError(403, "Acesso negado");
    }

    const veiculo = await this.veiculoRepository.findById(data.idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    const locatario = await this.locatarioRepository.findById(
      data.idLocatario,
    );
    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }

    // Locatário com bloqueio ativo (inadimplência, fraude, etc.) não reserva.
    await this.bloqueioService.assertLocatarioLiberado(data.idLocatario);

    if (veiculo.status !== StatusVeiculo.DISPONIVEL) {
      throw new HttpError(409, "O veículo não está disponível para reserva.");
    }

    await this.assertPeriodoValido(
      data.idVeiculo,
      data.dataHoraInicio,
      data.dataHoraFim,
    );

    const idGaragemRetirada = this.resolverGaragemRetirada(
      veiculo.garagemId,
      data.idGaragemRetirada,
    );

    // Garagem de retirada (onde o veículo está alocado) precisa estar ATIVA.
    if (idGaragemRetirada !== undefined) {
      await this.assertGaragemRetiradaAtiva(idGaragemRetirada);
    }

    if (data.idGaragemDevolucao !== undefined) {
      await this.assertGaragemDevolucao(
        data.idGaragemDevolucao,
        veiculo.idLocador,
      );
    }

    // Regra PCD: veículos adaptados exigem locatário com deficiência.
    if (veiculo.modeloVeiculo.adaptado) {
      await this.assertLocatarioElegivelParaVeiculoAdaptado(
        locatario,
        data.deficienciaId,
      );
    }

    // Serviços opcionais: valida os IDs e calcula a soma dos valores. O valor
    // total = valor base (informado) + soma dos serviços contratados.
    const { servicos, valorServicos } = await this.resolverServicosOpcionais(
      data.servicosIds,
    );
    const valorTotal = data.valorTotal + valorServicos;

    return this.reservaRepository.create({
      ...data,
      idGaragemRetirada,
      valorTotal,
      servicos,
    });
  };

  update = async (
    id: string,
    data: UpdateReservaRequest,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> => {
    const hasData = Object.values(data).some((v) => v !== undefined);
    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    // Confirmar uma reserva também exige locatário liberado (sem bloqueio ativo).
    if (data.status === StatusReserva.CONFIRMADA) {
      await this.bloqueioService.assertLocatarioLiberado(reserva.idLocatario);
    }

    // Se mexeu em qualquer das datas, revalida o período usando os valores finais.
    if (data.dataHoraInicio !== undefined || data.dataHoraFim !== undefined) {
      await this.assertPeriodoValido(
        reserva.idVeiculo,
        data.dataHoraInicio ?? reserva.dataHoraInicio,
        data.dataHoraFim ?? reserva.dataHoraFim,
        id,
      );
    }

    // Novo local de devolução deve pertencer ao locador dono do veículo.
    if (data.idGaragemDevolucao !== undefined) {
      const veiculo = await this.veiculoRepository.findById(reserva.idVeiculo);
      if (!veiculo) {
        throw new HttpError(404, "Veículo não encontrado");
      }
      await this.assertGaragemDevolucao(
        data.idGaragemDevolucao,
        veiculo.idLocador,
      );
    }

    // statusPagamento não vem mais do cliente (removido do schema): o resultado
    // do pagamento só muda por confirmarPagamento, acionado pelo webhook
    // assinado do gateway. O PUT trata apenas datas/status/devolução.
    return this.reservaRepository.update(id, data);
  };

  // Fluxo INTERNO do gateway de pagamento. Só o webhook (após validar a
  // assinatura) chega aqui — por isso não passa pela autorização de requester:
  // a confiança vem da assinatura, não de um JWT de usuário. Centraliza a
  // mudança de status de pagamento e a geração do código de desbloqueio.
  confirmarPagamento = async (
    idReserva: string,
    evento: { status: StatusPagamento; metodo?: MetodoPagamento },
  ): Promise<ReservaResponse> => {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    const atualizada = await this.reservaRepository.update(idReserva, {
      statusPagamento: evento.status,
      ...(evento.metodo ? { metodoPagamento: evento.metodo } : {}),
    });

    // Pagamento confirmado agora e ainda sem código -> gera o código de
    // desbloqueio e envia o relatório por e-mail (best-effort: o notifier nunca
    // lança). Idempotente: reserva já confirmada mantém o mesmo código.
    if (
      evento.status === StatusPagamento.SUCESSO &&
      !reserva.codigoDesbloqueio
    ) {
      // RN07: revalida bloqueio financeiro na trilha do pagamento. Locatário
      // bloqueado após criar a reserva não pode ser confirmado nem receber o
      // código pelo webhook. Idempotente: reserva que já tem código não entra
      // aqui (guard acima), então reprocessamento não dispara 403 espúrio.
      await this.bloqueioService.assertLocatarioLiberado(reserva.idLocatario);
      const codigo = await this.gerarCodigoUnico();
      const confirmada = await this.reservaRepository.gerarCodigoDesbloqueio(
        idReserva,
        codigo,
        new Date(),
      );
      await this.reservaNotifier?.notificarReservaConfirmada(confirmada);
      return confirmada;
    }

    return atualizada;
  };

  // Usa o código de desbloqueio do veículo dentro da janela permitida.
  usarCodigoDesbloqueio = async (
    id: string,
    codigo: string,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> => {
    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    // Sem código gerado ainda é conflito de estado (pagamento não confirmado).
    if (!reserva.codigoDesbloqueio || !reserva.codigoGeradoEm) {
      throw new HttpError(
        409,
        "Código de desbloqueio ainda não gerado. Confirme o pagamento primeiro.",
      );
    }

    if (reserva.codigoDesbloqueio !== codigo.toUpperCase()) {
      throw new HttpError(400, "Código de desbloqueio inválido.");
    }

    this.assertCodigoUsavel(reserva);

    return this.reservaRepository.marcarCodigoComoUsado(id, new Date());
  };

  delete = async (
    id: string,
    requester: ReservaAccessContext,
  ): Promise<void> => {
    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    return this.reservaRepository.delete(id);
  };

  search = async (
    filters: ReservaFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> => {
    const reservas = await this.reservaRepository.search(filters, pagination);
    if (reservas.total === 0) {
      throw new HttpError(
        404,
        "Nenhuma reserva encontrada com os filtros fornecidos",
      );
    }
    return reservas;
  };

  // ── Condutores adicionais (RF12) ──────────────────────────────────────────

  // Alterações (incluir/remover condutor) só são permitidas antes do início da
  // reserva e enquanto ela não estiver cancelada.
  private assertReservaAlteravel(reserva: ReservaResponse): void {
    if (reserva.status === StatusReserva.CANCELADA) {
      throw new HttpError(409, "Reserva cancelada.");
    }
    if (new Date() >= reserva.dataHoraInicio) {
      throw new HttpError(
        409,
        "Não é possível alterar os condutores após o início da reserva.",
      );
    }
  }

  // Carrega a reserva (404) e valida o acesso do solicitante.
  private async getReservaComAcesso(
    idReserva: string,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }
    await this.assertReservaAccess(requester, reserva);
    return reserva;
  }

  adicionarCondutor = async (
    idReserva: string,
    data: Omit<CreateCondutorRequest, "idReserva">,
    requester: ReservaAccessContext,
  ): Promise<CondutorResponse> => {
    const reserva = await this.getReservaComAcesso(idReserva, requester);
    this.assertReservaAlteravel(reserva);

    // RN02: no máximo 3 condutores adicionais por reserva. Usa count real, que
    // reflete remoções (não índice fixo).
    const total = await this.condutorRepository.countByReservaId(idReserva);
    if (total >= MAX_CONDUTORES_ADICIONAIS) {
      throw new HttpError(
        409,
        "Limite de 3 condutores adicionais atingido.",
      );
    }

    // Duplicidade: mesmo condutor (CNH) já cadastrado nesta reserva.
    const existente = await this.condutorRepository.findByReservaAndCnh(
      idReserva,
      data.cnh,
    );
    if (existente) {
      throw new HttpError(
        409,
        "Já existe um condutor com esta CNH nesta reserva.",
      );
    }

    return this.condutorRepository.create({ idReserva, ...data });
  };

  listarCondutores = async (
    idReserva: string,
    requester: ReservaAccessContext,
  ): Promise<CondutorResponse[]> => {
    await this.getReservaComAcesso(idReserva, requester);
    return this.condutorRepository.findByReservaId(idReserva);
  };

  removerCondutor = async (
    idReserva: string,
    idCondutor: string,
    requester: ReservaAccessContext,
  ): Promise<void> => {
    const reserva = await this.getReservaComAcesso(idReserva, requester);
    this.assertReservaAlteravel(reserva);

    const condutor = await this.condutorRepository.findById(idCondutor);
    if (!condutor || condutor.idReserva !== idReserva) {
      throw new HttpError(404, "Condutor não encontrado nesta reserva.");
    }

    await this.condutorRepository.delete(idCondutor);
  };
}
