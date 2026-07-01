import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IServicoOpcionalRepository } from "../servico-opcional.repository.js";
import {
  CreateServicoOpcionalRequest,
  ServicoOpcionalFilters,
  ServicoOpcionalResponse,
  UpdateServicoOpcionalRequest,
} from "../contracts/servico-opcional.contract.js";
import { ServicoOpcionalMapper } from "../mappers/servico-opcional.mapper.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaServicoOpcionalRepository
  implements IServicoOpcionalRepository
{
  private buildWhere(
    filters: ServicoOpcionalFilters,
  ): Prisma.ServicoOpcionalWhereInput {
    return {
      ...(filters.ativo !== undefined ? { ativo: filters.ativo } : {}),
    };
  }

  async findAll(
    filters: ServicoOpcionalFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ServicoOpcionalResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = this.buildWhere(filters);
    const [data, total] = await prisma.$transaction([
      prisma.servicoOpcional.findMany({
        where,
        skip,
        take,
        orderBy: { nome: "asc" },
      }),
      prisma.servicoOpcional.count({ where }),
    ]);
    return buildPaginatedResult(
      ServicoOpcionalMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<ServicoOpcionalResponse | null> {
    const data = await prisma.servicoOpcional.findUnique({ where: { id } });
    return data ? ServicoOpcionalMapper.toResponse(data) : null;
  }

  async findByIds(
    ids: string[],
    apenasAtivos = true,
  ): Promise<ServicoOpcionalResponse[]> {
    if (ids.length === 0) {
      return [];
    }
    const data = await prisma.servicoOpcional.findMany({
      where: {
        id: { in: ids },
        ...(apenasAtivos ? { ativo: true } : {}),
      },
    });
    return ServicoOpcionalMapper.toManyResponse(data);
  }

  async create(
    data: CreateServicoOpcionalRequest,
  ): Promise<ServicoOpcionalResponse> {
    const servico = await prisma.servicoOpcional.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        valor: data.valor,
        ativo: data.ativo ?? undefined,
      },
    });
    return ServicoOpcionalMapper.toResponse(servico);
  }

  async update(
    id: string,
    data: UpdateServicoOpcionalRequest,
  ): Promise<ServicoOpcionalResponse | null> {
    try {
      const servico = await prisma.servicoOpcional.update({
        where: { id },
        data: {
          nome: data.nome ?? undefined,
          descricao: data.descricao ?? undefined,
          valor: data.valor ?? undefined,
          ativo: data.ativo ?? undefined,
        },
      });
      return ServicoOpcionalMapper.toResponse(servico);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await prisma.servicoOpcional.delete({ where: { id } });
    } catch {
      throw new HttpError(404, "Serviço opcional não encontrado.");
    }
  }
}
