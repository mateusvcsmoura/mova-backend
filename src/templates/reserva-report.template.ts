import { CategoriaVeiculo, MetodoPagamento } from "@prisma/client";

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
// status, nomes, categoria) não são traduzidos — regra de negócio permanece.
//
// HTML de e-mail: layout 100% baseado em tabelas + CSS inline, largura fixa de
// 600px, sem flexbox/grid/JS/webfonts/CDN. Assim renderiza de forma consistente
// em Gmail (web/mobile), Outlook (Word engine) e Apple Mail; quando um cliente
// ignora uma propriedade CSS, o conteúdo continua legível na ordem natural.

interface Strings {
  subject: (id: string) => string;
  headerSubtitulo: string;
  tituloConfirmada: string;
  saudacao: (nome: string) => string;
  reservaLabel: string;
  hResumoViagem: string;
  retirada: string;
  devolucao: string;
  diasReserva: (dias: number) => string;
  hVeiculo: string;
  lPlaca: string;
  lCambio: string;
  lLugares: string;
  lCategoria: string;
  badgeEletrico: string;
  badgeAdaptado: string;
  hLocais: string;
  hCodigo: string;
  codigoExplicacao: string;
  codigoIndisponivel: string;
  hServicos: string;
  semServicos: string;
  hFinanceiro: string;
  lReservaValor: string;
  lServicosValor: string;
  lTotal: string;
  lMetodo: string;
  hLocador: string;
  hDetalhes: string;
  lId: string;
  lCriadaEm: string;
  lStatus: string;
  naoInformado: string;
  rodapeLinha1: string;
  rodapeLinha2: string;
  // Texto puro
  textoTitulo: string;
}

