import { Prisma, StatusReserva, TipoCobranca } from "@prisma/client";

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

// Carrega os serviços contratados junto com o serviço do catálogo, em uma
// única consulta (evita N+1 ao montar a resposta).
const RESERVA_INCLUDE = {
  servicos: { include: { servico: true } },
} satisfies Prisma.ReservaInclude;

export class PrismaReservaRepository implements IReservaRepository {
  // Colisão clássica de intervalos para um veículo: inicio_existente < fim_novo
  // e fim_existente > inicio_novo. Reservas canceladas não bloqueiam. Extraído
  // para que a checagem otimista (hasOverlapForVeiculo) e a recheca sob lock
  // (create) usem exatamente a mesma regra.
  private overlapWhere(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Prisma.ReservaWhereInput {
    return {
      idVeiculo,
      ...(excludeReservaId ? { id: { not: excludeReservaId } } : {}),
      status: { not: StatusReserva.CANCELADA },
      dataHoraInicio: { lt: dataHoraFim },
      dataHoraFim: { gt: dataHoraInicio },
    };
  }

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
      prisma.reserva.findMany({
        skip,
        take,
        orderBy: { criadaEm: "desc" },
        include: RESERVA_INCLUDE,
      }),
      prisma.reserva.count(),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<ReservaResponse | null> {
    const data = await prisma.reserva.findUnique({
      where: { id },
      include: RESERVA_INCLUDE,
    });
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
        include: RESERVA_INCLUDE,
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
        include: RESERVA_INCLUDE,
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
        include: RESERVA_INCLUDE,
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
      include: RESERVA_INCLUDE,
    });
    return data ? ReservaMapper.toResponse(data) : null;
  }

  async create(data: CreateReservaRequest): Promise<ReservaResponse> {
    // Transação + advisory lock por veículo elimina a race de double-booking:
    // a checagem otimista no service roda antes das validações, mas duas
    // requisições concorrentes para o mesmo veículo/período poderiam ambas
    // passar e inserir. Aqui serializamos por veículo (lock liberado no fim da
    // transação) e recheсamos o overlap antes do insert — a última palavra.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.idVeiculo}, 0))`;

      const conflitos = await tx.reserva.count({
        where: this.overlapWhere(
          data.idVeiculo,
          data.dataHoraInicio,
          data.dataHoraFim,
        ),
      });
      if (conflitos > 0) {
        throw new HttpError(
          409,
          "O veículo já possui uma reserva nesse período.",
        );
      }

      // RN01: associa a deficiência ao perfil do locatário na MESMA transação.
      // Se o create abaixo falhar, esta escrita é revertida (sem efeito órfão).
      if (data.deficienciaIdParaAssociar) {
        await tx.locatario.update({
          where: { id: data.idLocatario },
          data: { deficienciaId: data.deficienciaIdParaAssociar },
        });
      }

      const reserva = await tx.reserva.create({
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
          metodoPagamento: data.metodoPagamento ?? undefined,
          // Cria as associações de serviços opcionais na mesma operação,
          // gravando o valor contratado como snapshot.
          ...(data.servicos && data.servicos.length > 0
            ? {
                servicos: {
                  create: data.servicos.map((s) => ({
                    idServico: s.idServico,
                    valor: s.valor,
                  })),
                },
              }
            : {}),
        },
        include: RESERVA_INCLUDE,
      });
      return ReservaMapper.toResponse(reserva);
    });
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
          metodoPagamento: data.metodoPagamento ?? undefined,
        },
        include: RESERVA_INCLUDE,
      });
      return ReservaMapper.toResponse(reserva);
    } catch {
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async cancelar(id: string, multa: number): Promise<ReservaResponse> {
    // Cobrança + transição em uma transação: ou registra a multa E cancela, ou
    // nada. Grava a cobrança mesmo com valor 0 (trilha completa — RN04).
    try {
      const reserva = await prisma.$transaction(async (tx) => {
        await tx.cobrancaReserva.create({
          data: { idReserva: id, tipo: TipoCobranca.CANCELAMENTO, valor: multa },
        });
        return tx.reserva.update({
          where: { id },
          data: { status: StatusReserva.CANCELADA },
          include: RESERVA_INCLUDE,
        });
      });
      return ReservaMapper.toResponse(reserva);
    } catch {
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async devolver(
    id: string,
    devolvidoEm: Date,
    valorCobranca: number,
  ): Promise<ReservaResponse> {
    // Cobrança (só quando há atraso) + devolvidoEm + REALIZADA numa transação.
    try {
      const reserva = await prisma.$transaction(async (tx) => {
        if (valorCobranca > 0) {
          await tx.cobrancaReserva.create({
            data: {
              idReserva: id,
              tipo: TipoCobranca.ATRASO_DEVOLUCAO,
              valor: valorCobranca,
            },
          });
        }
        return tx.reserva.update({
          where: { id },
          data: { devolvidoEm, status: StatusReserva.REALIZADA },
          include: RESERVA_INCLUDE,
        });
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
        include: RESERVA_INCLUDE,
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
        include: RESERVA_INCLUDE,
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
      where: this.overlapWhere(
        idVeiculo,
        dataHoraInicio,
        dataHoraFim,
        excludeReservaId,
      ),
    });
    return count > 0;
  }
}
