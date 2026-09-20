import { Cargo, StatusPagamento, TipoCobranca } from "@prisma/client";
import { prisma } from "../database/prisma.js";
import { HttpError } from "../errors/HttpError.js";
import { DadosPagamentoSandbox, decidirDesfechoSandbox } from "../infra/payment/sandbox.js";

type Access = { id: string; cargo: Cargo };
const PENDENTES = [StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.PROCESSANDO, StatusPagamento.FALHA];
const TIPOS = [TipoCobranca.CANCELAMENTO, TipoCobranca.ATRASO_DEVOLUCAO];

const resposta = (c: { id: string; idReserva: string; tipo: TipoCobranca; valor: unknown; statusPagamento: StatusPagamento; metodoPagamento: unknown; criadoEm: Date; atualizadoEm: Date }) => ({
  id: c.id, idReserva: c.idReserva, tipo: c.tipo, valor: Number(c.valor), statusPagamento: c.statusPagamento,
  metodoPagamento: c.metodoPagamento, criadoEm: c.criadoEm, atualizadoEm: c.atualizadoEm,
});

export class CobrancaService {
  async listarPendentes(requester: Access) {
    if (requester.cargo !== Cargo.LOCATARIO) throw new HttpError(403, "Acesso negado");
    const itens = await prisma.cobrancaReserva.findMany({
      where: { tipo: { in: TIPOS }, statusPagamento: { in: PENDENTES }, reserva: { idLocatario: requester.id } },
      orderBy: { criadoEm: "desc" },
    });
    return itens.map(resposta);
  }

  async pagar(id: string, dados: DadosPagamentoSandbox, requester: Access) {
    if (requester.cargo !== Cargo.LOCATARIO) throw new HttpError(403, "Acesso negado");
    const cobranca = await prisma.cobrancaReserva.findFirst({ where: { id, tipo: { in: TIPOS }, reserva: { idLocatario: requester.id } } });
    if (!cobranca) throw new HttpError(404, "Cobrança não encontrada");
    if (cobranca.statusPagamento === StatusPagamento.SUCESSO) return { cobranca: resposta(cobranca), idempotente: true };
    const desfecho = decidirDesfechoSandbox(dados);
    const inicio = await prisma.cobrancaReserva.updateMany({
      where: { id, statusPagamento: { in: [StatusPagamento.AGUARDANDO_PAGAMENTO, StatusPagamento.FALHA] } },
      data: { statusPagamento: StatusPagamento.PROCESSANDO, metodoPagamento: dados.metodoPagamento },
    });
    if (inicio.count !== 1) throw new HttpError(409, "Pagamento já está em processamento.");
    const atualizada = await prisma.cobrancaReserva.update({
      where: { id }, data: { statusPagamento: desfecho, metodoPagamento: dados.metodoPagamento },
    });
    return { cobranca: resposta(atualizada), idempotente: false };
  }
}
