import { randomInt } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  Cargo,
  CategoriaVeiculo,
  MetodoPagamento,
  StatusGaragem,
  StatusPagamento,
  StatusReserva,
  StatusVeiculo,
} from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import {
  CreateReservaInput,
  QuoteReservaInput,
  CreateReservaRequest,
  ListReservasRequest,
  ReservaFilters,
  ReservaResponse,
  ReservaVeiculoResponse,
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
  ReservaBloqueadaParaCondutor,
} from "../repositories/contracts/condutor.contract.js";
import { ReservaServicoInput } from "../repositories/contracts/reserva.contract.js";
import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { BloqueioService } from "./bloqueio.js";
import { IReservaNotifier } from "./notificacao-reserva.js";
import { env } from "../config/env.js";
import { LocatarioResponse } from "../repositories/contracts/locatario.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";
import type { PagamentoEstornoService } from "./pagamento-estorno.js";

interface ReservaAccessContext {
  id: string;
  cargo: Cargo;
}

const atorAuditoria = (requester: ReservaAccessContext) =>
  requester.cargo === Cargo.LOCATARIO ? undefined : { id: requester.id, cargo: requester.cargo };

// Alfabeto sem caracteres ambíguos (sem O, 0, I, 1, L).
const CODIGO_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODIGO_BLOCO = 4; // XXXX-XXXX
const CODIGO_MAX_TENTATIVAS = 5;
const CODIGO_VALIDADE_MS = 2 * 24 * 60 * 60 * 1000;

// RN05: duração da reserva. Mínimo de 1 hora, máximo de 30 dias consecutivos.
const DURACAO_MINIMA_MS = 60 * 60 * 1000;
const DURACAO_MAXIMA_MS = 30 * 24 * 60 * 60 * 1000;

const PRAZO_CANCELAMENTO_MS = 2 * 60 * 60 * 1000;
const MULTA_CANCELAMENTO_TARDIO = 0.2;

// Dinheiro sempre com 2 casas — evita 0.1 + 0.2 aparecendo na resposta.
const arredondar2 = (v: number): number => Math.round(v * 100) / 100;

