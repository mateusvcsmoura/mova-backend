import {
  VeiculoDisponivelContent,
  VeiculoDisponivelPayload,
} from "../services/contracts/veiculo-disponivel.js";

// Template da notificação de veículo disponível. Função pura: recebe o payload
// e devolve o conteúdo (assunto + HTML + texto). Mantido fora dos services para
// que o HTML não seja concatenado dentro da regra de negócio. Novos canais
// (push/SMS/WhatsApp) consomem o mesmo VeiculoDisponivelPayload em outros
// módulos — sem tocar no dispatcher.

// Escapa texto para uso seguro dentro do HTML (dados vêm do banco/usuário).
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderVeiculoDisponivel(
  payload: VeiculoDisponivelPayload,
): VeiculoDisponivelContent {
  const { veiculo, locador, garagem, locatario } = payload;

  const nomeVeiculo = `${veiculo.marca} ${veiculo.modelo} (${veiculo.ano})`;

  const subject = `${nomeVeiculo} voltou a ficar disponível!`;

  const garagemHtml = garagem
    ? `${escapeHtml(garagem.nome)} — ${escapeHtml(garagem.endereco)}`
    : "Consulte o locador";

  const html = `<!-- Notificação de disponibilidade Mova -->
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
  <h1 style="font-size:20px;">Boa notícia, ${escapeHtml(locatario.nome)}! 🚗</h1>
  <p>O veículo pelo qual você demonstrou interesse voltou a ficar <strong>disponível</strong> para reserva.</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Veículo</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 8px;">Marca</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(
      veiculo.marca,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">Modelo</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(
      veiculo.modelo,
    )}</td></tr>
    <tr><td style="padding:4px 8px;">Ano</td><td style="padding:4px 8px;text-align:right;">${
      veiculo.ano
    }</td></tr>
    <tr><td style="padding:4px 8px;">Placa</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(
      veiculo.placa,
    )}</td></tr>
  </table>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Locador</h2>
  <p>${escapeHtml(locador.empresa)}</p>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Onde retirar</h2>
  <p>${garagemHtml}</p>

  <p>Garanta já a sua reserva antes que ele seja reservado novamente!</p>

  <p style="margin-top:24px;color:#888;font-size:12px;">Você recebeu este e-mail porque registrou interesse neste veículo na Mova. Este é um e-mail automático; em caso de dúvidas, responda a esta mensagem.</p>
</div>`;

  const garagemText = garagem
    ? `${garagem.nome} — ${garagem.endereco}`
    : "Consulte o locador";

  const text = `VEÍCULO DISPONÍVEL

Boa notícia, ${locatario.nome}!

O veículo pelo qual você demonstrou interesse voltou a ficar disponível para reserva.

VEÍCULO
  ${nomeVeiculo} — placa ${veiculo.placa}

LOCADOR
  ${locador.empresa}

ONDE RETIRAR
  ${garagemText}

Garanta já a sua reserva antes que ele seja reservado novamente!

Você recebeu este e-mail porque registrou interesse neste veículo na Mova.`;

  return { subject, html, text };
}
