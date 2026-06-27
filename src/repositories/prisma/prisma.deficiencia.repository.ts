import { prisma } from "../../database/prisma.js";
import { IDeficienciaRepository } from "../deficiencia.repository.js";
import {
  CreateDeficienciaRequest,
  DeficienciaResponse,
  UpdateDeficienciaRequest,
} from "../contracts/deficiencia.contract.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaDeficienciaRepository implements IDeficienciaRepository {
  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<DeficienciaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.deficiencia.findMany({ skip, take, orderBy: { id: "asc" } }),
      prisma.deficiencia.count(),
    ]);
    return buildPaginatedResult(data, total, pagination);
  }

  async findById(id: string): Promise<DeficienciaResponse | null> {
    return prisma.deficiencia.findUnique({
      where: { id },
    });
  }

  async findByDescription(
    descricao: string,
  ): Promise<DeficienciaResponse | null> {
    return prisma.deficiencia.findFirst({
      where: { descricao },
    });
  }

  async create(data: CreateDeficienciaRequest): Promise<DeficienciaResponse> {
    return prisma.deficiencia.create({
      data: {
        descricao: data.descricao,
      },
    });
  }

  async update(
    id: string,
    data: UpdateDeficienciaRequest,
  ): Promise<DeficienciaResponse | null> {
    try {
      return await prisma.deficiencia.update({
        where: { id },
        data: {
          descricao: data.descricao,
        },
      });
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.deficiencia.delete({
      where: { id },
    });
  }
}
