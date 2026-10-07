import { describe, it, expect } from "vitest";

import { NodemailerMailProvider } from "../../src/infra/email/nodemailer.provider";
import { renderReservaReport } from "../../src/templates/reserva-report.template";
import type { ReservaReportPayload } from "../../src/services/contracts/reserva-report";

const DESTINO = "mateusvcsmoura@gmail.com";

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
};

const provider = new NodemailerMailProvider(smtpConfig);
const habilitado =
  process.env.RUN_REAL_EMAIL_TEST === "true" && provider.isEnabled();

// it.skipIf pula (sem falhar) quando o envio real não está habilitado.
const runIf = it.skipIf(!habilitado);

function payloadExemplo(): ReservaReportPayload {
  const inicio = new Date("2026-08-01T10:00:00.000Z");
  const fim = new Date("2026-08-04T10:00:00.000Z");
  return {
    reserva: {
      id: "11111111-2222-3333-4444-555555555555",
      criadaEm: new Date(),
      status: "CONFIRMADA",
      statusPagamento: "SUCESSO",
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      dias: 3,
      valorBase: 250,
      valorServicos: 100,
      valorTotal: 350,
      codigoDesbloqueio: "ABCD-2345",
      metodoPagamento: "PIX",
    },
    veiculo: {
      marca: "Fiat",
      modelo: "Argo",
      ano: 2022,
      placa: "ABC1234",
      categoria: "EXECUTIVO",
      cambio: "Automático",
      capacidade: 5,
      eletrico: true,
      adaptado: false,
    },
    locador: { empresa: "Locadora Mova Ltda" },
    locatario: { nome: "Mateus (teste)", email: DESTINO },
    retirada: { garagem: "Garagem Centro", endereco: "Av. Central, 100" },
    devolucao: {
      garagem: "Garagem Aeroporto",
      endereco: "Rod. do Aeroporto, 5000",
    },
    servicos: [
      { nome: "Seguro adicional", descricao: "Cobertura total", valor: 80 },
      { nome: "Tanque cheio", descricao: "Combustível", valor: 20 },
    ],
  };
}

describe("Envio de e-mail REAL (opt-in)", () => {
  runIf(
    `envia o relatório de reserva para ${DESTINO}`,
    async () => {
      const { subject, html, text } = renderReservaReport(payloadExemplo());

      const result = await provider.send({
        to: DESTINO,
        subject: `[TESTE] ${subject}`,
        html,
        text,
      });

      // Gmail/SMTP retorna um messageId ao aceitar a mensagem.
      expect(result.messageId).toBeTruthy();
      // eslint-disable-next-line no-console
      console.info(
        `[real-email] enviado para ${DESTINO} — messageId=${result.messageId}`,
      );
    },
    30_000, // SMTP pode demorar; timeout maior.
  );
});
