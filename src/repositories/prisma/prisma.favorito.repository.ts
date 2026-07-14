import { Prisma, StatusVeiculo } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { IFavoritoRepository } from "../favorito.repository.js";
import {
  CreateFavoritoRequest,
  FavoritoResponse,
} from "../contracts/favorito.contract.js";
import { FavoritoMapper } from "../mappers/favorito.mapper.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

// Carrega o veículo com modelo, locador e garagem atual em uma única consulta
// (evita N+1 ao montar a resposta da listagem).
const FAVORITO_INCLUDE = {
  veiculo: {
    include: {
      modeloVeiculo: true,
      locador: true,
      garagem: true,
    },
  },
} satisfies Prisma.FavoritoInclude;

export class PrismaFavoritoRepository implements IFavoritoRepository {
  async create(data: CreateFavoritoRequest): Promise<FavoritoResponse> {
    const favorito = await prisma.favorito.create({
      data: {
        idLocatario: data.idLocatario,
        idVeiculo: data.idVeiculo,
      },
      include: FAVORITO_INCLUDE,
    });
    return FavoritoMapper.toResponse(favorito);
  }

  async delete(idLocatario: string, idVeiculo: string): Promise<void> {
    await prisma.favorito.delete({
      where: {
        idLocatario_idVeiculo: { idLocatario, idVeiculo },
      },
    });
  }

  async exists(idLocatario: string, idVeiculo: string): Promise<boolean> {
    const favorito = await prisma.favorito.findUnique({
      where: {
        idLocatario_idVeiculo: { idLocatario, idVeiculo },
      },
      select: { id: true },
    });
    return favorito !== null;
  }

  async findByLocatarioAndVeiculo(
    idLocatario: string,
    idVeiculo: string,
  ): Promise<FavoritoResponse | null> {
    const favorito = await prisma.favorito.findUnique({
      where: {
        idLocatario_idVeiculo: { idLocatario, idVeiculo },
      },
      include: FAVORITO_INCLUDE,
    });
    return favorito ? FavoritoMapper.toResponse(favorito) : null;
  }

  async findByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<FavoritoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    // RN08: veículo soft-deleted (INATIVO) sai da lista de favoritos — a linha
    // de favorito é preservada, mas não expõe um veículo removido do catálogo.
    const where: Prisma.FavoritoWhereInput = {
      idLocatario,
      veiculo: { status: { not: StatusVeiculo.INATIVO } },
    };
    const [data, total] = await prisma.$transaction([
      prisma.favorito.findMany({
        where,
        skip,
        take,
        include: FAVORITO_INCLUDE,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.favorito.count({ where }),
    ]);
    return buildPaginatedResult(
      FavoritoMapper.toManyResponse(data),
      total,
      pagination,
    );
  }
}
