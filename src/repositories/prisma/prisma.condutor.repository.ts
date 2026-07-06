import { CondutorAdicional } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { ICondutorRepository } from "../condutor.repository.js";
import {
  CondutorResponse,
  CreateCondutorRequest,
} from "../contracts/condutor.contract.js";

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

  async findByReservaAndCnh(
    idReserva: string,
    cnh: string,
  ): Promise<CondutorResponse | null> {
    const row = await prisma.condutorAdicional.findUnique({
      where: { idReserva_cnh: { idReserva, cnh } },
    });
    return row ? toResponse(row) : null;
  }

  async findById(id: string): Promise<CondutorResponse | null> {
    const row = await prisma.condutorAdicional.findUnique({ where: { id } });
    return row ? toResponse(row) : null;
  }

  async create(data: CreateCondutorRequest): Promise<CondutorResponse> {
    const row = await prisma.condutorAdicional.create({
      data: {
        idReserva: data.idReserva,
        nome: data.nome,
        cpf: data.cpf ?? null,
        cnh: data.cnh,
      },
    });
    return toResponse(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.condutorAdicional.delete({ where: { id } });
  }
}
