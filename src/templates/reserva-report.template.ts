import {
  ReservaReportContent,
  ReservaReportPayload,
} from "../services/contracts/reserva-report.js";

// Template do relatório de reserva. Função pura: recebe o payload e devolve o
// conteúdo (assunto + HTML + texto). Mantido fora dos services para que o HTML
// não seja concatenado dentro da regra de negócio e para facilitar manutenção.
// Para adicionar PDF no futuro, basta um novo módulo que consuma o mesmo
// ReservaReportPayload — sem tocar no builder nem no envio.

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const formatMoney = (valor: number): string => BRL.format(valor);
const formatDate = (data: Date): string => DATA_HORA.format(data);

// Escapa texto para uso seguro dentro do HTML (dados vêm do banco/usuário).
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Id curto para o assunto/título (primeiro bloco do UUID).
const shortId = (id: string): string => id.split("-")[0].toUpperCase();

export function renderReservaReport(
  payload: ReservaReportPayload,
): ReservaReportContent {
  const { reserva, veiculo, locador, locatario, retirada, devolucao, servicos } =
    payload;

  const subject = `Relatório da sua reserva #${shortId(reserva.id)}`;

  const servicosLinhasHtml =
    servicos.length > 0
      ? servicos
          .map(
            (s) => `
          <tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(
              s.nome,
            )}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666;">${escapeHtml(
              s.descricao,
            )}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${formatMoney(
              s.valor,
            )}</td>
          </tr>`,
          )
          .join("")
      : `<tr><td colspan="3" style="padding:4px 8px;color:#666;">Nenhum serviço adicional contratado.</td></tr>`;

  const retiradaHtml = retirada
    ? `${escapeHtml(retirada.garagem)} — ${escapeHtml(retirada.endereco)}`
    : "Não informado";
  const devolucaoHtml = devolucao
    ? `${escapeHtml(devolucao.garagem)} — ${escapeHtml(devolucao.endereco)}`
    : "Não informado";

  const codigoHtml = reserva.codigoDesbloqueio
    ? `<p style="font-size:16px;"><strong>Código de desbloqueio:</strong>
        <span style="font-family:monospace;letter-spacing:1px;">${escapeHtml(
          reserva.codigoDesbloqueio,
        )}</span></p>`
    : "";

  const html = `<!-- Relatório de reserva Mova -->
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
  <h1 style="font-size:20px;">Reserva confirmada 🎉</h1>
  <p>Olá, ${escapeHtml(locatario.nome)}! Aqui está o relatório da sua reserva.</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Dados da reserva</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 8px;">Reserva</td><td style="padding:4px 8px;text-align:right;">#${escapeHtml(
      reserva.id,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">Criada em</td><td style="padding:4px 8px;text-align:right;">${formatDate(
      reserva.criadaEm,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">Status</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(
      reserva.status,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">Período</td><td style="padding:4px 8px;text-align:right;">${formatDate(
      reserva.dataHoraInicio,
    )} — ${formatDate(reserva.dataHoraFim)}</td></tr>
    <tr><td style="padding:4px 8px;">Dias</td><td style="padding:4px 8px;text-align:right;">${
      reserva.dias
    }</td></tr>
    <tr><td style="padding:4px 8px;">Valor base</td><td style="padding:4px 8px;text-align:right;">${formatMoney(
      reserva.valorBase,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">Serviços adicionais</td><td style="padding:4px 8px;text-align:right;">${formatMoney(
      reserva.valorServicos,
    )}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:bold;">Valor total</td><td style="padding:4px 8px;text-align:right;font-weight:bold;">${formatMoney(
      reserva.valorTotal,
    )}</td></tr>
  </table>
  ${codigoHtml}

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Veículo</h2>
  <p>${escapeHtml(veiculo.marca)} ${escapeHtml(veiculo.modelo)} (${
    veiculo.ano
  }) — placa ${escapeHtml(veiculo.placa)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Locador</h2>
  <p>${escapeHtml(locador.empresa)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Locatário</h2>
  <p>${escapeHtml(locatario.nome)} — ${escapeHtml(locatario.email)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Retirada e devolução</h2>
  <p><strong>Retirada:</strong> ${retiradaHtml}</p>
  <p><strong>Devolução:</strong> ${devolucaoHtml}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Serviços adicionais</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${servicosLinhasHtml}
  </table>

  <p style="margin-top:24px;color:#888;font-size:12px;">Este é um e-mail automático da Mova. Em caso de dúvidas, responda a esta mensagem.</p>
</div>`;

  const servicosLinhasText =
    servicos.length > 0
      ? servicos
          .map((s) => `  - ${s.nome} (${s.descricao}): ${formatMoney(s.valor)}`)
          .join("\n")
      : "  - Nenhum serviço adicional contratado.";

  const retiradaText = retirada
    ? `${retirada.garagem} — ${retirada.endereco}`
    : "Não informado";
  const devolucaoText = devolucao
    ? `${devolucao.garagem} — ${devolucao.endereco}`
    : "Não informado";

  const codigoText = reserva.codigoDesbloqueio
    ? `Código de desbloqueio: ${reserva.codigoDesbloqueio}\n`
    : "";

  const text = `RESERVA CONFIRMADA

Olá, ${locatario.nome}! Aqui está o relatório da sua reserva.

DADOS DA RESERVA
  Reserva: #${reserva.id}
  Criada em: ${formatDate(reserva.criadaEm)}
  Status: ${reserva.status}
  Período: ${formatDate(reserva.dataHoraInicio)} — ${formatDate(
    reserva.dataHoraFim,
  )}
  Dias: ${reserva.dias}
  Valor base: ${formatMoney(reserva.valorBase)}
  Serviços adicionais: ${formatMoney(reserva.valorServicos)}
  Valor total: ${formatMoney(reserva.valorTotal)}
${codigoText}
VEÍCULO
  ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano}) — placa ${veiculo.placa}

LOCADOR
  ${locador.empresa}

LOCATÁRIO
  ${locatario.nome} — ${locatario.email}

RETIRADA E DEVOLUÇÃO
  Retirada: ${retiradaText}
  Devolução: ${devolucaoText}

SERVIÇOS ADICIONAIS
${servicosLinhasText}

Este é um e-mail automático da Mova.`;

  return { subject, html, text };
}
