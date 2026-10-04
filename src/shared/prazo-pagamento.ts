// Task 10 (D10-02/D10-03): prazo ÚNICO de pagamento. Uma reserva
// AGUARDANDO_PAGAMENTO retém o veículo, e uma tentativa PROCESSANDO vale, por
// no máximo 15 minutos. É uma regra de negócio, não configuração de ambiente.
//
// Instantes absolutos (Date/epoch), sem fuso: o TTL não depende de
// America/Sao_Paulo. `agora` é injetável para os testes não esperarem 15 min.
export const PRAZO_PAGAMENTO_MINUTOS = 15;
export const PRAZO_PAGAMENTO_MS = PRAZO_PAGAMENTO_MINUTOS * 60 * 1000;

/** Instante em que vence o prazo de algo iniciado em `inicio`. */
export const prazoPagamentoVenceEm = (inicio: Date): Date =>
  new Date(inicio.getTime() + PRAZO_PAGAMENTO_MS);

/** Limite exato já é vencido: válido enquanto agora < início + 15 min. */
export const prazoPagamentoVencido = (inicio: Date, agora: Date = new Date()): boolean =>
  agora.getTime() >= prazoPagamentoVenceEm(inicio).getTime();

/** Corte para consultas: o que começou em ou antes deste instante venceu. */
export const inicioVencidoAte = (agora: Date = new Date()): Date =>
  new Date(agora.getTime() - PRAZO_PAGAMENTO_MS);
