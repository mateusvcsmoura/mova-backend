import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IBloqueioRepository } from "../bloqueio.repository.js";
import {
  BloqueioResponse,
  CreateBloqueioRequest,
  RevogarBloqueioRequest,
} from "../contracts/bloqueio.contract.js";
import { BloqueioMapper } from "../mappers/bloqueio.mapper.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaBloqueioRepository implements IBloqueioRepository {
  // Filtro de bloqueio impeditivo: não revogado e ainda não expirado.
  private whereAtivo(
    idLocatario: string,
    agora: Date,
  ): Prisma.BloqueioLocatarioWhereInput {
    return {
      idLocatario,
      revogadoEm: null,
      OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }],
    };
  }

  async create(data: CreateBloqueioRequest): Promise<BloqueioResponse> {
    const bloqueio = await prisma.bloqueioLocatario.create({
      data: {
        idLocatario: data.idLocatario,
        motivo: data.motivo,
        descricao: data.descricao ?? undefined,
        expiraEm: data.expiraEm ?? undefined,
        criadoPor: data.criadoPor ?? undefined,
      },
    });
    return BloqueioMapper.toResponse(bloqueio);
  }

  async findById(id: string): Promise<BloqueioResponse | null> {
    const bloqueio = await prisma.bloqueioLocatario.findUnique({
      where: { id },
    });
    return bloqueio ? BloqueioMapper.toResponse(bloqueio) : null;
  }

  async findBloqueioAtivo(
    idLocatario: string,
    agora: Date,
  ): Promise<BloqueioResponse | null> {
    const bloqueio = await prisma.bloqueioLocatario.findFirst({
      where: this.whereAtivo(idLocatario, agora),
      orderBy: { criadoEm: "desc" },
    });
    return bloqueio ? BloqueioMapper.toResponse(bloqueio, agora) : null;
  }

  async existsBloqueioAtivo(
    idLocatario: string,
    agora: Date,
  ): Promise<boolean> {
    const bloqueio = await prisma.bloqueioLocatario.findFirst({
      where: this.whereAtivo(idLocatario, agora),
      select: { id: true },
    });
    return bloqueio !== null;
  }

  async findAtivosByLocatario(
    idLocatario: string,
    agora: Date,
  ): Promise<BloqueioResponse[]> {
    const bloqueios = await prisma.bloqueioLocatario.findMany({
      where: this.whereAtivo(idLocatario, agora),
      orderBy: { criadoEm: "desc" },
    });
    return BloqueioMapper.toManyResponse(bloqueios, agora);
  }

  async findHistoricoByLocatario(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BloqueioResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idLocatario };
    const [data, total] = await prisma.$transaction([
      prisma.bloqueioLocatario.findMany({
        where,
        skip,
        take,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.bloqueioLocatario.count({ where }),
    ]);
    return buildPaginatedResult(
      BloqueioMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async revogar(
    id: string,
    data: RevogarBloqueioRequest,
  ): Promise<BloqueioResponse> {
    try {
      const bloqueio = await prisma.bloqueioLocatario.update({
        where: { id },
        data: {
          revogadoEm: data.revogadoEm,
          revogadoPor: data.revogadoPor ?? undefined,
        },
      });
      return BloqueioMapper.toResponse(bloqueio);
    } catch {
      throw new HttpError(404, "Bloqueio não encontrado.");
    }
  }
}
