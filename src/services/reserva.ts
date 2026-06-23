import { Cargo, StatusVeiculo } from "@prisma/client";

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

interface ReservaAccessContext {
  id: string;
  cargo: Cargo;
}

export class ReservaService {
  constructor(
    private readonly reservaRepository: IReservaRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly locatarioRepository: ILocatarioRepository,
  ) {}

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

    return this.reservaRepository.create(data);
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

    return this.reservaRepository.update(id, data);
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
