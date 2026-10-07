import { AtorAuditoria, diferenca, registrarAuditoria, snapshotReserva } from "./auditoria.js";
import {
  AcaoAuditoria,
  EntidadeAuditada,
  MetodoPagamento,
  Prisma,
  StatusPagamento,
  StatusReserva,
  TipoCobranca,
  TipoEventoFinanceiroSandbox,
} from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IReservaRepository } from "../reserva.repository.js";
import {
  CreateReservaRequest,
  ReservaFilters,
  ReservaResponse,
  ReservaVeiculoResponse,
  UpdateReservaRequest,
} from "../contracts/reserva.contract.js";
import { ReservaMapper } from "../mappers/reserva.mapper.js";
import { expirarReservaNoTx, expirarReservasVencidas, reservaVencidaWhere } from "./expiracao-reserva.js";
import { verificarReservaOperacional } from "./vehicle-garage-allocation.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

const RESERVA_INCLUDE = {
  servicos: { include: { servico: true } },
  cobrancas: true,
  garagemRetirada: {
    select: { id: true, nome: true, endereco: true, status: true },
  },
  garagemDevolucao: {
    select: { id: true, nome: true, endereco: true, status: true },
  },
  veiculo: { include: { modeloVeiculo: true, garagem: { select: { id: true, nome: true, status: true } }, imagens: { where: { status: "READY" }, orderBy: { ordem: "asc" } } } },
} satisfies Prisma.ReservaInclude;

const RESERVA_VEICULO_SELECT = {
  id: true,
  idVeiculo: true,
  idLocatario: true,
  idGaragemRetirada: true,
  idGaragemDevolucao: true,
  dataHoraInicio: true,
  dataHoraFim: true,
  criadaEm: true,
  valorTotal: true,
  status: true,
  statusPagamento: true,
  metodoPagamento: true,
  codigoGeradoEm: true,
  codigoUsadoEm: true,
  devolvidoEm: true,
  expiradaEm: true,
  atualizadoEm: true,
  servicos: { include: { servico: true } },
  cobrancas: true,
  garagemRetirada: {
    select: { id: true, nome: true, endereco: true, status: true },
  },
  garagemDevolucao: {
    select: { id: true, nome: true, endereco: true, status: true },
  },
  veiculo: { include: { modeloVeiculo: true, garagem: { select: { id: true, nome: true, status: true } }, imagens: { where: { status: "READY" }, orderBy: { ordem: "asc" } } } },
} satisfies Prisma.ReservaSelect;

