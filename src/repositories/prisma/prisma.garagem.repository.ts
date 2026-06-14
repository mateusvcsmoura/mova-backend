import { Garagem, Prisma, PrismaClient } from "@prisma/client";

import { HttpError } from "../../errors/HttpError.js";
import { IGaragemRepository } from "../garagem.repository.js";
import {
  CreateGaragemRequest,
  GaragemBaseResponse,
  GaragemDetalhadaResponse,
  GaragemFilters,
  GaragemListResponse,
  GaragemVeiculosFilters,
  UpdateGaragemRequest,
} from "../contracts/garagem.contract.js";
import { VeiculoResponse } from "../contracts/veiculo.contract.js";
import { VeiculoMapper } from "../mappers/veiculo.mapper.js";

type GaragemComLocadorEVeiculos = Prisma.GaragemGetPayload<{
  include: {
    locador: true;
    veiculos: {
      include: {
        modeloVeiculo: true;
      };
    };
  };
}>;

export class PrismaGaragemRepository implements IGaragemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toBaseResponse(garagem: Garagem): GaragemBaseResponse {
    return {
      id: garagem.id,
      idLocador: garagem.idLocador,
      nome: garagem.nome,
      endereco: garagem.endereco,
      capacidade: garagem.capacidade,
      veiculosAlocados: garagem.veiculosAlocados,
      acessibilidade: garagem.acessibilidade,
      criadaEm: garagem.criadaEm,
      atualizadoEm: garagem.atualizadoEm,
    };
  }

  private toDetailedResponse(
    garagem: GaragemComLocadorEVeiculos,
  ): GaragemDetalhadaResponse {
    return {
      ...this.toBaseResponse(garagem),
      locador: {
        id: garagem.locador.id,
        empresa: garagem.locador.empresa,
        cnpj: garagem.locador.cnpj,
      },
      veiculos: VeiculoMapper.toManyResponse(garagem.veiculos),
    };
  }

  private buildWhere(filters: GaragemFilters): Prisma.GaragemWhereInput {
    return {
      ...(filters.acessibilidade !== undefined
        ? { acessibilidade: filters.acessibilidade }
        : {}),
      ...(filters.idLocador ? { idLocador: filters.idLocador } : {}),
      ...(filters.nome
        ? {
            nome: {
              contains: filters.nome,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filters.capacidadeMin !== undefined ||
      filters.capacidadeMax !== undefined
        ? {
            capacidade: {
              ...(filters.capacidadeMin !== undefined
                ? { gte: filters.capacidadeMin }
                : {}),
              ...(filters.capacidadeMax !== undefined
                ? { lte: filters.capacidadeMax }
                : {}),
            },
          }
        : {}),
    };
  }

  async findAll(filters: GaragemFilters): Promise<GaragemListResponse> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, filters.limit ?? 10);
    const where = this.buildWhere(filters);

    const garagems = await this.prisma.garagem.findMany({
      where,
      orderBy: {
        criadaEm: "desc",
      },
    });

    const filtradas = filters.comVagasDisponiveis
      ? garagems.filter(
          (garagem) => garagem.veiculosAlocados < garagem.capacidade,
        )
      : garagems;

    const total = filtradas.length;
    const start = (page - 1) * limit;
    const data = filtradas
      .slice(start, start + limit)
      .map((garagem) => this.toBaseResponse(garagem));

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<GaragemDetalhadaResponse | null> {
    const garagem = await this.prisma.garagem.findUnique({
      where: { id },
      include: {
        locador: true,
        veiculos: {
          include: {
            modeloVeiculo: true,
          },
        },
      },
    });

    return garagem ? this.toDetailedResponse(garagem) : null;
  }

  async findVeiculosByGaragem(
    garagemId: string,
    filters?: GaragemVeiculosFilters,
  ): Promise<VeiculoResponse[]> {
    const garagem = await this.prisma.garagem.findUnique({
      where: { id: garagemId },
      select: { id: true },
    });

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada.");
    }

    const veiculos = await this.prisma.veiculo.findMany({
      where: {
        garagemId,
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        modeloVeiculo: true,
      },
      orderBy: {
        criadoEm: "desc",
      },
    });

    return VeiculoMapper.toManyResponse(veiculos);
  }

  async create(data: CreateGaragemRequest): Promise<GaragemBaseResponse> {
    const garagem = await this.prisma.garagem.create({
      data: {
        idLocador: data.idLocador,
        nome: data.nome,
        endereco: data.endereco,
        capacidade: data.capacidade,
        acessibilidade: data.acessibilidade ?? true,
        veiculosAlocados: 0,
      },
    });

    return this.toBaseResponse(garagem);
  }

  async update(
    id: string,
    data: UpdateGaragemRequest,
  ): Promise<GaragemBaseResponse | null> {
    const hasData = Object.values(data).some((value) => value !== undefined);

    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    try {
      const garagem = await this.prisma.garagem.update({
        where: { id },
        data: {
          nome: data.nome ?? undefined,
          endereco: data.endereco ?? undefined,
          capacidade: data.capacidade ?? undefined,
          acessibilidade: data.acessibilidade ?? undefined,
        },
      });

      return this.toBaseResponse(garagem);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.garagem.delete({
        where: { id },
      });
    } catch {
      throw new HttpError(404, "Garagem não encontrada.");
    }
  }

  async alocarVeiculo(garagemId: string, veiculoId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const garagem = await tx.garagem.findUnique({
        where: { id: garagemId },
        select: {
          id: true,
          capacidade: true,
          veiculosAlocados: true,
        },
      });

      if (!garagem) {
        throw new HttpError(404, "Garagem não encontrada.");
      }

      if (garagem.veiculosAlocados >= garagem.capacidade) {
        throw new HttpError(409, "A garagem já atingiu sua capacidade máxima.");
      }

      const veiculo = await tx.veiculo.findUnique({
        where: { id: veiculoId },
        select: {
          id: true,
          garagemId: true,
        },
      });

      if (!veiculo) {
        throw new HttpError(404, "Veículo não encontrado.");
      }

      if (veiculo.garagemId !== null && veiculo.garagemId !== garagemId) {
        throw new HttpError(409, "O veículo já está alocado em outra garagem.");
      }

      if (veiculo.garagemId === garagemId) {
        throw new HttpError(409, "O veículo já está alocado nesta garagem.");
      }

      await tx.veiculo.update({
        where: { id: veiculoId },
        data: {
          garagemId,
        },
      });

      await tx.garagem.update({
        where: { id: garagemId },
        data: {
          veiculosAlocados: {
            increment: 1,
          },
        },
      });
    });
  }

  async desalocarVeiculo(garagemId: string, veiculoId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const garagem = await tx.garagem.findUnique({
        where: { id: garagemId },
        select: {
          id: true,
          veiculosAlocados: true,
        },
      });

      if (!garagem) {
        throw new HttpError(404, "Garagem não encontrada.");
      }

      const veiculo = await tx.veiculo.findUnique({
        where: { id: veiculoId },
        select: {
          id: true,
          garagemId: true,
        },
      });

      if (!veiculo) {
        throw new HttpError(404, "Veículo não encontrado.");
      }

      if (veiculo.garagemId !== garagemId) {
        throw new HttpError(409, "O veículo não está alocado nesta garagem.");
      }

      await tx.veiculo.update({
        where: { id: veiculoId },
        data: {
          garagemId: null,
        },
      });

      await tx.garagem.update({
        where: { id: garagemId },
        data: {
          veiculosAlocados: {
            decrement: 1,
          },
        },
      });
    });
  }
}
