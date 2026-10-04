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
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

// Carrega os serviços contratados junto com o serviço do catálogo, em uma
// única consulta (evita N+1 ao montar a resposta).
const RESERVA_INCLUDE = {
  servicos: { include: { servico: true } },
  cobrancas: true,
  garagemRetirada: {
    select: { id: true, nome: true, endereco: true, status: true },
  },
  garagemDevolucao: {
    select: { id: true, nome: true, endereco: true, status: true },
  },
  // O cliente precisa identificar o veículo da reserva (marca/modelo/placa)
  // sem uma segunda chamada por item de lista.
  veiculo: { include: { modeloVeiculo: true, garagem: { select: { id: true, nome: true, status: true } }, imagens: { where: { status: "READY" }, orderBy: { ordem: "asc" } } } },
} satisfies Prisma.ReservaInclude;

// Projeção específica da listagem por veículo. A credencial de desbloqueio
// não sai da query desse caso de uso; os fluxos do locatário continuam usando
// RESERVA_INCLUDE para obter o código quando isso é necessário para RF15.
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
  // Colisão clássica de intervalos para um veículo: inicio_existente < fim_novo
  // e fim_existente > inicio_novo. Reservas canceladas não bloqueiam. Extraído
  // para que a checagem otimista (hasOverlapForVeiculo) e a recheca sob lock
  // (create) usem exatamente a mesma regra. Task 10: reserva não paga com o
  // prazo de 15 min vencido também não bloqueia, mesmo antes de ser gravada
  // como expirada.
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
    // Transação + advisory lock por veículo elimina a race de double-booking:
    // a checagem otimista no service roda antes das validações, mas duas
    // requisições concorrentes para o mesmo veículo/período poderiam ambas
    // passar e inserir. Aqui serializamos por veículo (lock liberado no fim da
    // transação) e recheсamos o overlap antes do insert — a última palavra.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.idVeiculo}, 0))`;

      // A movimentação de garagem usa a mesma chave de advisory lock. Assim,
      // o snapshot de retirada não pode ser calculado antes de uma mudança e
      // gravado depois dela: quem perdeu a corrida revisa a reserva.
      const veiculoAtual = await tx.veiculo.findUnique({
        where: { id: data.idVeiculo },
        select: { garagemId: true, idLocador: true },
      });
      if (!veiculoAtual) throw new HttpError(404, "Veículo não encontrado.");

      // Exclusão e criação disputam as mesmas chaves de conta. A ordem
      // canônica evita deadlock entre locatário e locador; a releitura cobre
      // uma exclusão que tenha vencido antes desta transação obter a trava.
      for (const idConta of [...new Set([data.idLocatario, veiculoAtual.idLocador])].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`conta:${idConta}`}, 0))`;
      }

      // PrismaPg executa uma transação em uma conexão. Consultas paralelas
      // nela acionam `pg` com uma query ainda em curso e tornam a suíte
      // intermitente. Preserve a releitura, mas serialize as consultas.
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

      // RN01: associa a deficiência ao perfil do locatário na MESMA transação.
      // Se o create abaixo falhar, esta escrita é revertida (sem efeito órfão).
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
          // status e statusPagamento usam sempre o default do schema
          // (AGUARDANDO_PAGAMENTO): não são entrada do cliente.
          metodoPagamento: data.metodoPagamento ?? undefined,
          // Cria as associações de serviços opcionais na mesma operação,
          // gravando o valor contratado como snapshot.
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
      const atualizacao = await tx.reserva.updateMany({
        // Campos de domínio ficam fora desta operação pública; apenas uma
        // reserva não cancelada pode alterar os dados editáveis.
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
      return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      // D10-05: evento que chega depois do prazo (webhook tardio) encontra a
      // reserva expirada sob o mesmo lock e não a confirma. Quem chamou recebe
      // a reserva CANCELADA e trata como pagamento de reserva cancelada.
      if (await expirarReservaNoTx(tx, id, new Date())) {
        return ReservaMapper.toResponse(
          await tx.reserva.findUniqueOrThrow({ where: { id }, include: RESERVA_INCLUDE }),
        );
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
        return ReservaMapper.toResponse(estadoAtual);
      }
      const atualizacao = await tx.reserva.updateMany({
        where: { id, status: { not: StatusReserva.CANCELADA } },
        data: {
          statusPagamento,
          metodoPagamento: metodoPagamento ?? undefined,
        },
      });
      if (atualizacao.count !== 1) {
        const existente = await tx.reserva.findUnique({ where: { id } });
        if (!existente) throw new HttpError(404, "Reserva não encontrada.");
        throw new HttpError(409, "Reserva cancelada.");
      }
      // O desfecho pertence à tentativa mais recente. Tentativas anteriores
      // (recusadas/expiradas) mantêm o próprio status: uma aprovação nova não
      // pode transformar um FALHA antigo em segunda cobrança confirmada.
      const tentativaAtual = await tx.cobrancaReserva.findFirst({
        where: { idReserva: id, tipo: TipoCobranca.PAGAMENTO_RESERVA },
        orderBy: { criadoEm: "desc" },
        select: { id: true, statusPagamento: true },
      });
      if (tentativaAtual && tentativaAtual.statusPagamento !== StatusPagamento.SUCESSO) {
        await tx.cobrancaReserva.update({
          where: { id: tentativaAtual.id },
          data: { statusPagamento, metodoPagamento: metodoPagamento ?? undefined },
        });
      }
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

  async cancelar(id: string, multa: number, provider?: string, ator?: AtorAuditoria): Promise<ReservaResponse> {
    // Cobrança + transição em uma transação: ou registra a multa E cancela, ou
    // nada. Grava a cobrança mesmo com valor 0 (trilha completa — RN04).
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
            // Reserva já paga: a multa é retida do estorno (PagamentoEstornoService),
            // então nasce quitada — senão seria cobrada duas vezes e ainda
            // bloquearia o locatário pela RN07.
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
    // Cobrança + mudança de estado na mesma transação: ou registra e marca
    // PROCESSANDO, ou não faz nem uma coisa nem outra.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idReserva}, 0))`;
      const atual = await tx.reserva.findUnique({
        where: { id: idReserva },
        select: { id: true, valorTotal: true },
      });
      if (!atual) throw new HttpError(404, "Reserva não encontrada.");

      const atualizacao = await tx.reserva.updateMany({
        where: {
          id: idReserva,
          status: { not: StatusReserva.CANCELADA },
          statusPagamento: { in: [StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.FALHA] },
          // D10-02/D10-03: nova tentativa só dentro do prazo da reserva; a
          // tentativa nunca sobrevive à reserva que ela paga.
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
        // codigoUsadoEm e status mudam na MESMA escrita: nunca existe reserva
        // com código usado que continue CONFIRMADA (nem o inverso).
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
