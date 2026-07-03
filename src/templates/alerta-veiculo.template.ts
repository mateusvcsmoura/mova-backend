import {
  AlertaBaixaAvaliacaoPayload,
  AlertaInatividadePayload,
  AlertaVeiculoContent,
  AlertaVeiculoInfo,
} from "../services/contracts/alerta-veiculo.js";

// Templates dos alertas de monitoramento da frota. Funções puras: recebem o
// payload e devolvem o conteúdo (assunto + HTML + texto). Mantidos fora dos
// services para que o HTML não seja concatenado dentro da regra de negócio.

// Escapa texto para uso seguro dentro do HTML (dados vêm do banco/usuário).
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nomeVeiculo = (v: AlertaVeiculoInfo) => `${v.marca} ${v.modelo} (${v.ano})`;

const tabelaVeiculoHtml = (v: AlertaVeiculoInfo) => `
  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Veículo</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 8px;">Marca</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(v.marca)}</td></tr>
    <tr><td style="padding:4px 8px;">Modelo</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(v.modelo)}</td></tr>
    <tr><td style="padding:4px 8px;">Ano</td><td style="padding:4px 8px;text-align:right;">${v.ano}</td></tr>
    <tr><td style="padding:4px 8px;">Placa</td><td style="padding:4px 8px;text-align:right;">${escapeHtml(v.placa)}</td></tr>
  </table>`;

const rodapeHtml = `<p style="margin-top:24px;color:#888;font-size:12px;">Alerta automático do monitoramento de frota da Mova. Em caso de dúvidas, responda a esta mensagem.</p>`;

export function renderAlertaInatividade(
  payload: AlertaInatividadePayload,
): AlertaVeiculoContent {
  const { veiculo, locador, diasInativos } = payload;

  const subject = `Alerta: ${nomeVeiculo(veiculo)} está inativo há ${diasInativos} dias`;

  const html = `<!-- Alerta de inatividade Mova -->
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
  <h1 style="font-size:20px;">Veículo inativo há ${diasInativos} dias ⚠️</h1>
  <p>Olá, ${escapeHtml(locador.nome)} (${escapeHtml(locador.empresa)}).</p>
  <p>O veículo abaixo permanece com status <strong>INATIVO</strong> há
  <strong>${diasInativos} dias</strong> e não está disponível para reserva.</p>
  ${tabelaVeiculoHtml(veiculo)}

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Recomendação</h2>
  <p>Revise o cadastro do veículo: reative-o caso já esteja apto a circular ou
  atualize a situação (manutenção, desativação definitiva) para manter a frota
  consistente.</p>
  ${rodapeHtml}
</div>`;

  const text = `ALERTA: VEÍCULO INATIVO

Olá, ${locador.nome} (${locador.empresa}).

O veículo abaixo permanece com status INATIVO há ${diasInativos} dias e não está disponível para reserva.

VEÍCULO
  ${nomeVeiculo(veiculo)} — placa ${veiculo.placa}

RECOMENDAÇÃO
  Revise o cadastro do veículo: reative-o caso já esteja apto a circular ou atualize a situação (manutenção, desativação definitiva).

Alerta automático do monitoramento de frota da Mova.`;

  return { subject, html, text };
}

export function renderAlertaBaixaAvaliacao(
  payload: AlertaBaixaAvaliacaoPayload,
): AlertaVeiculoContent {
  const {
    veiculo,
    locador,
    media,
    quantidade,
    quantidadeNotasBaixas,
    notaBaixa,
    janelaDias,
  } = payload;

  const mediaFmt = media.toFixed(1);

  const subject = `Alerta: ${nomeVeiculo(veiculo)} com avaliações baixas (média ${mediaFmt})`;

  const html = `<!-- Alerta de baixa avaliação Mova -->
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
  <h1 style="font-size:20px;">Avaliações abaixo do esperado ⭐</h1>
  <p>Olá, ${escapeHtml(locador.nome)} (${escapeHtml(locador.empresa)}).</p>
  <p>O veículo abaixo vem recebendo avaliações baixas recorrentes nos últimos
  ${janelaDias} dias.</p>
  ${tabelaVeiculoHtml(veiculo)}

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Resumo das avaliações</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:4px 8px;">Média atual</td><td style="padding:4px 8px;text-align:right;">${mediaFmt}</td></tr>
    <tr><td style="padding:4px 8px;">Avaliações no período</td><td style="padding:4px 8px;text-align:right;">${quantidade}</td></tr>
    <tr><td style="padding:4px 8px;">Notas abaixo de ${notaBaixa}</td><td style="padding:4px 8px;text-align:right;">${quantidadeNotasBaixas}</td></tr>
  </table>

  <h2 style="font-size:16px;border-bottom:2px solid #222;padding-bottom:4px;">Recomendação</h2>
  <p>Considere realizar manutenção e revisão do veículo (limpeza, mecânica,
  itens de conforto) e verificar os comentários das avaliações recentes para
  identificar a causa da insatisfação.</p>
  ${rodapeHtml}
</div>`;

  const text = `ALERTA: BAIXA AVALIAÇÃO RECORRENTE

Olá, ${locador.nome} (${locador.empresa}).

O veículo abaixo vem recebendo avaliações baixas recorrentes nos últimos ${janelaDias} dias.

VEÍCULO
  ${nomeVeiculo(veiculo)} — placa ${veiculo.placa}

RESUMO DAS AVALIAÇÕES
  Média atual: ${mediaFmt}
  Avaliações no período: ${quantidade}
  Notas abaixo de ${notaBaixa}: ${quantidadeNotasBaixas}

RECOMENDAÇÃO
  Considere realizar manutenção e revisão do veículo e verificar os comentários das avaliações recentes.

Alerta automático do monitoramento de frota da Mova.`;

  return { subject, html, text };
}
