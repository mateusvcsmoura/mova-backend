import { StatusNotificacao } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { INotificacaoInteresseRepository } from "../notificacao-interesse.repository.js";
import {
  NotificacaoInteresseResponse,
  RegistrarNotificacaoInteresseRequest,
} from "../contracts/notificacao-interesse.contract.js";
import { NotificacaoInteresseMapper } from "../mappers/notificacao-interesse.mapper.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaNotificacaoInteresseRepository
  implements INotificacaoInteresseRepository
{
  async registrar(
    data: RegistrarNotificacaoInteresseRequest,
  ): Promise<NotificacaoInteresseResponse> {
    const notificacao = await prisma.notificacaoInteresse.create({
      data: {
        idInteresse: data.idInteresse,
        destinatario: data.destinatario,
        assunto: data.assunto,
        canal: data.canal ?? undefined,
        status: StatusNotificacao.PENDENTE,
      },
    });
    return NotificacaoInteresseMapper.toResponse(notificacao);
  }

  async marcarEnviada(
    id: string,
    enviadaEm: Date,
  ): Promise<NotificacaoInteresseResponse> {
    try {
      const notificacao = await prisma.notificacaoInteresse.update({
        where: { id },
        data: {
          status: StatusNotificacao.ENVIADA,
          enviadaEm,
          mensagemErro: null,
        },
      });
      return NotificacaoInteresseMapper.toResponse(notificacao);
    } catch {
      throw new HttpError(404, "Notificação não encontrada.");
    }
  }

  async marcarFalha(
    id: string,
    mensagemErro: string,
  ): Promise<NotificacaoInteresseResponse> {
    try {
      const notificacao = await prisma.notificacaoInteresse.update({
        where: { id },
        data: {
          status: StatusNotificacao.FALHA,
          mensagemErro,
        },
      });
      return NotificacaoInteresseMapper.toResponse(notificacao);
    } catch {
      throw new HttpError(404, "Notificação não encontrada.");
    }
  }

  async findByInteresse(
    idInteresse: string,
  ): Promise<NotificacaoInteresseResponse[]> {
    const notificacoes = await prisma.notificacaoInteresse.findMany({
      where: { idInteresse },
      orderBy: { criadaEm: "desc" },
    });
    return NotificacaoInteresseMapper.toManyResponse(notificacoes);
  }

  async findByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<NotificacaoInteresseResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { interesse: { idLocatario } };
    const [data, total] = await prisma.$transaction([
      prisma.notificacaoInteresse.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
      }),
      prisma.notificacaoInteresse.count({ where }),
    ]);
    return buildPaginatedResult(
      NotificacaoInteresseMapper.toManyResponse(data),
      total,
      pagination,
    );
  }
}
