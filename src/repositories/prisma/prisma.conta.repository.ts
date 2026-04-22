import { prisma } from "../../database/prisma.js";
import { IContaRepository } from "../conta.repository.js";
import {
  ContaResponse,
  CreateContaRequest,
  UpdateContaRequest,
} from "../contracts/conta.contract.js";

export class PrismaContaRepository implements IContaRepository {
  async findAll(): Promise<ContaResponse[]> {
    return prisma.conta.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        criadaEm: true,
        endereco: true,
        cep: true,
        cargo: true
      },
    });
  }

  async findByEmail(email: string): Promise<ContaResponse | null> {
    return prisma.conta.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        criadaEm: true,
        endereco: true,
        cep: true,
        cargo: true
      },
    });
  }

  async findById(id: string): Promise<ContaResponse | null> {
    return prisma.conta.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        criadaEm: true,
        endereco: true,
        cep: true,
        cargo: true
      },
    });
  }

  async findAuthByEmail(email: string) {
    return prisma.conta.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        senhaHash: true,
      },
    });
  }

  async create(data: CreateContaRequest): Promise<ContaResponse> {
    return prisma.conta.create({
      data: {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone ?? null,
        senhaHash: data.senha,
        endereco: data.endereco,
        cep: data.cep,
        cargo: data.cargo
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        criadaEm: true,
        endereco: true,
        cep: true,
        cargo: true
      },
    });
  }

  async update(
    id: string,
    data: UpdateContaRequest,
  ): Promise<ContaResponse | null> {
    try {
      return await prisma.conta.update({
        where: { id },
        data: {
          nome: data.nome ?? undefined,
          telefone: data.telefone ?? undefined,
          endereco: data.endereco ?? undefined,
          cep: data.cep ?? undefined,
          cargo: data.cargo ?? undefined,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          telefone: true,
          criadaEm: true,
          endereco: true,
          cep: true,
          cargo: true
        },
      });
    } catch {
      return null;
    }
  }

  async updatePassword(id: string, senhaHash: string): Promise<void> {
    await prisma.conta.update({
      where: { id },
      data: { senhaHash },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.conta.delete({
      where: { id },
    });
  }
}
