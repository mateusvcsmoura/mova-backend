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
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

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

  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({ skip, take, orderBy: { criadaEm: "desc" } }),
      prisma.reserva.count(),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<ReservaResponse | null> {
    const data = await prisma.reserva.findUnique({ where: { id } });
    return data ? ReservaMapper.toResponse(data) : null;
  }

  async findByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idLocatario };
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
      }),
      prisma.reserva.count({ where }),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findByVeiculoId(
    idVeiculo: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idVeiculo };
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
      }),
      prisma.reserva.count({ where }),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async search(
    filters: ReservaFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = this.buildWhere(filters);
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
      }),
      prisma.reserva.count({ where }),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
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
