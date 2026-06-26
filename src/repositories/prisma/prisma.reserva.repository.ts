import { Prisma, StatusReserva } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IReservaRepository } from "../reserva.repository.js";
import {
  CreateReservaRequest,
  ReservaFilters,
  ReservaResponse,
  UpdateReservaRequest,
} from "../contracts/reserva.contract.js";
import { ReservaMapper } from "../mappers/reserva.mapper.js";

export class PrismaReservaRepository implements IReservaRepository {
  private buildWhere(filters: ReservaFilters): Prisma.ReservaWhereInput {
    return {
      ...(filters.idVeiculo ? { idVeiculo: filters.idVeiculo } : {}),
      ...(filters.idLocatario ? { idLocatario: filters.idLocatario } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.statusPagamento
        ? { statusPagamento: filters.statusPagamento }
        : {}),
      // filtra pelas reservas dos veículos pertencentes ao locador
      ...(filters.idLocador
        ? { veiculo: { idLocador: filters.idLocador } }
        : {}),
    };
  }

  async findAll(): Promise<ReservaResponse[]> {
    const data = await prisma.reserva.findMany({
      orderBy: { criadaEm: "desc" },
    });
    return ReservaMapper.toManyResponse(data);
  }

  async findById(id: string): Promise<ReservaResponse | null> {
    const data = await prisma.reserva.findUnique({ where: { id } });
    return data ? ReservaMapper.toResponse(data) : null;
  }

  async findByLocatarioId(idLocatario: string): Promise<ReservaResponse[]> {
    const data = await prisma.reserva.findMany({
      where: { idLocatario },
      orderBy: { criadaEm: "desc" },
    });
    return ReservaMapper.toManyResponse(data);
  }

  async findByVeiculoId(idVeiculo: string): Promise<ReservaResponse[]> {
    const data = await prisma.reserva.findMany({
      where: { idVeiculo },
      orderBy: { criadaEm: "desc" },
    });
    return ReservaMapper.toManyResponse(data);
  }

  async search(filters: ReservaFilters): Promise<ReservaResponse[]> {
    const data = await prisma.reserva.findMany({
      where: this.buildWhere(filters),
      orderBy: { criadaEm: "desc" },
    });
    return ReservaMapper.toManyResponse(data);
  }

  async findByCodigoDesbloqueio(
    codigo: string,
  ): Promise<ReservaResponse | null> {
    const data = await prisma.reserva.findUnique({
      where: { codigoDesbloqueio: codigo },
    });
    return data ? ReservaMapper.toResponse(data) : null;
  }

  async create(data: CreateReservaRequest): Promise<ReservaResponse> {
    const reserva = await prisma.reserva.create({
      data: {
        idVeiculo: data.idVeiculo,
        idLocatario: data.idLocatario,
        idGaragemRetirada: data.idGaragemRetirada ?? undefined,
        idGaragemDevolucao: data.idGaragemDevolucao ?? undefined,
        dataHoraInicio: data.dataHoraInicio,
        dataHoraFim: data.dataHoraFim,
        valorTotal: data.valorTotal,
        status: data.status ?? undefined,
        statusPagamento: data.statusPagamento ?? undefined,
      },
    });
    return ReservaMapper.toResponse(reserva);
  }

  async update(
    id: string,
    data: UpdateReservaRequest,
  ): Promise<ReservaResponse> {
    const hasData = Object.values(data).some((v) => v !== undefined);
    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    try {
      const reserva = await prisma.reserva.update({
        where: { id },
        data: {
          idGaragemDevolucao: data.idGaragemDevolucao ?? undefined,
          dataHoraInicio: data.dataHoraInicio ?? undefined,
          dataHoraFim: data.dataHoraFim ?? undefined,
          valorTotal: data.valorTotal ?? undefined,
          status: data.status ?? undefined,
          statusPagamento: data.statusPagamento ?? undefined,
        },
      });
      return ReservaMapper.toResponse(reserva);
    } catch {
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.reserva.delete({ where: { id } });
  }

  async gerarCodigoDesbloqueio(
    id: string,
    codigo: string,
    geradoEm: Date,
  ): Promise<ReservaResponse> {
    try {
      const reserva = await prisma.reserva.update({
        where: { id },
        data: {
          codigoDesbloqueio: codigo,
          codigoGeradoEm: geradoEm,
          codigoUsadoEm: null,
        },
      });
      return ReservaMapper.toResponse(reserva);
    } catch {
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async marcarCodigoComoUsado(
    id: string,
    usadoEm: Date,
  ): Promise<ReservaResponse> {
    try {
      const reserva = await prisma.reserva.update({
        where: { id },
        data: { codigoUsadoEm: usadoEm },
      });
      return ReservaMapper.toResponse(reserva);
    } catch {
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async hasOverlapForVeiculo(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<boolean> {
    const count = await prisma.reserva.count({
      where: {
        idVeiculo,
        ...(excludeReservaId ? { id: { not: excludeReservaId } } : {}),
        // reservas canceladas não bloqueiam o período
        status: { not: StatusReserva.CANCELADA },
        // colisão clássica de intervalos: inicio_existente < fim_novo e fim_existente > inicio_novo
        dataHoraInicio: { lt: dataHoraFim },
        dataHoraFim: { gt: dataHoraInicio },
      },
    });
    return count > 0;
  }
}
