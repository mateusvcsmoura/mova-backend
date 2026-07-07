import { CanalNotificacao, TipoNotificacao } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import {
  DefinirPreferenciaInput,
  IPreferenciaNotificacaoRepository,
  PreferenciaNotificacaoResponse,
} from "../preferencia-notificacao.repository.js";

export class PrismaPreferenciaNotificacaoRepository
  implements IPreferenciaNotificacaoRepository
{
  async listarPorConta(
    idConta: string,
  ): Promise<PreferenciaNotificacaoResponse[]> {
    return prisma.preferenciaNotificacao.findMany({
      where: { idConta },
      orderBy: [{ tipo: "asc" }, { canal: "asc" }],
    });
  }

  async definir(
    input: DefinirPreferenciaInput,
  ): Promise<PreferenciaNotificacaoResponse> {
    return prisma.preferenciaNotificacao.upsert({
      where: {
        idConta_canal_tipo: {
          idConta: input.idConta,
          canal: input.canal,
          tipo: input.tipo,
        },
      },
      create: {
        idConta: input.idConta,
        canal: input.canal,
        tipo: input.tipo,
        habilitado: input.habilitado,
      },
      update: { habilitado: input.habilitado },
    });
  }

  async estaHabilitada(
    idConta: string,
    canal: CanalNotificacao,
    tipo: TipoNotificacao,
  ): Promise<boolean> {
    const pref = await prisma.preferenciaNotificacao.findUnique({
      where: { idConta_canal_tipo: { idConta, canal, tipo } },
    });
    // Opt-in por padrão: sem preferência registrada => habilitado.
    return pref?.habilitado ?? true;
  }
}
