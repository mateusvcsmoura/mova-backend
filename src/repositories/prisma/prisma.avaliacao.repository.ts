import { prisma } from "../../database/prisma.js";
import { IAvaliacaoRepository } from "../avaliacao.repository.js";
import {
  CreateAvaliacaoRequest,
  AvaliacaoResponse,
} from "../contracts/avaliacao.contract.js";
import { AvaliacaoMapper } from "../mappers/avaliacao.mapper.js";

export class PrismaAvaliacaoRepository implements IAvaliacaoRepository {
  async create(data: CreateAvaliacaoRequest): Promise<AvaliacaoResponse> {
    const avaliacao = await prisma.avaliacao.create({
      data: {
        idReserva: data.idReserva,
        nota: data.nota,
        comentario: data.comentario ?? undefined,
      },
    });
    return AvaliacaoMapper.toResponse(avaliacao);
  }

  async findByReservaId(idReserva: string): Promise<AvaliacaoResponse | null> {
    const data = await prisma.avaliacao.findUnique({ where: { idReserva } });
    return data ? AvaliacaoMapper.toResponse(data) : null;
  }
}
