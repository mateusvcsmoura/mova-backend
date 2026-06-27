import { prisma } from "../../database/prisma.js";
import { ILocadorRepository } from "../locador.repository.js";
import {
  CreateLocadorRequest,
  LocadorResponse,
  UpdateLocadorRequest,
} from "../contracts/locador.contract.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaLocadorRepository implements ILocadorRepository {
  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocadorResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.locador.findMany({ skip, take, orderBy: { empresa: "asc" } }),
      prisma.locador.count(),
    ]);
    return buildPaginatedResult(data, total, pagination);
  }

  async findById(id: string): Promise<LocadorResponse | null> {
    return prisma.locador.findUnique({
      where: { id },
    });
  }

  async findByCnpj(cnpj: string): Promise<LocadorResponse | null> {
    return prisma.locador.findUnique({
      where: { cnpj },
    });
  }

  async findByEmpresa(
    empresa: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocadorResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = {
      empresa: {
        contains: empresa,
        mode: "insensitive" as const, // equivale ao ILIKE
      },
    };
    const [data, total] = await prisma.$transaction([
      prisma.locador.findMany({
        where,
        skip,
        take,
        orderBy: { empresa: "asc" },
      }),
      prisma.locador.count({ where }),
    ]);
    return buildPaginatedResult(data, total, pagination);
  }

  async create(data: CreateLocadorRequest): Promise<LocadorResponse> {
    return prisma.locador.create({
      data: {
        id: data.id,
        empresa: data.empresa,
        cnpj: data.cnpj,
      },
    });
  }

  async update(
    id: string,
    data: UpdateLocadorRequest,
  ): Promise<LocadorResponse | null> {
    try {
      return await prisma.locador.update({
        where: { id },
        data: {
          empresa: data.empresa ?? undefined,
          cnpj: data.cnpj ?? undefined,
        },
      });
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.locador.delete({
      where: { id },
    });
  }
}
