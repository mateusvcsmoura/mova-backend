import { Prisma, StatusInteresse } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IInteresseVeiculoRepository } from "../interesse.repository.js";
import {
  CreateInteresseRequest,
  InteressadoResponse,
  InteresseResponse,
} from "../contracts/interesse.contract.js";
import { InteresseMapper } from "../mappers/interesse.mapper.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

// Carrega o veículo com modelo, locador e garagem atual em uma única consulta
// (evita N+1 ao montar a resposta da listagem).
const INTERESSE_INCLUDE = {
  veiculo: {
    include: {
      modeloVeiculo: true,
      locador: true,
      garagem: true,
    },
  },
} satisfies Prisma.InteresseVeiculoInclude;

export class PrismaInteresseVeiculoRepository
  implements IInteresseVeiculoRepository
{
  async create(data: CreateInteresseRequest): Promise<InteresseResponse> {
    const interesse = await prisma.interesseVeiculo.create({
      data: {
        idLocatario: data.idLocatario,
        idVeiculo: data.idVeiculo,
      },
      include: INTERESSE_INCLUDE,
    });
    return InteresseMapper.toResponse(interesse);
  }

  async reativar(id: string): Promise<InteresseResponse> {
    try {
      const interesse = await prisma.interesseVeiculo.update({
        where: { id },
        data: {
          status: StatusInteresse.ATIVO,
          // Renova o consentimento e limpa os encerramentos anteriores.
          optInEm: new Date(),
          canceladoEm: null,
          notificadoEm: null,
        },
        include: INTERESSE_INCLUDE,
      });
      return InteresseMapper.toResponse(interesse);
    } catch {
      throw new HttpError(404, "Inscrição de interesse não encontrada.");
    }
  }

  async cancelar(id: string): Promise<void> {
    try {
      await prisma.interesseVeiculo.update({
        where: { id },
        data: {
          status: StatusInteresse.CANCELADO,
          canceladoEm: new Date(),
        },
      });
    } catch {
      throw new HttpError(404, "Inscrição de interesse não encontrada.");
    }
  }

  async marcarNotificado(id: string, notificadoEm: Date): Promise<void> {
    try {
      await prisma.interesseVeiculo.update({
        where: { id },
        data: {
          status: StatusInteresse.NOTIFICADO,
          notificadoEm,
        },
      });
    } catch {
      throw new HttpError(404, "Inscrição de interesse não encontrada.");
    }
  }

  async findByLocatarioAndVeiculo(
    idLocatario: string,
    idVeiculo: string,
  ): Promise<InteresseResponse | null> {
    const interesse = await prisma.interesseVeiculo.findUnique({
      where: {
        idLocatario_idVeiculo: { idLocatario, idVeiculo },
      },
      include: INTERESSE_INCLUDE,
    });
    return interesse ? InteresseMapper.toResponse(interesse) : null;
  }

  async findAtivosByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<InteresseResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idLocatario, status: StatusInteresse.ATIVO };
    const [data, total] = await prisma.$transaction([
      prisma.interesseVeiculo.findMany({
        where,
        skip,
        take,
        include: INTERESSE_INCLUDE,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.interesseVeiculo.count({ where }),
    ]);
    return buildPaginatedResult(
      InteresseMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findAtivosByVeiculo(
    idVeiculo: string,
  ): Promise<InteressadoResponse[]> {
    // Usa o índice composto (idVeiculo, status) e resolve o destinatário
    // (Locatario -> Conta) no mesmo round-trip — sem N+1 no disparo.
    const interessados = await prisma.interesseVeiculo.findMany({
      where: { idVeiculo, status: StatusInteresse.ATIVO },
      include: {
        locatario: {
          include: { conta: { select: { nome: true, email: true } } },
        },
      },
      orderBy: { criadoEm: "asc" },
    });
    return InteresseMapper.toManyInteressadoResponse(interessados);
  }
}