export class PrismaReservaRepository implements IReservaRepository {
  private overlapWhere(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Prisma.ReservaWhereInput {
    return {
      idVeiculo,
      ...(excludeReservaId ? { id: { not: excludeReservaId } } : {}),
      status: { not: StatusReserva.CANCELADA },
      NOT: reservaVencidaWhere(),
      dataHoraInicio: { lt: dataHoraFim },
      dataHoraFim: { gt: dataHoraInicio },
    };
  }

  expirarReservasVencidas(filtro: Prisma.ReservaWhereInput = {}, agora?: Date): Promise<number> {
    return expirarReservasVencidas(filtro, agora);
  }

  private buildWhere(filters: ReservaFilters): Prisma.ReservaWhereInput {
    return {
      ...(filters.idVeiculo ? { idVeiculo: filters.idVeiculo } : {}),
      ...(filters.idLocatario ? { idLocatario: filters.idLocatario } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.statusPagamento
        ? { statusPagamento: filters.statusPagamento }
        : {}),
      // filtra pelas reservas dos veículos pertencentes ao locador
      ...(filters.idLocador
        ? { veiculo: { idLocador: filters.idLocador } }
        : {}),
    };
  }

  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    await expirarReservasVencidas();
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        skip,
        take,
        orderBy: { criadaEm: "desc" },
        include: RESERVA_INCLUDE,
      }),
      prisma.reserva.count(),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findById(id: string): Promise<ReservaResponse | null> {
    await expirarReservasVencidas({ id });
    const data = await prisma.reserva.findUnique({
      where: { id },
      include: RESERVA_INCLUDE,
    });
    return data ? ReservaMapper.toResponse(data) : null;
  }

  async findByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idLocatario };
    await expirarReservasVencidas(where);
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
        include: RESERVA_INCLUDE,
      }),
      prisma.reserva.count({ where }),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findByVeiculoId(
    idVeiculo: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaVeiculoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idVeiculo };
    await expirarReservasVencidas(where);
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
        select: RESERVA_VEICULO_SELECT,
      }),
      prisma.reserva.count({ where }),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyVeiculoResponse(data),
      total,
      pagination,
    );
  }

  async search(
    filters: ReservaFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ReservaResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = this.buildWhere(filters);
    await expirarReservasVencidas(where);
    const [data, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { criadaEm: "desc" },
        include: RESERVA_INCLUDE,
      }),
      prisma.reserva.count({ where }),
    ]);
    return buildPaginatedResult(
      ReservaMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findByCodigoDesbloqueio(
    codigo: string,
  ): Promise<ReservaResponse | null> {
    const data = await prisma.reserva.findUnique({
      where: { codigoDesbloqueio: codigo },
      include: RESERVA_INCLUDE,
    });
    return data ? ReservaMapper.toResponse(data) : null;
  }

  async create(data: CreateReservaRequest): Promise<ReservaResponse> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.idVeiculo}, 0))`;

      const veiculoAtual = await tx.veiculo.findUnique({
        where: { id: data.idVeiculo },
        select: { garagemId: true, idLocador: true },
      });
      if (!veiculoAtual) throw new HttpError(404, "Veículo não encontrado.");

      for (const idConta of [...new Set([data.idLocatario, veiculoAtual.idLocador])].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`conta:${idConta}`}, 0))`;
      }

      const locatarioAtual = await tx.locatario.findUnique({
        where: { id: data.idLocatario },
        select: { id: true },
      });
      const veiculoBloqueado = await tx.veiculo.findUnique({
        where: { id: data.idVeiculo },
        select: { garagemId: true },
      });
      if (!locatarioAtual) throw new HttpError(404, "Locatário não encontrado.");
      if (!veiculoBloqueado) throw new HttpError(404, "Veículo não encontrado.");
      if (veiculoBloqueado.garagemId !== (data.idGaragemRetirada ?? null)) {
        throw new HttpError(
          409,
          "A garagem de retirada foi alterada. Revise a reserva antes de confirmar.",
          "LOCAL_RETIRADA_ALTERADO",
        );
      }

      const conflitos = await tx.reserva.count({
        where: this.overlapWhere(
          data.idVeiculo,
          data.dataHoraInicio,
          data.dataHoraFim,
        ),
      });
      if (conflitos > 0) {
        throw new HttpError(
          409,
          "O veículo já possui uma reserva nesse período.",
        );
      }

      if (data.deficienciaIdParaAssociar) {
        await tx.locatario.update({
          where: { id: data.idLocatario },
          data: { deficienciaId: data.deficienciaIdParaAssociar },
        });
      }

      const reserva = await tx.reserva.create({
        data: {
          idVeiculo: data.idVeiculo,
          idLocatario: data.idLocatario,
          idGaragemRetirada: data.idGaragemRetirada ?? undefined,
          idGaragemDevolucao: data.idGaragemDevolucao ?? undefined,
          dataHoraInicio: data.dataHoraInicio,
          dataHoraFim: data.dataHoraFim,
          valorTotal: data.valorTotal,
          metodoPagamento: data.metodoPagamento ?? undefined,
          ...(data.servicos && data.servicos.length > 0
            ? {
                servicos: {
                  create: data.servicos.map((s) => ({
                    idServico: s.idServico,
                    valor: s.valor,
                    nome: s.nome,
                    descricao: s.descricao,
                    detalhesCobertura: s.detalhesCobertura ?? null,
                  })),
                },
              }
            : {}),
        },
        include: RESERVA_INCLUDE,
      });
      return ReservaMapper.toResponse(reserva);
    });
  }

  async update(
    id: string,
    data: UpdateReservaRequest,
    ator?: AtorAuditoria,
  ): Promise<ReservaResponse> {
    const hasData = Object.values(data).some((v) => v !== undefined);
    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
        const atual = await tx.reserva.findUnique({
          where: { id },
          select: {
            id: true,
            idVeiculo: true,
            status: true,
            statusPagamento: true,
            dataHoraInicio: true,
            dataHoraFim: true,
          },
        });
        if (!atual) throw new HttpError(404, "Reserva não encontrada.");
        const antes = await this.estadoAuditavel(tx, id);
        if (atual.status === StatusReserva.CANCELADA) {
          throw new HttpError(409, "Reserva cancelada.");
        }
        // Task 11: reserva encerrada é histórico; nada mais é editável.
        if (atual.status === StatusReserva.REALIZADA) {
          throw new HttpError(409, "Reserva já realizada não pode ser alterada.");
        }

        const inicioFinal = data.dataHoraInicio ?? atual.dataHoraInicio;
        const fimFinal = data.dataHoraFim ?? atual.dataHoraFim;
        const alteracaoPeriodo =
          inicioFinal.getTime() !== atual.dataHoraInicio.getTime() ||
          fimFinal.getTime() !== atual.dataHoraFim.getTime();
        if (
          alteracaoPeriodo &&
          (atual.statusPagamento === StatusPagamento.SUCESSO ||
            atual.statusPagamento === StatusPagamento.PROCESSANDO)
        ) {
          throw new HttpError(
            409,
            "Não é possível alterar o período de uma reserva já paga.",
          );
        }

        if (alteracaoPeriodo) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${atual.idVeiculo}, 0))`;
          const conflitos = await tx.reserva.count({
            where: this.overlapWhere(atual.idVeiculo, inicioFinal, fimFinal, id),
          });
          if (conflitos > 0) {
            throw new HttpError(
              409,
              "O veículo já possui uma reserva nesse período.",
            );
          }
        }
      if (data.idGaragemDevolucao) {
        const [garagem] = await tx.$queryRaw<Array<{ status: string }>>`SELECT "status" FROM "Garagem" WHERE "id" = ${data.idGaragemDevolucao}::uuid FOR SHARE`;
        if (!garagem || garagem.status !== "ATIVA") {
          throw new HttpError(409, "O local de devolução não está disponível (garagem inativa ou em manutenção).");
        }
      }
      const atualizacao = await tx.reserva.updateMany({
        where: { id, status: { not: StatusReserva.CANCELADA } },
        data: {
          idGaragemDevolucao: data.idGaragemDevolucao ?? undefined,
          dataHoraInicio: data.dataHoraInicio ?? undefined,
          dataHoraFim: data.dataHoraFim ?? undefined,
          metodoPagamento: data.metodoPagamento ?? undefined,
          ...(data.valorTotalCalculado !== undefined
            ? { valorTotal: data.valorTotalCalculado }
            : {}),
        },
      });
      if (atualizacao.count !== 1) {
        const existente = await tx.reserva.findUnique({ where: { id } });
        if (!existente) throw new HttpError(404, "Reserva não encontrada.");
        throw new HttpError(409, "Código de desbloqueio já utilizado ou reserva inválida.");
      }
      await this.auditar(tx, ator, id, AcaoAuditoria.ALTERACAO, antes);
      const reserva = await tx.reserva.findUniqueOrThrow({
        where: { id },
        include: RESERVA_INCLUDE,
      });
      return ReservaMapper.toResponse(reserva);
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async atualizarStatusPagamento(
    id: string,
    statusPagamento: StatusPagamento,
    metodoPagamento?: MetodoPagamento,
  ): Promise<ReservaResponse> {
    try {
      const { reserva, recusa } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      if (await expirarReservaNoTx(tx, id, new Date())) {
        return {
          reserva: ReservaMapper.toResponse(
            await tx.reserva.findUniqueOrThrow({ where: { id }, include: RESERVA_INCLUDE }),
          ),
          recusa: null,
        };
      }
      const estadoAtual = await tx.reserva.findUnique({
        where: { id },
        include: RESERVA_INCLUDE,
      });
      if (!estadoAtual) throw new HttpError(404, "Reserva não encontrada.");
      if (estadoAtual.status === StatusReserva.CANCELADA) {
        throw new HttpError(409, "Reserva cancelada.");
      }
      if (
        estadoAtual.statusPagamento === StatusPagamento.SUCESSO &&
        statusPagamento !== StatusPagamento.SUCESSO
      ) {
        return { reserva: ReservaMapper.toResponse(estadoAtual), recusa: null };
      }
      let recusa: HttpError | null = null;
      if (statusPagamento === StatusPagamento.SUCESSO && estadoAtual.statusPagamento !== StatusPagamento.SUCESSO) {
        recusa = await verificarReservaOperacional(tx, estadoAtual);
      }
      const statusFinal = recusa ? StatusPagamento.FALHA : statusPagamento;
      const atualizacao = await tx.reserva.updateMany({
        where: { id, status: { not: StatusReserva.CANCELADA } },
        data: {
          statusPagamento: statusFinal,
          metodoPagamento: metodoPagamento ?? undefined,
        },
      });
      if (atualizacao.count !== 1) {
        const existente = await tx.reserva.findUnique({ where: { id } });
        if (!existente) throw new HttpError(404, "Reserva não encontrada.");
        throw new HttpError(409, "Reserva cancelada.");
      }
      const tentativaAtual = await tx.cobrancaReserva.findFirst({
        where: { idReserva: id, tipo: TipoCobranca.PAGAMENTO_RESERVA },
        orderBy: { criadoEm: "desc" },
        select: { id: true, statusPagamento: true },
      });
      if (tentativaAtual && tentativaAtual.statusPagamento !== StatusPagamento.SUCESSO) {
        await tx.cobrancaReserva.update({
          where: { id: tentativaAtual.id },
          data: { statusPagamento: statusFinal, metodoPagamento: metodoPagamento ?? undefined },
        });
      }
      const atualizada = await tx.reserva.findUniqueOrThrow({
        where: { id },
        include: RESERVA_INCLUDE,
      });
      return { reserva: ReservaMapper.toResponse(atualizada), recusa };
      });
      if (recusa) throw recusa;
      return reserva;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async cancelar(id: string, multa: number, provider?: string, ator?: AtorAuditoria): Promise<ReservaResponse> {
    try {
      const reserva = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
        const estadoAtual = await tx.reserva.findUnique({
          where: { id },
          select: { status: true, statusPagamento: true },
        });
        if (!estadoAtual) throw new HttpError(404, "Reserva não encontrada.");
        const antes = await this.estadoAuditavel(tx, id);
        const atualizacao = await tx.reserva.updateMany({
          where: {
            id,
            status: { in: [StatusReserva.AGUARDANDO_PAGAMENTO, StatusReserva.CONFIRMADA] },
          },
          data: { status: StatusReserva.CANCELADA },
        });
        if (atualizacao.count !== 1) {
          throw new HttpError(409, "Reserva já cancelada ou não pode ser cancelada.");
        }
        await tx.cobrancaReserva.create({
          data: {
            idReserva: id,
            tipo: TipoCobranca.CANCELAMENTO,
            valor: multa,
            statusPagamento: multa > 0 && estadoAtual.statusPagamento !== StatusPagamento.SUCESSO
              ? StatusPagamento.AGUARDANDO_PAGAMENTO
              : StatusPagamento.SUCESSO,
          },
        });
        if (estadoAtual.statusPagamento === StatusPagamento.SUCESSO && provider) {
          await tx.eventoFinanceiroSandbox.createMany({
            data: {
              idReserva: id,
              provider: provider.toLowerCase(),
              tipo: TipoEventoFinanceiroSandbox.ESTORNO_SOLICITADO,
              chaveIdempotencia: `cancelamento:${id}:refund-requested`,
            },
            skipDuplicates: true,
          });
        }
        await this.auditar(tx, ator, id, AcaoAuditoria.CANCELAMENTO, antes);
        return tx.reserva.findUniqueOrThrow({
          where: { id },
          include: RESERVA_INCLUDE,
        });
      });
      return ReservaMapper.toResponse(reserva);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async devolver(
    id: string,
    devolvidoEm: Date,
    valorCobranca: number,
    ator?: AtorAuditoria,
  ): Promise<ReservaResponse> {
    // Cobrança (só quando há atraso) + devolvidoEm + REALIZADA numa transação.
    try {
      const reserva = await prisma.$transaction(async (tx) => {
        const antes = await this.estadoAuditavel(tx, id);
        const atualizacao = await tx.reserva.updateMany({
          where: { id, status: StatusReserva.EM_ANDAMENTO, codigoUsadoEm: { not: null }, devolvidoEm: null },
          data: { devolvidoEm, status: StatusReserva.REALIZADA },
        });
        if (atualizacao.count !== 1) throw new HttpError(409, "Reserva já devolvida ou não iniciada.");
        if (valorCobranca > 0) {
          await tx.cobrancaReserva.create({
            data: {
              idReserva: id,
              tipo: TipoCobranca.ATRASO_DEVOLUCAO,
              valor: valorCobranca,
              statusPagamento: StatusPagamento.AGUARDANDO_PAGAMENTO,
            },
          });
        }
        await this.auditar(tx, ator, id, AcaoAuditoria.DEVOLUCAO, antes);
        return tx.reserva.findUniqueOrThrow({
          where: { id },
          include: RESERVA_INCLUDE,
        });
      });
      return ReservaMapper.toResponse(reserva);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  // RN09: estado operacional da reserva (sem PII do locatário) para a auditoria.
  private async estadoAuditavel(tx: Prisma.TransactionClient, id: string) {
    const reserva = await tx.reserva.findUnique({
      where: { id },
      include: { veiculo: { select: { idLocador: true } } },
    });
    return reserva ? { idLocador: reserva.veiculo.idLocador, snapshot: snapshotReserva(reserva) } : null;
  }

  private async auditar(
    tx: Prisma.TransactionClient,
    ator: AtorAuditoria | undefined,
    id: string,
    acao: AcaoAuditoria,
    antes: { idLocador: string; snapshot: ReturnType<typeof snapshotReserva> } | null,
  ): Promise<void> {
    if (!ator || !antes) return;
    const depois = await this.estadoAuditavel(tx, id);
    const diff = diferenca(antes.snapshot, depois?.snapshot ?? {});
    if (Object.keys(diff.depois).length === 0) return;
    await registrarAuditoria(tx, ator, {
      entidade: EntidadeAuditada.RESERVA,
      idEntidade: id,
      idLocador: antes.idLocador,
      acao,
      antes: diff.antes,
      depois: diff.depois,
    });
  }

  async gerarCodigoDesbloqueio(
    id: string,
    codigo: string,
    geradoEm: Date,
    status?: StatusReserva,
  ): Promise<ReservaResponse> {
    try {
      const atualizacao = await prisma.reserva.updateMany({
        where: {
          id,
          codigoDesbloqueio: null,
          status: { not: StatusReserva.CANCELADA },
        },
        data: {
          codigoDesbloqueio: codigo,
          codigoGeradoEm: geradoEm,
          codigoUsadoEm: null,
          ...(status ? { status } : {}),
        },
      });
      const reserva = await prisma.reserva.findUnique({
        where: { id },
        include: RESERVA_INCLUDE,
      });
      if (!reserva) throw new HttpError(404, "Reserva não encontrada.");
      // Outra entrega pode ter vencido a corrida; devolvemos o estado vencedor.
      void atualizacao;
      return ReservaMapper.toResponse(reserva);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async registrarPagamentoIniciado(
    idReserva: string,
    metodoPagamento: MetodoPagamento,
  ): Promise<ReservaResponse> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idReserva}, 0))`;
      const atual = await tx.reserva.findUnique({
        where: { id: idReserva },
        select: { id: true, valorTotal: true, idVeiculo: true, idGaragemRetirada: true, idGaragemDevolucao: true },
      });
      if (!atual) throw new HttpError(404, "Reserva não encontrada.");
      const recusa = await verificarReservaOperacional(tx, atual);
      if (recusa) throw recusa;

      const atualizacao = await tx.reserva.updateMany({
        where: {
          id: idReserva,
          status: { not: StatusReserva.CANCELADA },
          statusPagamento: { in: [StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.FALHA] },
          NOT: reservaVencidaWhere(),
        },
        data: { statusPagamento: StatusPagamento.PROCESSANDO, metodoPagamento },
      });
      if (atualizacao.count !== 1) {
        const vencida = await tx.reserva.count({ where: { id: idReserva, ...reservaVencidaWhere() } });
        if (vencida > 0) {
          throw new HttpError(409, "O prazo de pagamento desta reserva expirou. Faça uma nova reserva.");
        }
        throw new HttpError(409, "Pagamento já está em processamento ou foi aprovado.");
      }
      await tx.cobrancaReserva.create({
        data: {
          idReserva,
          tipo: TipoCobranca.PAGAMENTO_RESERVA,
          // O valor é lido dentro da transação, sob o lock da reserva.
          valor: atual.valorTotal,
          statusPagamento: StatusPagamento.PROCESSANDO,
          metodoPagamento,
        },
      });

      const reserva = await tx.reserva.findUniqueOrThrow({
        where: { id: idReserva },
        include: RESERVA_INCLUDE,
      });

      return ReservaMapper.toResponse(reserva);
    });
  }

  async hasCobrancaFinanceiraPendente(idLocatario: string): Promise<boolean> {
    const count = await prisma.cobrancaReserva.count({
      where: {
        reserva: { idLocatario },
        valor: { gt: 0 },
        tipo: { in: [TipoCobranca.CANCELAMENTO, TipoCobranca.ATRASO_DEVOLUCAO] },
        statusPagamento: {
          in: [StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.PROCESSANDO, StatusPagamento.FALHA],
        },
      },
    });
    return count > 0;
  }

  async marcarCodigoComoUsado(
    id: string,
    usadoEm: Date,
    status?: StatusReserva,
  ): Promise<ReservaResponse> {
    try {
      const atualizacao = await prisma.reserva.updateMany({
        where: { id, codigoUsadoEm: null, status: StatusReserva.CONFIRMADA },
        data: { codigoUsadoEm: usadoEm, ...(status ? { status } : {}) },
      });
      if (atualizacao.count !== 1) {
        const existente = await prisma.reserva.findUnique({ where: { id } });
        if (!existente) throw new HttpError(404, "Reserva não encontrada.");
        throw new HttpError(409, "Código de desbloqueio já utilizado ou reserva inválida.");
      }
      const reserva = await prisma.reserva.findUniqueOrThrow({
        where: { id },
        include: RESERVA_INCLUDE,
      });
      return ReservaMapper.toResponse(reserva);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(404, "Reserva não encontrada.");
    }
  }

  async hasOverlapForVeiculo(
    idVeiculo: string,
    dataHoraInicio: Date,
    dataHoraFim: Date,
    excludeReservaId?: string,
  ): Promise<boolean> {
    const count = await prisma.reserva.count({
      where: this.overlapWhere(
        idVeiculo,
        dataHoraInicio,
        dataHoraFim,
        excludeReservaId,
      ),
    });
    return count > 0;
  }
}
