import { prisma } from "../../database/prisma.js";
import { ILocadorRepository } from "../locador.repository.js";
import {
  CreateLocadorRequest,
  LocadorResponse,
  UpdateLocadorRequest,
} from "../contracts/locador.contract.js";

export class PrismaLocadorRepository implements ILocadorRepository {
  async findAll(): Promise<LocadorResponse[]> {
    return prisma.locador.findMany();
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

  async findByEmpresa(empresa: string): Promise<LocadorResponse[]> {
    return prisma.locador.findMany({
      where: {
        empresa: {
          contains: empresa,
          mode: "insensitive", // equivale ao ILIKE
        },
      },
    });
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
