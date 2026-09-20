import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { ICompartilhamentoReservaRepository } from "../compartilhamento.repository.js";
import {
  CompartilhamentoAtivo,
  CompartilhamentoPublico,
} from "../contracts/compartilhamento.contract.js";

const PUBLICO_SELECT = {
  reserva: {
    select: {
      dataHoraInicio: true,
      dataHoraFim: true,
      status: true,
      veiculo: {
        select: {
          modeloVeiculo: { select: { marca: true, modelo: true } },
        },
      },
      garagemRetirada: { select: { nome: true, endereco: true } },
      garagemDevolucao: { select: { nome: true, endereco: true } },
    },
  },
} satisfies Prisma.CompartilhamentoReservaSelect;

type PublicoRecord = Prisma.CompartilhamentoReservaGetPayload<{
  select: typeof PUBLICO_SELECT;
}>;

export class PrismaCompartilhamentoReservaRepository
  implements ICompartilhamentoReservaRepository
{
  async criarOuObterAtivo(
    idReserva: string,
    gerarToken: () => string,
  ): Promise<{ compartilhamento: CompartilhamentoAtivo; criado: boolean }> {
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idReserva}, 0))`;

          const atual = await tx.compartilhamentoReserva.findUnique({
            where: { idReserva },
            select: { token: true, criadoEm: true, revogadoEm: true },
          });
          if (atual && !atual.revogadoEm) {
            return {
              compartilhamento: { token: atual.token, criadoEm: atual.criadoEm },
              criado: false,
            };
          }

          const token = gerarToken();
          const registro = atual
            ? await tx.compartilhamentoReserva.update({
                where: { idReserva },
                data: { token, revogadoEm: null },
                select: { token: true, criadoEm: true },
              })
            : await tx.compartilhamentoReserva.create({
                data: { idReserva, token },
                select: { token: true, criadoEm: true },
              });

          return { compartilhamento: registro, criado: true };
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        throw error;
      }
    }
    throw new HttpError(503, "Não foi possível gerar o compartilhamento.");
  }

  async revogar(idReserva: string): Promise<boolean> {
    const resultado = await prisma.compartilhamentoReserva.updateMany({
      where: { idReserva, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    return resultado.count > 0;
  }

  async findPublicoByToken(token: string): Promise<CompartilhamentoPublico | null> {
    const registro = await prisma.compartilhamentoReserva.findFirst({
      where: { token, revogadoEm: null },
      select: PUBLICO_SELECT,
    });
    if (!registro) return null;
    return this.toPublico(registro);
  }

  private toPublico(registro: PublicoRecord): CompartilhamentoPublico {
    return {
      viagem: {
        dataHoraInicio: registro.reserva.dataHoraInicio,
        dataHoraFim: registro.reserva.dataHoraFim,
        status: registro.reserva.status,
      },
      veiculo: {
        marca: registro.reserva.veiculo.modeloVeiculo.marca,
        modelo: registro.reserva.veiculo.modeloVeiculo.modelo,
      },
      retirada: registro.reserva.garagemRetirada,
      devolucao: registro.reserva.garagemDevolucao,
    };
  }
}