const MULTA_ATRASO = 0.1;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const calcularCobrancaAtraso = (valorDiaria: number, atrasoMs: number): number => {
  const diariaCentavos = Math.round(valorDiaria * 100);
  return Math.round((diariaCentavos * atrasoMs * (1 + MULTA_ATRASO)) / UM_DIA_MS) / 100;
};

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
    // RN03: última localização do veículo, referência do geofence de desbloqueio.
    private readonly localizacaoRepository: ILocalizacaoRepository,
    private readonly reservaNotifier?: IReservaNotifier,
    private readonly pagamentoEstornoService?: PagamentoEstornoService,
  ) {}

  // RN03: distância em metros entre dois pontos (fórmula de Haversine).
  private distanciaMetros(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6_371_000; // raio médio da Terra, em metros
    const toRad = (graus: number) => (graus * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private async assertLocalDesbloqueio(
    idVeiculo: string,
    coord?: { latitude: number; longitude: number },
  ): Promise<void> {
    const ref = await this.localizacaoRepository.findLatestByVeiculoId(idVeiculo);
    if (!ref) {
      throw new HttpError(
        409,
        "Localização de referência do veículo indisponível para desbloqueio.",
      );
    }

    if (!coord) {
      throw new HttpError(
        400,
        "Coordenada do dispositivo obrigatória para desbloqueio.",
      );
    }

    const distancia = this.distanciaMetros(
      coord.latitude,
      coord.longitude,
      ref.latitude,
      ref.longitude,
    );
    if (distancia > env.DESBLOQUEIO_RAIO_METROS) {
      throw new HttpError(403, "Fora do local permitido para desbloqueio.");
    }
  }

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
      nome: s.nome,
      descricao: s.descricao,
      detalhesCobertura: s.detalhesCobertura ?? null,
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

  private async assertReservaAccess(
    requester: ReservaAccessContext,
    reserva: Pick<ReservaResponse, "idLocatario" | "idVeiculo">,
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

  private resolverGaragemRetirada(
    garagemAtualVeiculo: string | null,
    idGaragemRetiradaInformada?: string,
  ): string {
    if (
      idGaragemRetiradaInformada !== undefined &&
      idGaragemRetiradaInformada !== garagemAtualVeiculo
    ) {
      throw new HttpError(
        400,
        "O local de retirada deve corresponder à garagem onde o veículo está atualmente alocado.",
      );
    }

    if (!garagemAtualVeiculo) {
      throw new HttpError(
        409,
        "O veículo não possui uma garagem de retirada operacional.",
      );
    }

    return garagemAtualVeiculo;
  }

  private async resolverDeficienciaParaVeiculoAdaptado(
    locatario: LocatarioResponse,
    deficienciaIdInformada?: string,
  ): Promise<string | undefined> {
    // Já possui deficiência cadastrada -> elegível, nada a associar.
    if (locatario.deficienciaId) {
      return undefined;
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

    return deficienciaIdInformada;
  }

  static calcularValorBase(
    valorDiaria: number,
    inicio: Date,
    fim: Date,
  ): number {
    const UM_DIA = 24 * 60 * 60 * 1000;
    const diarias = Math.max(1, Math.ceil((fim.getTime() - inicio.getTime()) / UM_DIA));
    return arredondar2(valorDiaria * diarias);
  }

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
    requester: ReservaAccessContext,
  ): Promise<PaginatedResult<ReservaResponse>> => {
    if (requester.cargo !== Cargo.ADMIN && requester.id !== idLocatario) {
      throw new HttpError(403, "Acesso negado");
    }
    const reservas = await this.reservaRepository.findByLocatarioId(
      idLocatario,
      pagination,
    );
    return reservas;
  };

  findByVeiculoId = async (
    idVeiculo: string,
    pagination: PaginationParams,
    requester: ReservaAccessContext,
  ): Promise<PaginatedResult<ReservaVeiculoResponse>> => {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    if (
      requester.cargo !== Cargo.ADMIN &&
      (requester.cargo !== Cargo.LOCADOR || veiculo.idLocador !== requester.id)
    ) {
      throw new HttpError(403, "Acesso negado");
    }

    const reservas = await this.reservaRepository.findByVeiculoId(
      idVeiculo,
      pagination,
    );
    if (reservas.total === 0) {
      throw new HttpError(404, "Nenhuma reserva encontrada para este veículo");
    }
    return reservas;
  };

  precificar = async (data: QuoteReservaInput) => {
    const veiculo = await this.veiculoRepository.findById(data.idVeiculo);
    if (!veiculo) throw new HttpError(404, "Veículo não encontrado");
    if (veiculo.status !== StatusVeiculo.DISPONIVEL) {
      throw new HttpError(409, "O veículo não está disponível para reserva.");
    }
    await this.assertPeriodoValido(data.idVeiculo, data.dataHoraInicio, data.dataHoraFim);
    const idGaragemRetirada = this.resolverGaragemRetirada(
      veiculo.garagemId,
      data.idGaragemRetirada,
    );
    await this.assertGaragemRetiradaAtiva(idGaragemRetirada);
    if (data.idGaragemDevolucao) {
      await this.assertGaragemDevolucao(
        data.idGaragemDevolucao,
        veiculo.idLocador,
      );
    }
    const { servicos, valorServicos } = await this.resolverServicosOpcionais(data.servicosIds);
    const valorDiaria = Number(veiculo.modeloVeiculo.valorDiaria);
    const valorBase = ReservaService.calcularValorBase(valorDiaria, data.dataHoraInicio, data.dataHoraFim);
    const diarias = Math.max(1, Math.ceil((data.dataHoraFim.getTime() - data.dataHoraInicio.getTime()) / UM_DIA_MS));
    return {
      valorDiaria,
      diarias,
      valorBase,
      valorServicos: arredondar2(valorServicos),
      valorTotal: arredondar2(valorBase + valorServicos),
      servicos,
    };
  };

  create = async (
    data: CreateReservaInput,
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

    const exigeDeficiencia =
      veiculo.modeloVeiculo.adaptado ||
      veiculo.modeloVeiculo.categoria === CategoriaVeiculo.PCD;

    let deficienciaParaAssociar: string | undefined;
    if (exigeDeficiencia) {
      deficienciaParaAssociar =
        await this.resolverDeficienciaParaVeiculoAdaptado(
          locatario,
          data.deficienciaId,
        );
    }

    // Serviços opcionais: valida os IDs e calcula a soma dos valores.
    const { servicos, valorServicos } = await this.resolverServicosOpcionais(
      data.servicosIds,
    );

    const valorBase = ReservaService.calcularValorBase(
      veiculo.modeloVeiculo.valorDiaria,
      data.dataHoraInicio,
      data.dataHoraFim,
    );
    const valorTotal = arredondar2(valorBase + valorServicos);

    return this.reservaRepository.create({
      ...data,
      idGaragemRetirada,
      valorTotal,
      servicos,
      deficienciaIdParaAssociar: deficienciaParaAssociar,
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

    // Se mexeu em qualquer das datas, revalida o período usando os valores finais.
    const inicioFinal = data.dataHoraInicio ?? reserva.dataHoraInicio;
    const fimFinal = data.dataHoraFim ?? reserva.dataHoraFim;
    const alteracaoPeriodo =
      inicioFinal.getTime() !== reserva.dataHoraInicio.getTime() ||
      fimFinal.getTime() !== reserva.dataHoraFim.getTime();

    if (
      alteracaoPeriodo &&
      (reserva.statusPagamento === StatusPagamento.SUCESSO ||
        reserva.statusPagamento === StatusPagamento.PROCESSANDO)
    ) {
      throw new HttpError(
        409,
        "Não é possível alterar o período de uma reserva já paga.",
      );
    }

    if (alteracaoPeriodo) {
      await this.assertPeriodoValido(
        reserva.idVeiculo,
        inicioFinal,
        fimFinal,
        id,
      );
    }

    let valorTotalCalculado: number | undefined;
    if (alteracaoPeriodo) {
      const valorBase = ReservaService.calcularValorBase(
        reserva.veiculo.modeloVeiculo.valorDiaria,
        inicioFinal,
        fimFinal,
      );
      const valorServicos = reserva.servicos.reduce(
        (total, servico) => total + servico.valor,
        0,
      );
      valorTotalCalculado = arredondar2(valorBase + valorServicos);
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

    return this.reservaRepository.update(id, {
      idGaragemDevolucao: data.idGaragemDevolucao,
      dataHoraInicio: data.dataHoraInicio,
      dataHoraFim: data.dataHoraFim,
      metodoPagamento: data.metodoPagamento,
      ...(valorTotalCalculado !== undefined ? { valorTotalCalculado } : {}),
    }, atorAuditoria(requester));
  };

  cancelarReserva = async (
    id: string,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> => {
    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    // Máquina de estados: só AGUARDANDO_PAGAMENTO/CONFIRMADA podem ser canceladas.
    if (reserva.status === StatusReserva.CANCELADA) {
      if (reserva.statusPagamento === StatusPagamento.SUCESSO) {
        await this.pagamentoEstornoService?.reconciliarEstornoDeCancelamento(id);
      }
      throw new HttpError(409, "Reserva já cancelada.");
    }
    if (
      reserva.status === StatusReserva.EM_ANDAMENTO ||
      reserva.status === StatusReserva.REALIZADA
    ) {
      throw new HttpError(
        409,
        "Reserva em andamento ou concluída não pode ser cancelada.",
      );
    }

    const agora = new Date();
    const prazoLimite = new Date(
      reserva.dataHoraInicio.getTime() - PRAZO_CANCELAMENTO_MS,
    );
    const tardio = requester.cargo === Cargo.LOCATARIO && agora > prazoLimite;
    // Arredonda para 2 casas (coluna Decimal(10,2)).
    const multa = tardio
      ? Math.round(reserva.valorTotal * MULTA_CANCELAMENTO_TARDIO * 100) / 100
      : 0;

    const cancelada = await this.reservaRepository.cancelar(id, multa, env.PAGAMENTO_SANDBOX_PROVIDER, atorAuditoria(requester));
    if (cancelada.statusPagamento === StatusPagamento.SUCESSO) {
      await this.pagamentoEstornoService?.registrarEstornoDeCancelamento(id);
    }
    return cancelada;
  };

  devolverReserva = async (
    id: string,
    requester: ReservaAccessContext,
  ): Promise<ReservaResponse> => {
    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    if (reserva.status === StatusReserva.CANCELADA) {
      throw new HttpError(409, "Reserva cancelada.");
    }
    if (reserva.status === StatusReserva.REALIZADA || reserva.devolvidoEm) {
      throw new HttpError(409, "Reserva já devolvida.");
    }
    if (!reserva.codigoUsadoEm) {
      throw new HttpError(
        409,
        "Veículo ainda não foi desbloqueado; não há devolução a registrar.",
      );
    }
    if (reserva.status !== StatusReserva.EM_ANDAMENTO) {
      throw new HttpError(409, "Reserva não está em andamento.");
    }

    const devolvidoEm = new Date();
    let cobranca = 0;
    if (devolvidoEm > reserva.dataHoraFim) {
      const atrasoMs = devolvidoEm.getTime() - reserva.dataHoraFim.getTime();
      cobranca = calcularCobrancaAtraso(
        reserva.veiculo.modeloVeiculo.valorDiaria,
        atrasoMs,
      );
    }

    return this.reservaRepository.devolver(id, devolvidoEm, cobranca, atorAuditoria(requester));
  };

  confirmarPagamento = async (
    idReserva: string,
    evento: { status: StatusPagamento; metodo?: MetodoPagamento },
  ): Promise<ReservaResponse> => {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    const aprovadaSemCodigo =
      reserva.statusPagamento === StatusPagamento.SUCESSO &&
      !reserva.codigoDesbloqueio &&
      evento.status === StatusPagamento.SUCESSO;
    if (
      reserva.status === StatusReserva.CANCELADA ||
      (reserva.statusPagamento === StatusPagamento.SUCESSO && !aprovadaSemCodigo)
    ) {
      return reserva;
    }

    if (
      evento.status === StatusPagamento.SUCESSO &&
      !reserva.codigoDesbloqueio &&
      // Autocura: o valor ja foi aceito; RN07 pertence a aceitacao, nao a geracao do codigo.
      !aprovadaSemCodigo
    ) {
      try {
        await this.bloqueioService.assertLocatarioLiberado(reserva.idLocatario);
      } catch (error) {
        if (error instanceof HttpError && reserva.statusPagamento !== StatusPagamento.SUCESSO) {
          try {
            await this.reservaRepository.atualizarStatusPagamento(idReserva, StatusPagamento.FALHA, evento.metodo);
          } catch {
          }
        }
        throw error;
      }
    }

    const atualizada = await this.reservaRepository.atualizarStatusPagamento(
      idReserva,
      evento.status,
      evento.metodo,
    );

    if (atualizada.status === StatusReserva.CANCELADA) {
      return atualizada;
    }

    if (
      evento.status === StatusPagamento.SUCESSO &&
      !reserva.codigoDesbloqueio
    ) {
      const codigo = await this.gerarCodigoUnico();
      const confirmada = await this.reservaRepository.gerarCodigoDesbloqueio(
        idReserva,
        codigo,
        new Date(),
        StatusReserva.CONFIRMADA,
      );
      if (confirmada.codigoDesbloqueio === codigo) {
        await this.reservaNotifier?.notificarReservaConfirmada(confirmada);
      }
      return confirmada;
    }

    return atualizada;
  };

  usarCodigoDesbloqueio = async (
    id: string,
    codigo: string,
    requester: ReservaAccessContext,
    coord?: { latitude: number; longitude: number },
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
    await this.assertLocalDesbloqueio(reserva.idVeiculo, coord);

    return this.reservaRepository.marcarCodigoComoUsado(
      id,
      new Date(),
      StatusReserva.EM_ANDAMENTO,
    );
  };

  gerarQrDesbloqueio = async (
    id: string,
    requester: ReservaAccessContext,
  ): Promise<{ qr: string }> => {
    const reserva = await this.reservaRepository.findById(id);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }

    await this.assertReservaAccess(requester, reserva);

    if (!reserva.codigoDesbloqueio) {
      throw new HttpError(
        409,
        "Código de desbloqueio ainda não gerado. Confirme o pagamento primeiro.",
      );
    }

    const qr = jwt.sign(
      {
        idReserva: id,
        codigo: reserva.codigoDesbloqueio,
        exp: Math.floor(this.calcularExpiracaoCodigo(reserva).getTime() / 1000),
      },
      env.JWT_SECRET,
    );
    return { qr };
  };

  usarQrDesbloqueio = async (
    id: string,
    qr: string,
    requester: ReservaAccessContext,
    coord?: { latitude: number; longitude: number },
  ): Promise<ReservaResponse> => {
    let payload: { idReserva?: string; codigo?: string };
    try {
      payload = jwt.verify(qr, env.JWT_SECRET) as {
        idReserva?: string;
        codigo?: string;
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new HttpError(409, "Código de desbloqueio expirado.");
      }
      throw new HttpError(400, "QR Code inválido ou adulterado.");
    }

    if (payload.idReserva !== id || !payload.codigo) {
      throw new HttpError(400, "QR Code inválido para esta reserva.");
    }

    return this.usarCodigoDesbloqueio(id, payload.codigo, requester, coord);
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

  private assertReservaAlteravel(
    reserva: Pick<ReservaResponse, "status" | "dataHoraInicio">,
  ): void {
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
    return this.condutorRepository.createWithinLimit(
      { idReserva, ...data },
      async (reserva: ReservaBloqueadaParaCondutor) => {
        await this.assertReservaAccess(requester, reserva);
        this.assertReservaAlteravel(reserva);
      },
    );
  };

  listarCondutores = async (
    idReserva: string,
    requester: ReservaAccessContext,
  ): Promise<CondutorResponse[]> => {
    await this.getReservaComAcesso(idReserva, requester);
    const condutores = await this.condutorRepository.findByReservaId(idReserva);
    if (requester.cargo === Cargo.LOCADOR) {
      return condutores.map((condutor) => ({ ...condutor, cpf: null }));
    }
    return condutores;
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
