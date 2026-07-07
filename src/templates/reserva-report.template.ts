import {
  ReservaReportContent,
  ReservaReportPayload,
} from "../services/contracts/reserva-report.js";
import { Locale, LOCALE_PADRAO } from "../i18n/index.js";

// Template do relatório de reserva. Função pura: recebe o payload + idioma e
// devolve o conteúdo (assunto + HTML + texto). Mantido fora dos services para
// que o HTML não seja concatenado dentro da regra de negócio. Para adicionar
// PDF no futuro, basta um novo módulo que consuma o mesmo payload.
//
// i18n: só o texto voltado ao usuário é traduzido (pt/en/es). Os DADOS (marca,
// status, nomes) não são traduzidos — regra de negócio permanece.

// Rótulos por idioma. Moeda fica em BRL (negócio); locale afeta a formatação.
interface Strings {
  subject: (id: string) => string;
  titulo: string;
  saudacao: (nome: string) => string;
  hDados: string;
  hVeiculo: string;
  hLocador: string;
  hLocatario: string;
  hRetiradaDevolucao: string;
  hServicos: string;
  lReserva: string;
  lCriadaEm: string;
  lStatus: string;
  lPeriodo: string;
  lDias: string;
  lValorBase: string;
  lServicos: string;
  lValorTotal: string;
  codigo: string;
  semServicos: string;
  naoInformado: string;
  retirada: string;
  devolucao: string;
  placa: string;
  rodape: string;
  textoTitulo: string;
}

const STRINGS: Record<Locale, Strings> = {
  pt: {
    subject: (id) => `Relatório da sua reserva #${id}`,
    titulo: "Reserva confirmada 🎉",
    saudacao: (nome) => `Olá, ${nome}! Aqui está o relatório da sua reserva.`,
    hDados: "Dados da reserva",
    hVeiculo: "Veículo",
    hLocador: "Locador",
    hLocatario: "Locatário",
    hRetiradaDevolucao: "Retirada e devolução",
    hServicos: "Serviços adicionais",
    lReserva: "Reserva",
    lCriadaEm: "Criada em",
    lStatus: "Status",
    lPeriodo: "Período",
    lDias: "Dias",
    lValorBase: "Valor base",
    lServicos: "Serviços adicionais",
    lValorTotal: "Valor total",
    codigo: "Código de desbloqueio:",
    semServicos: "Nenhum serviço adicional contratado.",
    naoInformado: "Não informado",
    retirada: "Retirada:",
    devolucao: "Devolução:",
    placa: "placa",
    rodape:
      "Este é um e-mail automático da Mova. Em caso de dúvidas, responda a esta mensagem.",
    textoTitulo: "RESERVA CONFIRMADA",
  },
  en: {
    subject: (id) => `Your booking report #${id}`,
    titulo: "Booking confirmed 🎉",
    saudacao: (nome) => `Hi, ${nome}! Here is your booking report.`,
    hDados: "Booking details",
    hVeiculo: "Vehicle",
    hLocador: "Lessor",
    hLocatario: "Renter",
    hRetiradaDevolucao: "Pickup and return",
    hServicos: "Add-on services",
    lReserva: "Booking",
    lCriadaEm: "Created at",
    lStatus: "Status",
    lPeriodo: "Period",
    lDias: "Days",
    lValorBase: "Base price",
    lServicos: "Add-on services",
    lValorTotal: "Total",
    codigo: "Unlock code:",
    semServicos: "No add-on services selected.",
    naoInformado: "Not provided",
    retirada: "Pickup:",
    devolucao: "Return:",
    placa: "plate",
    rodape:
      "This is an automated Mova e-mail. If you have questions, reply to this message.",
    textoTitulo: "BOOKING CONFIRMED",
  },
  es: {
    subject: (id) => `Informe de tu reserva #${id}`,
    titulo: "Reserva confirmada 🎉",
    saudacao: (nome) => `¡Hola, ${nome}! Aquí está el informe de tu reserva.`,
    hDados: "Datos de la reserva",
    hVeiculo: "Vehículo",
    hLocador: "Arrendador",
    hLocatario: "Arrendatario",
    hRetiradaDevolucao: "Retiro y devolución",
    hServicos: "Servicios adicionales",
    lReserva: "Reserva",
    lCriadaEm: "Creada el",
    lStatus: "Estado",
    lPeriodo: "Período",
    lDias: "Días",
    lValorBase: "Valor base",
    lServicos: "Servicios adicionales",
    lValorTotal: "Total",
    codigo: "Código de desbloqueo:",
    semServicos: "Ningún servicio adicional contratado.",
    naoInformado: "No informado",
    retirada: "Retiro:",
    devolucao: "Devolución:",
    placa: "placa",
    rodape:
      "Este es un correo automático de Mova. Si tienes dudas, responde a este mensaje.",
    textoTitulo: "RESERVA CONFIRMADA",
  },
};

