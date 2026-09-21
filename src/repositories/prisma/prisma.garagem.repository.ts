import { Garagem, Prisma, PrismaClient, StatusGaragem } from "@prisma/client";

import { HttpError } from "../../errors/HttpError.js";
import { IGaragemRepository } from "../garagem.repository.js";
import {
  CreateGaragemRequest,
  GaragemBaseResponse,
  GaragemDetalhadaResponse,
  GaragemFilters,
  GaragemVeiculosFilters,
  UpdateGaragemRequest,
} from "../contracts/garagem.contract.js";
import { VeiculoResponse } from "../contracts/veiculo.contract.js";
import { VeiculoMapper } from "../mappers/veiculo.mapper.js";
import { prisma } from "../../database/prisma.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";
import {
  assertGarageCapacityUpdate,
  desalocarVehicleInTransaction,
  moveVehicleInTransaction,
} from "./vehicle-garage-allocation.js";

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

  private toBaseResponse(garagem: Garagem): GaragemBaseResponse {
    return {
      id: garagem.id,
      idLocador: garagem.idLocador,
      nome: garagem.nome,
      endereco: garagem.endereco,
      capacidade: garagem.capacidade,
      veiculosAlocados: garagem.veiculosAlocados,
      acessibilidade: garagem.acessibilidade,
      status: garagem.status,
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
      ...(filters.status ? { status: filters.status } : {}),
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

  async findAll(
    filters: GaragemFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<GaragemBaseResponse>> {
    const where = this.buildWhere(filters);
    const { skip, take } = toSkipTake(pagination);

    // comVagasDisponiveis compara duas colunas (veiculosAlocados < capacidade),
    // o que o Prisma não expressa no `where`; nesse caso filtra/pagina em memória.
    if (filters.comVagasDisponiveis) {
      const garagems = await prisma.garagem.findMany({
        where,
        orderBy: { criadaEm: "desc" },
      });
      const filtradas = garagems.filter(
        (garagem) => garagem.veiculosAlocados < garagem.capacidade,
      );
      const data = filtradas
        .slice(skip, skip + take)
        .map((garagem) => this.toBaseResponse(garagem));
      return buildPaginatedResult(data, filtradas.length, pagination);
    }

    const [garagems, total] = await prisma.$transaction([
      prisma.garagem.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
      }),
      prisma.garagem.count({ where }),
    ]);

    return buildPaginatedResult(
      garagems.map((garagem) => this.toBaseResponse(garagem)),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<GaragemDetalhadaResponse | null> {
    const garagem = await prisma.garagem.findUnique({
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
    pagination: PaginationParams,
    filters?: GaragemVeiculosFilters,
  ): Promise<PaginatedResult<VeiculoResponse>> {
    const garagem = await prisma.garagem.findUnique({
      where: { id: garagemId },
      select: { id: true },
    });

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada.");
    }

    const { skip, take } = toSkipTake(pagination);
    const where = {
      garagemId,
      ...(filters?.status ? { status: filters.status } : {}),
    };

    const [veiculos, total] = await prisma.$transaction([
      prisma.veiculo.findMany({
        where,
        skip,
        take,
        include: {
          modeloVeiculo: true,
        },
        orderBy: {
          criadoEm: "desc",
        },
      }),
      prisma.veiculo.count({ where }),
    ]);

    return buildPaginatedResult(
      VeiculoMapper.toManyResponse(veiculos),
      total,
      pagination,
    );
  }

  async create(data: CreateGaragemRequest): Promise<GaragemBaseResponse> {
    const garagem = await prisma.garagem.create({
      data: {
        idLocador: data.idLocador,
        nome: data.nome,
        endereco: data.endereco,
        capacidade: data.capacidade,
        acessibilidade: data.acessibilidade ?? true,
        status: data.status ?? undefined,
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
      const garagem = await prisma.$transaction(async (tx) => {
        // Toda edição serializa com alocações/movimentações na mesma linha da
        // garagem. Assim uma troca para MANUTENCAO/INATIVA não corre em
        // paralelo com uma alocação que ainda enxerga o status anterior.
        await assertGarageCapacityUpdate(tx, id, data.capacidade);

        return tx.garagem.update({
          where: { id },
          data: {
            nome: data.nome ?? undefined,
            endereco: data.endereco ?? undefined,
            capacidade: data.capacidade ?? undefined,
            acessibilidade: data.acessibilidade ?? undefined,
            status: data.status ?? undefined,
          },
        });
      });

      return this.toBaseResponse(garagem);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return null;
    }
  }

  // Soft delete (RF19): desativa a garagem em vez de removê-la, preservando o
  // histórico (veículos alocados, reservas passadas). Garagem INATIVA não
  // aparece para novas reservas (regra no ReservaService).
  async delete(id: string): Promise<void> {
    try {
      await prisma.garagem.update({
        where: { id },
        data: { status: StatusGaragem.INATIVA },
      });
    } catch {
      throw new HttpError(404, "Garagem não encontrada.");
    }
  }

  async alocarVeiculo(garagemId: string, veiculoId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await moveVehicleInTransaction(tx, veiculoId, garagemId);
    });
  }

  async desalocarVeiculo(garagemId: string, veiculoId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await desalocarVehicleInTransaction(tx, garagemId, veiculoId);
    });
  }
}