const STRINGS: Record<Locale, Strings> = {
  pt: {
    subject: (id) => `Reserva confirmada • Mova #${id}`,
    headerSubtitulo: "Mobilidade que acompanha você",
    tituloConfirmada: "Reserva confirmada",
    saudacao: (nome) => `Olá, ${nome}. Sua reserva foi confirmada com sucesso.`,
    reservaLabel: "Reserva",
    hResumoViagem: "Resumo da viagem",
    retirada: "Retirada",
    devolucao: "Devolução",
    diasReserva: (dias) =>
      `${dias} ${dias === 1 ? "dia" : "dias"} de reserva`,
    hVeiculo: "Seu veículo",
    lPlaca: "Placa",
    lCambio: "Câmbio",
    lLugares: "Lugares",
    lCategoria: "Categoria",
    badgeEletrico: "Elétrico",
    badgeAdaptado: "Adaptado",
    hLocais: "Onde retirar e devolver",
    hCodigo: "Código de desbloqueio",
    codigoExplicacao:
      "Use este código para desbloquear o veículo. Ele fica disponível a partir do horário de retirada da reserva.",
    codigoIndisponivel:
      "O código de desbloqueio será disponibilizado em breve.",
    hServicos: "Serviços adicionais",
    semServicos: "Nenhum serviço adicional foi contratado nesta reserva.",
    hFinanceiro: "Resumo do pagamento",
    lReservaValor: "Reserva",
    lServicosValor: "Serviços adicionais",
    lTotal: "Total",
    lMetodo: "Forma de pagamento",
    hLocador: "Responsável pelo veículo",
    hDetalhes: "Detalhes da reserva",
    lId: "Identificador",
    lCriadaEm: "Criada em",
    lStatus: "Status",
    naoInformado: "Não informado",
    rodapeLinha1: "Este é um e-mail automático relacionado à sua reserva.",
    rodapeLinha2:
      "Guarde este e-mail para consultar os detalhes da sua viagem.",
    textoTitulo: "RESERVA CONFIRMADA",
  },
  en: {
    subject: (id) => `Booking confirmed • Mova #${id}`,
    headerSubtitulo: "Mobility that moves with you",
    tituloConfirmada: "Booking confirmed",
    saudacao: (nome) => `Hi, ${nome}. Your booking has been confirmed.`,
    reservaLabel: "Booking",
    hResumoViagem: "Trip summary",
    retirada: "Pickup",
    devolucao: "Return",
    diasReserva: (dias) => `${dias} ${dias === 1 ? "day" : "days"} booked`,
    hVeiculo: "Your vehicle",
    lPlaca: "Plate",
    lCambio: "Transmission",
    lLugares: "Seats",
    lCategoria: "Category",
    badgeEletrico: "Electric",
    badgeAdaptado: "Accessible",
    hLocais: "Where to pick up and return",
    hCodigo: "Unlock code",
    codigoExplicacao:
      "Use this code to unlock the vehicle. It becomes available from the booking pickup time.",
    codigoIndisponivel: "Your unlock code will be available soon.",
    hServicos: "Add-on services",
    semServicos: "No add-on services were selected for this booking.",
    hFinanceiro: "Payment summary",
    lReservaValor: "Booking",
    lServicosValor: "Add-on services",
    lTotal: "Total",
    lMetodo: "Payment method",
    hLocador: "Vehicle provider",
    hDetalhes: "Booking details",
    lId: "Identifier",
    lCriadaEm: "Created at",
    lStatus: "Status",
    naoInformado: "Not provided",
    rodapeLinha1: "This is an automated e-mail about your booking.",
    rodapeLinha2: "Keep this e-mail to review your trip details.",
    textoTitulo: "BOOKING CONFIRMED",
  },
  es: {
    subject: (id) => `Reserva confirmada • Mova #${id}`,
    headerSubtitulo: "Movilidad que te acompaña",
    tituloConfirmada: "Reserva confirmada",
    saudacao: (nome) => `Hola, ${nome}. Tu reserva ha sido confirmada.`,
    reservaLabel: "Reserva",
    hResumoViagem: "Resumen del viaje",
    retirada: "Retiro",
    devolucao: "Devolución",
    diasReserva: (dias) => `${dias} ${dias === 1 ? "día" : "días"} de reserva`,
    hVeiculo: "Tu vehículo",
    lPlaca: "Matrícula",
    lCambio: "Cambio",
    lLugares: "Plazas",
    lCategoria: "Categoría",
    badgeEletrico: "Eléctrico",
    badgeAdaptado: "Adaptado",
    hLocais: "Dónde retirar y devolver",
    hCodigo: "Código de desbloqueo",
    codigoExplicacao:
      "Usa este código para desbloquear el vehículo. Estará disponible a partir de la hora de retiro de la reserva.",
    codigoIndisponivel: "Tu código de desbloqueo estará disponible pronto.",
    hServicos: "Servicios adicionales",
    semServicos: "No se contrató ningún servicio adicional en esta reserva.",
    hFinanceiro: "Resumen del pago",
    lReservaValor: "Reserva",
    lServicosValor: "Servicios adicionales",
    lTotal: "Total",
    lMetodo: "Forma de pago",
    hLocador: "Responsable del vehículo",
    hDetalhes: "Detalles de la reserva",
    lId: "Identificador",
    lCriadaEm: "Creada el",
    lStatus: "Estado",
    naoInformado: "No informado",
    rodapeLinha1: "Este es un correo automático sobre tu reserva.",
    rodapeLinha2: "Guarda este correo para consultar los detalles de tu viaje.",
    textoTitulo: "RESERVA CONFIRMADA",
  },
};

const LOCALE_INTL: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

// Rótulos de exibição de DADOS (não traduzidos — regra de negócio). Mapa único
// por enum; a UI ao redor é que muda de idioma.
const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  ECONOMICO: "Econômico",
  ESPACOSO: "Espaçoso",
  EXECUTIVO: "Executivo",
  PCD: "PCD",
};

