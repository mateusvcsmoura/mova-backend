import { prisma } from "../../database/prisma.js";
import { IDeficienciaRepository } from "../deficiencia.repository.js";
import {
  CreateDeficienciaRequest,
  DeficienciaResponse,
  UpdateDeficienciaRequest,
} from "../contracts/deficiencia.contract.js";

export class PrismaDeficienciaRepository implements IDeficienciaRepository {
  async findAll(): Promise<DeficienciaResponse[]> {
    return prisma.deficiencia.findMany();
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
