import { prisma } from "../../database/prisma.js";
import { ILocatarioRepository } from "../locatario.repository.js";
import { HttpError } from "../../errors/HttpError.js";
import {
  CreateLocatarioRequest,
  LocatarioResponse,
  UpdateLocatarioRequest,
} from "../contracts/locatario.contract.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaLocatarioRepository implements ILocatarioRepository {
  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocatarioResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.locatario.findMany({ skip, take, orderBy: { id: "asc" } }),
      prisma.locatario.count(),
    ]);
    return buildPaginatedResult(data, total, pagination);
  }

  async findById(id: string): Promise<LocatarioResponse | null> {
    return prisma.locatario.findUnique({
      where: { id },
    });
  }

  async findByCpf(cpf: string): Promise<LocatarioResponse | null> {
    return prisma.locatario.findUnique({
      where: { cpf },
    });
  }

  async findByCnh(cnh: string): Promise<LocatarioResponse | null> {
    return prisma.locatario.findUnique({
      where: { cnh },
    });
  }

  async create(data: CreateLocatarioRequest): Promise<LocatarioResponse> {
    return prisma.locatario.create({
      data: {
        id: data.id,
        cpf: data.cpf,
        cnh: data.cnh,
        rg: data.rg,
        dataNascimento: data.dataNascimento,
        deficienciaId: data.deficiencia_id ?? null,
      },
    });
  }

  async update(
    id: string,
    data: UpdateLocatarioRequest,
  ): Promise<LocatarioResponse | null> {
    if (
      data.cpf === undefined &&
      data.cnh === undefined &&
      data.rg === undefined &&
      data.dataNascimento === undefined &&
      data.deficiencia_id === undefined
    ) {
      throw new HttpError(400, "Nenhum campo enviado para atualização.");
    }

    try {
      return await prisma.locatario.update({
        where: { id },
        data: {
          cpf: data.cpf ?? undefined,
          cnh: data.cnh ?? undefined,
          rg: data.rg ?? undefined,
          dataNascimento: data.dataNascimento ?? undefined,
          deficienciaId:
            data.deficiencia_id === undefined ? undefined : data.deficiencia_id, // pode ser null ou valor
        },
      });
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.locatario.delete({
      where: { id },
    });
  }
}
