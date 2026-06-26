import { randomInt } from "node:crypto";
import { Cargo, StatusPagamento, StatusReserva, StatusVeiculo } from "@prisma/client";

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

export class ReservaService {
  constructor(
    private readonly reservaRepository: IReservaRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly locatarioRepository: ILocatarioRepository,
    private readonly garagemRepository: IGaragemRepository,
  ) {}

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

  // O local de devolução deve obrigatoriamente pertencer ao locador dono do veículo.
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
  }

  list = async (data: ListReservasRequest): Promise<ReservaResponse[]> => {
    switch (data.cargo) {
      case Cargo.ADMIN:
        return data.filters
          ? await this.reservaRepository.search(data.filters)
          : await this.reservaRepository.findAll();

      case Cargo.LOCATARIO:
        return await this.reservaRepository.search({
          ...(data.filters ?? {}),
          idLocatario: data.id, // garante que só vê as próprias
        });

      case Cargo.LOCADOR:
        return await this.reservaRepository.search({
          ...(data.filters ?? {}),
          idLocador: data.id, // só vê reservas dos próprios veículos
        });

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
  ): Promise<ReservaResponse[]> => {
    const reservas =
      await this.reservaRepository.findByLocatarioId(idLocatario);
    if (!reservas || reservas.length === 0) {
      throw new HttpError(404, "Nenhuma reserva encontrada para este locatário");
    }
    return reservas;
  };

  findByVeiculoId = async (idVeiculo: string): Promise<ReservaResponse[]> => {
    const reservas = await this.reservaRepository.findByVeiculoId(idVeiculo);
    if (!reservas || reservas.length === 0) {
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

    if (data.idGaragemDevolucao !== undefined) {
      await this.assertGaragemDevolucao(
        data.idGaragemDevolucao,
        veiculo.idLocador,
      );
    }

    return this.reservaRepository.create({ ...data, idGaragemRetirada });
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

    const atualizada = await this.reservaRepository.update(id, data);

    // Pagamento confirmado agora e ainda sem código -> gera o código de desbloqueio.
    if (
      data.statusPagamento === StatusPagamento.SUCESSO &&
      !reserva.codigoDesbloqueio
    ) {
      const codigo = await this.gerarCodigoUnico();
      return this.reservaRepository.gerarCodigoDesbloqueio(
        id,
        codigo,
        new Date(),
      );
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

  search = async (filters: ReservaFilters): Promise<ReservaResponse[]> => {
    const reservas = await this.reservaRepository.search(filters);
    if (!reservas || reservas.length === 0) {
      throw new HttpError(
        404,
        "Nenhuma reserva encontrada com os filtros fornecidos",
      );
    }
    return reservas;
  };
}