const LOCALE_INTL: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

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
  locale: Locale = LOCALE_PADRAO,
): ReservaReportContent {
  const t = STRINGS[locale] ?? STRINGS[LOCALE_PADRAO];
  const intlTag = LOCALE_INTL[locale] ?? LOCALE_INTL[LOCALE_PADRAO];

  const money = new Intl.NumberFormat(intlTag, {
    style: "currency",
    currency: "BRL",
  });
  const dateTime = new Intl.DateTimeFormat(intlTag, {
    dateStyle: "short",
    timeStyle: "short",
  });
  const formatMoney = (v: number) => money.format(v);
  const formatDate = (d: Date) => dateTime.format(d);

  const { reserva, veiculo, locador, locatario, retirada, devolucao, servicos } =
    payload;

  const subject = t.subject(shortId(reserva.id));

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
      : `<tr><td colspan="3" style="padding:4px 8px;color:#666;">${t.semServicos}</td></tr>`;

  const retiradaHtml = retirada
    ? `${escapeHtml(retirada.garagem)} — ${escapeHtml(retirada.endereco)}`
    : t.naoInformado;
  const devolucaoHtml = devolucao
    ? `${escapeHtml(devolucao.garagem)} — ${escapeHtml(devolucao.endereco)}`
    : t.naoInformado;

  const codigoHtml = reserva.codigoDesbloqueio
    ? `<p style="font-size:16px;"><strong>${t.codigo}</strong>
        <span style="font-family:monospace;letter-spacing:1px;">${escapeHtml(
          reserva.codigoDesbloqueio,
        )}</span></p>`
    : "";

  const html = `<!-- Relatório de reserva Mova -->
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
  <h1 style="font-size:20px;">${t.titulo}</h1>
  <p>${escapeHtml(t.saudacao(locatario.nome))}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">${t.hDados}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 8px;">${t.lReserva}</td><td style="padding:4px 8px;text-align:right;">#${escapeHtml(
      reserva.id,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">${t.lCriadaEm}</td><td style="padding:4px 8px;text-align:right;">${formatDate(
      reserva.criadaEm,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">${t.lStatus}</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(
      reserva.status,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">${t.lPeriodo}</td><td style="padding:4px 8px;text-align:right;">${formatDate(
      reserva.dataHoraInicio,
    )} — ${formatDate(reserva.dataHoraFim)}</td></tr>
    <tr><td style="padding:4px 8px;">${t.lDias}</td><td style="padding:4px 8px;text-align:right;">${
      reserva.dias
    }</td></tr>
    <tr><td style="padding:4px 8px;">${t.lValorBase}</td><td style="padding:4px 8px;text-align:right;">${formatMoney(
      reserva.valorBase,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">${t.lServicos}</td><td style="padding:4px 8px;text-align:right;">${formatMoney(
      reserva.valorServicos,
    )}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:bold;">${t.lValorTotal}</td><td style="padding:4px 8px;text-align:right;font-weight:bold;">${formatMoney(
      reserva.valorTotal,
    )}</td></tr>
  </table>
  ${codigoHtml}

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">${t.hVeiculo}</h2>
  <p>${escapeHtml(veiculo.marca)} ${escapeHtml(veiculo.modelo)} (${
    veiculo.ano
  }) — ${t.placa} ${escapeHtml(veiculo.placa)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">${t.hLocador}</h2>
  <p>${escapeHtml(locador.empresa)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">${t.hLocatario}</h2>
  <p>${escapeHtml(locatario.nome)} — ${escapeHtml(locatario.email)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">${t.hRetiradaDevolucao}</h2>
  <p><strong>${t.retirada}</strong> ${retiradaHtml}</p>
  <p><strong>${t.devolucao}</strong> ${devolucaoHtml}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">${t.hServicos}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${servicosLinhasHtml}
  </table>

  <p style="margin-top:24px;color:#888;font-size:12px;">${t.rodape}</p>
</div>`;

  const servicosLinhasText =
    servicos.length > 0
      ? servicos
          .map((s) => `  - ${s.nome} (${s.descricao}): ${formatMoney(s.valor)}`)
          .join("\n")
      : `  - ${t.semServicos}`;

  const retiradaText = retirada
    ? `${retirada.garagem} — ${retirada.endereco}`
    : t.naoInformado;
  const devolucaoText = devolucao
    ? `${devolucao.garagem} — ${devolucao.endereco}`
    : t.naoInformado;

  const codigoText = reserva.codigoDesbloqueio
    ? `${t.codigo} ${reserva.codigoDesbloqueio}\n`
    : "";

  const text = `${t.textoTitulo}

${t.saudacao(locatario.nome)}

${t.hDados.toUpperCase()}
  ${t.lReserva}: #${reserva.id}
  ${t.lCriadaEm}: ${formatDate(reserva.criadaEm)}
  ${t.lStatus}: ${reserva.status}
  ${t.lPeriodo}: ${formatDate(reserva.dataHoraInicio)} — ${formatDate(
    reserva.dataHoraFim,
  )}
  ${t.lDias}: ${reserva.dias}
  ${t.lValorBase}: ${formatMoney(reserva.valorBase)}
  ${t.lServicos}: ${formatMoney(reserva.valorServicos)}
  ${t.lValorTotal}: ${formatMoney(reserva.valorTotal)}
${codigoText}
${t.hVeiculo.toUpperCase()}
  ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano}) — ${t.placa} ${
    veiculo.placa
  }

${t.hLocador.toUpperCase()}
  ${locador.empresa}

${t.hLocatario.toUpperCase()}
  ${locatario.nome} — ${locatario.email}

${t.hRetiradaDevolucao.toUpperCase()}
  ${t.retirada} ${retiradaText}
  ${t.devolucao} ${devolucaoText}

${t.hServicos.toUpperCase()}
${servicosLinhasText}

${t.rodape}`;

  return { subject, html, text };
}
