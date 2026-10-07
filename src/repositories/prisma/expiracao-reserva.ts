import { Prisma, StatusPagamento, StatusReserva, TipoCobranca } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { inicioVencidoAte } from "../../shared/prazo-pagamento.js";

export const reservaVencidaWhere = (agora: Date = new Date()): Prisma.ReservaWhereInput => ({
  status: StatusReserva.AGUARDANDO_PAGAMENTO,
  statusPagamento: { not: StatusPagamento.SUCESSO },
  criadaEm: { lte: inicioVencidoAte(agora) },
});

export async function expirarReservaNoTx(
  tx: Prisma.TransactionClient,
  id: string,
  agora: Date,
): Promise<boolean> {
  const expirada = await tx.reserva.updateMany({
    where: { id, ...reservaVencidaWhere(agora) },
    data: { status: StatusReserva.CANCELADA, expiradaEm: agora },
  });
  if (expirada.count !== 1) return false;
  // A tentativa em andamento deixa de valer: nenhuma cobrança fica confirmada.
  await tx.reserva.updateMany({
    where: { id, statusPagamento: StatusPagamento.PROCESSANDO },
    data: { statusPagamento: StatusPagamento.FALHA },
  });
  await tx.cobrancaReserva.updateMany({
    where: { idReserva: id, tipo: TipoCobranca.PAGAMENTO_RESERVA, statusPagamento: StatusPagamento.PROCESSANDO },
    data: { statusPagamento: StatusPagamento.FALHA },
  });
  return true;
}

export async function expirarReservasVencidas(
  filtro: Prisma.ReservaWhereInput = {},
  agora: Date = new Date(),
): Promise<number> {
  const vencidas = await prisma.reserva.findMany({
    where: { AND: [filtro, reservaVencidaWhere(agora)] },
    select: { id: true },
  });
  let total = 0;
  for (const { id } of vencidas) {
    const expirou = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
      return expirarReservaNoTx(tx, id, agora);
    });
    if (expirou) total += 1;
  }
  return total;
}