const METODO_LABEL: Record<MetodoPagamento, string> = {
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  PIX: "PIX",
  CARTEIRA_DIGITAL: "Carteira digital",
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

// Paleta (mobilidade/tecnologia): fundo neutro, container branco, azul primário
// e verde de sucesso. Cores em hex para máxima compatibilidade.
const C = {
  bg: "#eef1f6",
  card: "#ffffff",
  primary: "#0b2e6b",
  primaryText: "#ffffff",
  accent: "#1d4ed8",
  success: "#16a34a",
  successBg: "#e7f6ec",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  soft: "#f5f7fb",
};

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
  const dayFmt = new Intl.DateTimeFormat(intlTag, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(intlTag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatMoney = (v: number) => money.format(v);
  const formatDate = (d: Date) => dateTime.format(d);
  // "01 AGO 2026" — via formatToParts para evitar separadores de locale
  // (pt-BR insere "de": "01 de ago. de 2026"). Junta dia/mês/ano manualmente.
  const formatDia = (d: Date) => {
    const parts = dayFmt.formatToParts(d);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${get("day")} ${get("month").replace(/\./g, "").toUpperCase()} ${get(
      "year",
    )}`;
  };
  const formatHora = (d: Date) => timeFmt.format(d);

  const { reserva, veiculo, locador, locatario, retirada, devolucao, servicos } =
    payload;

  const subject = t.subject(shortId(reserva.id));

  // ---------------------------------------------------------------- HTML -----

  const sectionTitle = (title: string) =>
    `<tr><td style="padding:26px 28px 0 28px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.accent};">${escapeHtml(
        title,
      )}</div>
    </td></tr>`;

  // Cabeçalho de retirada/devolução (duas colunas visualmente distintas).
  const stop = (rotulo: string, cor: string, d: Date) => `
    <td width="50%" valign="top" style="padding:14px 16px;background:${C.soft};border-radius:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${cor};">${escapeHtml(
        rotulo,
      )}</div>
      <div style="font-size:20px;font-weight:700;color:${C.text};padding-top:6px;">${formatDia(
        d,
      )}</div>
      <div style="font-size:14px;color:${C.muted};padding-top:2px;">${formatHora(
        d,
      )}</div>
    </td>`;

  const resumoViagemHtml = `
  ${sectionTitle(t.hResumoViagem)}
  <tr><td style="padding:12px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
      <tr>
        ${stop(t.retirada, C.success, reserva.dataHoraInicio)}
        <td width="12"></td>
        ${stop(t.devolucao, C.accent, reserva.dataHoraFim)}
      </tr>
    </table>
    <div style="text-align:center;padding:14px 0 2px 0;">
      <span style="display:inline-block;background:${C.primary};color:${C.primaryText};font-size:13px;font-weight:700;padding:6px 16px;border-radius:999px;">${escapeHtml(
        t.diasReserva(reserva.dias),
      )}</span>
    </div>
  </td></tr>`;

  // Badges de atributo do veículo (só aparecem quando true; texto + emoji).
  const veiculoBadges = [
    veiculo.eletrico ? `⚡ ${t.badgeEletrico}` : null,
    veiculo.adaptado ? `♿ ${t.badgeAdaptado}` : null,
  ].filter((b): b is string => b !== null);

  const veiculoBadgesHtml = veiculoBadges.length
    ? `<div style="padding-top:10px;">${veiculoBadges
        .map(
          (b) =>
            `<span style="display:inline-block;background:${C.successBg};color:${C.success};font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;margin-right:6px;">${escapeHtml(
              b,
            )}</span>`,
        )
        .join("")}</div>`
    : "";

  const attrRow = (label: string, value: string) => `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:${C.muted};">${escapeHtml(
        label,
      )}</td>
      <td style="padding:5px 0;font-size:13px;color:${C.text};font-weight:600;text-align:right;">${escapeHtml(
        value,
      )}</td>
    </tr>`;

  const veiculoAttrs = [
    attrRow(t.lPlaca, veiculo.placa),
    veiculo.categoria
      ? attrRow(t.lCategoria, CATEGORIA_LABEL[veiculo.categoria])
      : "",
    veiculo.cambio ? attrRow(t.lCambio, veiculo.cambio) : "",
    veiculo.capacidade
      ? attrRow(t.lLugares, String(veiculo.capacidade))
      : "",
  ].join("");

  const veiculoHtml = `
  ${sectionTitle(t.hVeiculo)}
  <tr><td style="padding:12px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:18px;font-weight:700;color:${C.text};">${escapeHtml(
          `${veiculo.marca} ${veiculo.modelo}`,
        )} <span style="color:${C.muted};font-weight:600;">${veiculo.ano}</span></div>
        ${veiculoBadgesHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid ${C.border};">
          ${veiculoAttrs}
        </table>
      </td></tr>
    </table>
  </td></tr>`;

  // Retirada/devolução (garagem + endereço). Colunas empilham no mobile porque
  // são <td> em uma tabela de 600px — em telas estreitas o cliente reflui.
  const local = (rotulo: string, cor: string, garagem: string | null, endereco: string | null) => `
    <td width="50%" valign="top" style="padding:0 8px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${cor};padding-bottom:6px;">${escapeHtml(
        rotulo,
      )}</div>
      <div style="font-size:15px;font-weight:700;color:${C.text};">${escapeHtml(
        garagem ?? t.naoInformado,
      )}</div>
      ${
        endereco
          ? `<div style="font-size:13px;color:${C.muted};padding-top:3px;">${escapeHtml(
              endereco,
            )}</div>`
          : ""
      }
    </td>`;

  const locaisHtml = `
  ${sectionTitle(t.hLocais)}
  <tr><td style="padding:12px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${local(
          t.retirada,
          C.success,
          retirada?.garagem ?? null,
          retirada?.endereco ?? null,
        )}
        ${local(
          t.devolucao,
          C.accent,
          devolucao?.garagem ?? null,
          devolucao?.endereco ?? null,
        )}
      </tr>
    </table>
  </td></tr>`;

  const codigoHtml = reserva.codigoDesbloqueio
    ? `
  ${sectionTitle(t.hCodigo)}
  <tr><td style="padding:12px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.primary};border-radius:12px;">
      <tr><td style="padding:20px 24px;text-align:center;">
        <div style="font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:700;letter-spacing:4px;color:${C.primaryText};">${escapeHtml(
          reserva.codigoDesbloqueio,
        )}</div>
        <div style="font-size:13px;color:#c9d6f0;padding-top:10px;line-height:1.5;">${escapeHtml(
          t.codigoExplicacao,
        )}</div>
      </td></tr>
    </table>
  </td></tr>`
    : `
  ${sectionTitle(t.hCodigo)}
  <tr><td style="padding:8px 28px 0 28px;">
    <div style="font-size:14px;color:${C.muted};">${escapeHtml(
      t.codigoIndisponivel,
    )}</div>
  </td></tr>`;

  const servicosHtml =
    servicos.length > 0
      ? `
  ${sectionTitle(t.hServicos)}
  <tr><td style="padding:12px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;">
      ${servicos
        .map(
          (s, i) => `
      <tr>
        <td style="padding:12px 16px;${
          i > 0 ? `border-top:1px solid ${C.border};` : ""
        }">
          <div style="font-size:14px;font-weight:600;color:${C.text};">${escapeHtml(
            s.nome,
          )}</div>
          ${
            s.descricao
              ? `<div style="font-size:12px;color:${C.muted};padding-top:2px;">${escapeHtml(
                  s.descricao,
                )}</div>`
              : ""
          }
        </td>
        <td valign="top" style="padding:12px 16px;text-align:right;font-size:14px;font-weight:700;color:${C.text};${
          i > 0 ? `border-top:1px solid ${C.border};` : ""
        }">${formatMoney(s.valor)}</td>
      </tr>`,
        )
        .join("")}
    </table>
  </td></tr>`
      : "";

  const financeiroLinha = (label: string, valor: string, forte = false) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${
        forte ? C.text : C.muted
      };${forte ? "font-weight:700;" : ""}">${escapeHtml(label)}</td>
      <td style="padding:6px 0;text-align:right;font-size:14px;color:${
        C.text
      };${forte ? "font-weight:700;" : "font-weight:600;"}">${escapeHtml(
    valor,
  )}</td>
    </tr>`;

  const metodoLinha = reserva.metodoPagamento
    ? financeiroLinha(t.lMetodo, METODO_LABEL[reserva.metodoPagamento])
    : "";

  const financeiroHtml = `
  ${sectionTitle(t.hFinanceiro)}
  <tr><td style="padding:12px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${financeiroLinha(t.lReservaValor, formatMoney(reserva.valorBase))}
          ${financeiroLinha(
            t.lServicosValor,
            formatMoney(reserva.valorServicos),
          )}
          ${metodoLinha}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:2px solid ${C.border};">
          <tr>
            <td style="padding:12px 0 0 0;font-size:16px;font-weight:700;color:${C.text};">${escapeHtml(
              t.lTotal,
            )}</td>
            <td style="padding:12px 0 0 0;text-align:right;font-size:22px;font-weight:800;color:${C.success};">${formatMoney(
              reserva.valorTotal,
            )}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;

  const locadorHtml = `
  ${sectionTitle(t.hLocador)}
  <tr><td style="padding:8px 28px 0 28px;">
    <div style="font-size:15px;font-weight:600;color:${C.text};">${escapeHtml(
      locador.empresa,
    )}</div>
  </td></tr>`;

  const detalheRow = (label: string, value: string) => `
    <tr>
      <td style="padding:4px 0;font-size:12px;color:${C.muted};">${escapeHtml(
        label,
      )}</td>
      <td style="padding:4px 0;text-align:right;font-size:12px;color:${C.muted};word-break:break-all;">${escapeHtml(
        value,
      )}</td>
    </tr>`;

  const detalhesHtml = `
  ${sectionTitle(t.hDetalhes)}
  <tr><td style="padding:8px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detalheRow(t.lId, reserva.id)}
      ${detalheRow(t.lCriadaEm, formatDate(reserva.criadaEm))}
      ${detalheRow(t.lStatus, reserva.status)}
    </table>
  </td></tr>`;

  const html = `<!-- Relatório de reserva Mova -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.card};border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${C.text};">

      <!-- Cabeçalho -->
      <tr><td style="background:${C.primary};padding:26px 28px;">
        <div style="font-size:26px;font-weight:800;letter-spacing:3px;color:${C.primaryText};">MOVA</div>
        <div style="font-size:13px;color:#c9d6f0;padding-top:2px;">${escapeHtml(
          t.headerSubtitulo,
        )}</div>
      </td></tr>

      <!-- Confirmação -->
      <tr><td style="padding:24px 28px 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.successBg};border-radius:12px;">
          <tr><td style="padding:16px 20px;">
            <div style="font-size:18px;font-weight:800;color:${C.success};">&#10003; ${escapeHtml(
              t.tituloConfirmada,
            )}</div>
            <div style="font-size:14px;color:${C.text};padding-top:6px;line-height:1.5;">${escapeHtml(
              t.saudacao(locatario.nome),
            )}</div>
            <div style="font-size:13px;color:${C.muted};padding-top:8px;">${escapeHtml(
              t.reservaLabel,
            )} <strong style="color:${C.accent};">#${escapeHtml(
    shortId(reserva.id),
  )}</strong></div>
          </td></tr>
        </table>
      </td></tr>

      ${resumoViagemHtml}
      ${veiculoHtml}
      ${locaisHtml}
      ${codigoHtml}
      ${servicosHtml}
      ${financeiroHtml}
      ${locadorHtml}
      ${detalhesHtml}

      <!-- Rodapé -->
      <tr><td style="padding:28px;">
        <div style="border-top:1px solid ${C.border};padding-top:18px;">
          <div style="font-size:16px;font-weight:800;letter-spacing:2px;color:${C.primary};">MOVA</div>
          <div style="font-size:12px;color:${C.muted};padding-top:6px;line-height:1.6;">${escapeHtml(
            t.rodapeLinha1,
          )}<br>${escapeHtml(t.rodapeLinha2)}</div>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>`;

  // ---------------------------------------------------------------- Texto ----

  const linha = (label: string, value: string) => `${label}: ${value}`;

  const veiculoAttrsText = [
    linha(t.lPlaca, veiculo.placa),
    veiculo.categoria
      ? linha(t.lCategoria, CATEGORIA_LABEL[veiculo.categoria])
      : null,
    veiculo.cambio ? linha(t.lCambio, veiculo.cambio) : null,
    veiculo.capacidade ? linha(t.lLugares, String(veiculo.capacidade)) : null,
    veiculoBadges.length ? veiculoBadges.join(" • ") : null,
  ]
    .filter((l): l is string => l !== null)
    .map((l) => `  ${l}`)
    .join("\n");

  const localText = (garagem: string | null, endereco: string | null) => {
    if (!garagem) return `  ${t.naoInformado}`;
    return endereco ? `  ${garagem}\n  ${endereco}` : `  ${garagem}`;
  };

  const servicosText =
    servicos.length > 0
      ? servicos
          .map(
            (s) =>
              `  - ${s.nome}${s.descricao ? ` (${s.descricao})` : ""}: ${formatMoney(
                s.valor,
              )}`,
          )
          .join("\n")
      : `  ${t.semServicos}`;

  const codigoText = reserva.codigoDesbloqueio
    ? `${t.hCodigo.toUpperCase()}\n  ${reserva.codigoDesbloqueio}\n  ${t.codigoExplicacao}\n\n`
    : `${t.hCodigo.toUpperCase()}\n  ${t.codigoIndisponivel}\n\n`;

  const metodoText = reserva.metodoPagamento
    ? `\n  ${t.lMetodo}: ${METODO_LABEL[reserva.metodoPagamento]}`
    : "";

  const text = `${t.textoTitulo}

