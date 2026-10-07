import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IContaRepository } from "../conta.repository.js";
import {
  ContaResponse,
  CreateContaRequest,
  PerfilCadastro,
  PerfilCriado,
  UpdateContaRequest,
} from "../contracts/conta.contract.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaContaRepository implements IContaRepository {
  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ContaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.conta.findMany({
        skip,
        take,
        orderBy: { id: "asc" },
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
      }),
      prisma.conta.count(),
    ]);
    return buildPaginatedResult(data, total, pagination);
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
        cargo: true
      },
    });
  }

  async create(data: CreateContaRequest, perfil: PerfilCadastro = {}): Promise<ContaResponse & PerfilCriado> {
    try {
      return await prisma.$transaction(async (tx) => {
        const conta = await this.criarConta(tx, data);
        const locatario = perfil.locatario
          ? await tx.locatario.create({
              data: {
                id: conta.id,
                cpf: perfil.locatario.cpf,
                cnh: perfil.locatario.cnh,
                rg: perfil.locatario.rg,
                dataNascimento: perfil.locatario.dataNascimento,
                deficienciaId: perfil.locatario.deficiencia_id ?? null,
              },
            })
          : undefined;
        const locador = perfil.locador
          ? await tx.locador.create({
              data: { id: conta.id, empresa: perfil.locador.empresa, cnpj: perfil.locador.cnpj },
            })
          : undefined;
        return { ...conta, ...(locatario ? { locatario } : {}), ...(locador ? { locador } : {}) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Corrida com as checagens prévias do service: a constraint decide.
        if (error.code === "P2002") {
          const alvo = JSON.stringify(error.meta ?? {});
          if (/email/i.test(alvo)) throw new HttpError(409, "Email já em uso");
          if (perfil.locatario) throw new HttpError(409, "Locatário com este CPF ou CNH já existe");
          if (perfil.locador) throw new HttpError(409, "Locador com este CNPJ ou empresa já existe");
          throw new HttpError(409, "Email já em uso");
        }
        if (error.code === "P2003") throw new HttpError(404, "Deficiência não encontrada.");
      }
      throw error;
    }
  }

  private criarConta(tx: Prisma.TransactionClient, data: CreateContaRequest): Promise<ContaResponse> {
    return tx.conta.create({
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

  async deleteIfWithoutReservationHistory(
    id: string,
  ): Promise<"DELETED" | "HAS_HISTORY" | "NOT_FOUND"> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`conta:${id}`}, 0))`;

      const conta = await tx.conta.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!conta) return "NOT_FOUND";

      const total = await tx.reserva.count({
        where: {
          OR: [
            { idLocatario: id },
            { veiculo: { idLocador: id } },
          ],
        },
      });
      if (total > 0) return "HAS_HISTORY";

      await tx.conta.delete({ where: { id } });
      return "DELETED";
    });
  }
}
