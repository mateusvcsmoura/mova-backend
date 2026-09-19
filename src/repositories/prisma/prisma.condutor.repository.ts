import { CondutorAdicional, Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { ICondutorRepository } from "../condutor.repository.js";
import {
  CondutorResponse,
  CreateCondutorRequest,
  ReservaBloqueadaParaCondutor,
} from "../contracts/condutor.contract.js";

const MAX_CONDUTORES_ADICIONAIS = 3;

function toResponse(c: CondutorAdicional): CondutorResponse {
  return {
    id: c.id,
    idReserva: c.idReserva,
    nome: c.nome,
    cpf: c.cpf,
    cnh: c.cnh,
    criadoEm: c.criadoEm,
  };
}

export class PrismaCondutorRepository implements ICondutorRepository {
  async findByReservaId(idReserva: string): Promise<CondutorResponse[]> {
    const rows = await prisma.condutorAdicional.findMany({
      where: { idReserva },
      orderBy: { criadoEm: "asc" },
    });
    return rows.map(toResponse);
  }

  async findById(id: string): Promise<CondutorResponse | null> {
    const row = await prisma.condutorAdicional.findUnique({ where: { id } });
    return row ? toResponse(row) : null;
  }

  async createWithinLimit(
    data: CreateCondutorRequest,
    validarReserva: (reserva: ReservaBloqueadaParaCondutor) => Promise<void>,
  ): Promise<CondutorResponse> {
    try {
      return await prisma.$transaction(async (tx) => {
        const reservas = await tx.$queryRaw<ReservaBloqueadaParaCondutor[]>(
          Prisma.sql`
            SELECT "id", "idLocatario", "idVeiculo", "status", "dataHoraInicio"
            FROM "Reserva"
            WHERE "id" = ${data.idReserva}::uuid
            FOR UPDATE
          `,
        );
        const reserva = reservas[0];

        if (!reserva) {
          throw new HttpError(404, "Reserva não encontrada");
        }

        await validarReserva(reserva);

        const total = await tx.condutorAdicional.count({
          where: { idReserva: data.idReserva },
        });
        if (total >= MAX_CONDUTORES_ADICIONAIS) {
          throw new HttpError(
            409,
            "Limite de 3 condutores adicionais atingido.",
          );
        }

        const existente = await tx.condutorAdicional.findUnique({
          where: {
            idReserva_cnh: { idReserva: data.idReserva, cnh: data.cnh },
          },
        });
        if (existente) {
          throw new HttpError(
            409,
            "Já existe um condutor com esta CNH nesta reserva.",
          );
        }

        const row = await tx.condutorAdicional.create({
          data: {
            idReserva: data.idReserva,
            nome: data.nome,
            cpf: data.cpf ?? null,
            cnh: data.cnh,
          },
        });
        return toResponse(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new HttpError(409, "Já existe um condutor com esta CNH nesta reserva.");
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.condutorAdicional.delete({ where: { id } });
  }
}