${t.saudacao(locatario.nome)}
${t.reservaLabel} #${shortId(reserva.id)}

${t.hResumoViagem.toUpperCase()}
  ${t.retirada}: ${formatDia(reserva.dataHoraInicio)} ${formatHora(
    reserva.dataHoraInicio,
  )}
${localText(retirada?.garagem ?? null, retirada?.endereco ?? null)}
  ${t.devolucao}: ${formatDia(reserva.dataHoraFim)} ${formatHora(
    reserva.dataHoraFim,
  )}
${localText(devolucao?.garagem ?? null, devolucao?.endereco ?? null)}
  ${t.diasReserva(reserva.dias)}

${t.hVeiculo.toUpperCase()}
  ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano})
${veiculoAttrsText}

${codigoText}${t.hServicos.toUpperCase()}
${servicosText}

${t.hFinanceiro.toUpperCase()}
  ${t.lReservaValor}: ${formatMoney(reserva.valorBase)}
  ${t.lServicosValor}: ${formatMoney(reserva.valorServicos)}${metodoText}
  ${t.lTotal}: ${formatMoney(reserva.valorTotal)}

${t.hLocador.toUpperCase()}
  ${locador.empresa}

${t.hDetalhes.toUpperCase()}
  ${t.lId}: ${reserva.id}
  ${t.lCriadaEm}: ${formatDate(reserva.criadaEm)}
  ${t.lStatus}: ${reserva.status}

MOVA — ${t.headerSubtitulo}
${t.rodapeLinha1}
${t.rodapeLinha2}`;

  return { subject, html, text };
}
