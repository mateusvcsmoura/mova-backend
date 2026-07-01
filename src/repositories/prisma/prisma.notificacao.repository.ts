import { StatusNotificacao } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { INotificacaoRepository } from "../notificacao.repository.js";
import {
  NotificacaoResponse,
  RegistrarNotificacaoRequest,
} from "../contracts/notificacao.contract.js";
import { NotificacaoMapper } from "../mappers/notificacao.mapper.js";

export class PrismaNotificacaoRepository implements INotificacaoRepository {
  async registrar(
    data: RegistrarNotificacaoRequest,
  ): Promise<NotificacaoResponse> {
    const notificacao = await prisma.notificacaoReserva.create({
      data: {
        idReserva: data.idReserva,
        destinatario: data.destinatario,
        assunto: data.assunto,
        canal: data.canal ?? undefined,
        status: StatusNotificacao.PENDENTE,
      },
    });
    return NotificacaoMapper.toResponse(notificacao);
  }

  async marcarEnviada(
    id: string,
    enviadaEm: Date,
  ): Promise<NotificacaoResponse> {
    try {
      const notificacao = await prisma.notificacaoReserva.update({
        where: { id },
        data: {
          status: StatusNotificacao.ENVIADA,
          enviadaEm,
          mensagemErro: null,
        },
      });
      return NotificacaoMapper.toResponse(notificacao);
    } catch {
      throw new HttpError(404, "Notificação não encontrada.");
    }
  }

  async marcarFalha(
    id: string,
    mensagemErro: string,
  ): Promise<NotificacaoResponse> {
    try {
      const notificacao = await prisma.notificacaoReserva.update({
        where: { id },
        data: {
          status: StatusNotificacao.FALHA,
          mensagemErro,
        },
      });
      return NotificacaoMapper.toResponse(notificacao);
    } catch {
      throw new HttpError(404, "Notificação não encontrada.");
    }
  }

  async findByReserva(idReserva: string): Promise<NotificacaoResponse[]> {
    const notificacoes = await prisma.notificacaoReserva.findMany({
      where: { idReserva },
      orderBy: { criadaEm: "desc" },
    });
    return NotificacaoMapper.toManyResponse(notificacoes);
  }
}
