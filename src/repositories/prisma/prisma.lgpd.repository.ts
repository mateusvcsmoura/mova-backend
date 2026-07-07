import crypto from "node:crypto";

import { prisma } from "../../database/prisma.js";
import {
  AcessoDadoPessoalResponse,
  DadosPessoaisExport,
  ILgpdRepository,
  RegistrarAcessoInput,
} from "../lgpd.repository.js";

export class PrismaLgpdRepository implements ILgpdRepository {
  async exportarDadosPessoais(
    idConta: string,
  ): Promise<DadosPessoaisExport | null> {
    const conta = await prisma.conta.findUnique({
      where: { id: idConta },
      include: {
        locatario: { include: { reservas: true } },
        locador: true,
      },
    });
    if (!conta) return null;

    return {
      conta: {
        id: conta.id,
        nome: conta.nome,
        email: conta.email,
        telefone: conta.telefone,
        cargo: conta.cargo,
        cep: conta.cep,
        endereco: conta.endereco,
        criadaEm: conta.criadaEm,
        anonimizadoEm: conta.anonimizadoEm,
      },
      locatario: conta.locatario
        ? {
            cpf: conta.locatario.cpf,
            cnh: conta.locatario.cnh,
            rg: conta.locatario.rg,
            dataNascimento: conta.locatario.dataNascimento,
          }
        : null,
      locador: conta.locador
        ? { empresa: conta.locador.empresa, cnpj: conta.locador.cnpj }
        : null,
      reservas: (conta.locatario?.reservas ?? []).map((r) => ({
        id: r.id,
        dataHoraInicio: r.dataHoraInicio,
        dataHoraFim: r.dataHoraFim,
        status: r.status,
        statusPagamento: r.statusPagamento,
        valorTotal: Number(r.valorTotal),
        criadaEm: r.criadaEm,
      })),
    };
  }

  async anonimizarConta(idConta: string): Promise<boolean> {
    const conta = await prisma.conta.findUnique({ where: { id: idConta } });
    if (!conta) return false;

    // Já anonimizada: idempotente, não faz nada.
    if (conta.anonimizadoEm) return true;

    // Token estável e único por conta para satisfazer os @unique (email/cpf/
    // cnh/cnpj) sem colidir com contas reais.
    const tag = idConta;
    // senhaHash aleatória invalida o login (não corresponde a bcrypt de nada).
    const senhaMorta = crypto.randomBytes(32).toString("hex");

    await prisma.$transaction([
      prisma.conta.update({
        where: { id: idConta },
        data: {
          nome: "Usuário anonimizado",
          email: `anon-${tag}@anonimizado.local`,
          telefone: null,
          cep: "00000-000",
          endereco: "[removido]",
          senhaHash: senhaMorta,
          anonimizadoEm: new Date(),
        },
      }),
      // updateMany (0 ou 1 linha): não falha quando o perfil não existe.
      prisma.locatario.updateMany({
        where: { id: idConta },
        data: {
          cpf: `anon-${tag}`,
          cnh: `anon-${tag}`,
          rg: "[removido]",
          dataNascimento: new Date("1900-01-01T00:00:00.000Z"),
        },
      }),
      prisma.locador.updateMany({
        where: { id: idConta },
        data: {
          empresa: "[removido]",
          cnpj: `anon-${tag}`,
        },
      }),
    ]);

    return true;
  }

  async registrarAcesso(input: RegistrarAcessoInput): Promise<void> {
    await prisma.acessoDadoPessoal.create({
      data: {
        idTitular: input.idTitular,
        idAutor: input.idAutor,
        acao: input.acao,
        detalhe: input.detalhe,
      },
    });
  }

  async listarAcessos(
    idTitular: string,
  ): Promise<AcessoDadoPessoalResponse[]> {
    return prisma.acessoDadoPessoal.findMany({
      where: { idTitular },
      orderBy: { criadoEm: "desc" },
    });
  }
}
