import { prisma } from "../../database/prisma.js";
import { Prisma } from "@prisma/client";
import { HttpError } from "../../errors/HttpError.js";
import { IAvaliacaoRepository } from "../avaliacao.repository.js";
import {
  CreateAvaliacaoRequest,
  AvaliacaoResponse,
} from "../contracts/avaliacao.contract.js";
import { AvaliacaoMapper } from "../mappers/avaliacao.mapper.js";

export class PrismaAvaliacaoRepository implements IAvaliacaoRepository {
  async create(data: CreateAvaliacaoRequest): Promise<AvaliacaoResponse> {
    try {
      const avaliacao = await prisma.avaliacao.create({
        data: {
          idReserva: data.idReserva,
          nota: data.nota,
          comentario: data.comentario ?? undefined,
        },
      });
      return AvaliacaoMapper.toResponse(avaliacao);
    } catch (error) {
      // A regra de service cobre a repetição normal. A constraint única também
      // protege duas requisições simultâneas para a mesma reserva.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "Esta reserva já possui uma avaliação.");
      }
      throw error;
    }
  }

  async findByReservaId(idReserva: string): Promise<AvaliacaoResponse | null> {
    const data = await prisma.avaliacao.findUnique({ where: { idReserva } });
    return data ? AvaliacaoMapper.toResponse(data) : null;
  }
}
