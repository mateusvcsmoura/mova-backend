import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do Nodemailer: nenhum e-mail real é enviado nos testes.
const sendMailMock = vi.fn();
const createTransportMock = vi.fn((..._args: unknown[]) => ({
  sendMail: sendMailMock,
}));
vi.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => createTransportMock(...args),
  // Alguns bundles importam default; cobrimos os dois.
  default: {
    createTransport: (...args: unknown[]) => createTransportMock(...args),
  },
}));

import { NodemailerMailProvider } from "../../src/infra/email/nodemailer.provider";
import { NotificacaoReservaService } from "../../src/services/notificacao-reserva";
import { ReservaReportService } from "../../src/services/reserva-report";
import { ReservaService } from "../../src/services/reserva";
import type { IMailProvider } from "../../src/infra/email/mail-provider";
import type { INotificacaoRepository } from "../../src/repositories/notificacao.repository";
import type { NotificacaoResponse } from "../../src/repositories/contracts/notificacao.contract";
import type { ReservaResponse } from "../../src/repositories/contracts/reserva.contract";

// ---------------------------------------------------------------------------
// Fakes compartilhados
// ---------------------------------------------------------------------------

function makeReserva(overrides: Partial<ReservaResponse> = {}): ReservaResponse {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    idVeiculo: "veic-1",
    idLocatario: "locatario-1",
    idGaragemRetirada: null,
    idGaragemDevolucao: null,
    dataHoraInicio: new Date("2026-08-01T10:00:00.000Z"),
    dataHoraFim: new Date("2026-08-03T10:00:00.000Z"),
    criadaEm: new Date("2026-07-01T09:00:00.000Z"),
    valorTotal: 300,
    status: "CONFIRMADA",
    statusPagamento: "SUCESSO",
    codigoDesbloqueio: "ABCD-2345",
    codigoGeradoEm: new Date(),
    codigoUsadoEm: null,
    servicos: [],
    ...overrides,
  } as ReservaResponse;
}

const reportRepos = {
  veiculo: {
    findById: async (id: string) => ({
      id,
      idLocador: "loc-1",
      idModeloVeiculo: "mod-1",
      modeloVeiculo: {
        id: "mod-1",
        idLocador: "loc-1",
        marca: "Fiat",
        modelo: "Argo",
        ano: 2022,
        cambio: "Manual",
        capacidade: 5,
        eletrico: false,
        adaptado: false,
        criadoEm: new Date(),
      },
      garagemId: null,
      placa: "ABC1234",
      status: "RESERVADO",
      criadoEm: new Date(),
    }),
  },
  conta: {
    findById: async (id: string) => ({
      id,
      nome: "João Locatário",
      email: "joao@test.local",
      telefone: null,
      criadaEm: new Date(),
      cep: "12345-678",
      endereco: "Rua Teste, 1",
      cargo: "LOCATARIO",
    }),
  },
  locador: {
    findById: async () => ({
      id: "loc-1",
      empresa: "Locadora Mova Ltda",
      cnpj: "12345678000199",
    }),
  },
  garagem: { findById: async () => null },
};

function makeReportService(): ReservaReportService {
  return new ReservaReportService(
    reportRepos.veiculo as any,
    reportRepos.conta as any,
    reportRepos.locador as any,
    reportRepos.garagem as any,
  );
}

// Repositório de notificação em memória (spies para asserção de persistência).
function makeNotificacaoRepo() {
  const records: NotificacaoResponse[] = [];
  const repo: INotificacaoRepository = {
    registrar: vi.fn(async (data) => {
      const rec: NotificacaoResponse = {
        id: `notif-${records.length + 1}`,
        idReserva: data.idReserva,
        destinatario: data.destinatario,
        assunto: data.assunto,
        canal: data.canal ?? "EMAIL",
        status: "PENDENTE",
        mensagemErro: null,
        criadaEm: new Date(),
        enviadaEm: null,
        atualizadoEm: new Date(),
      };
      records.push(rec);
      return rec;
    }),
    marcarEnviada: vi.fn(async (id, enviadaEm) => {
      const rec = records.find((r) => r.id === id)!;
      rec.status = "ENVIADA";
      rec.enviadaEm = enviadaEm;
      return rec;
    }),
    marcarFalha: vi.fn(async (id, mensagemErro) => {
      const rec = records.find((r) => r.id === id)!;
      rec.status = "FALHA";
      rec.mensagemErro = mensagemErro;
      return rec;
    }),
    findByReserva: vi.fn(async (idReserva) =>
      records.filter((r) => r.idReserva === idReserva),
    ),
  };
  return { repo, records };
}

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
});

// ---------------------------------------------------------------------------
// NodemailerMailProvider (mock do nodemailer)
// ---------------------------------------------------------------------------

describe("NodemailerMailProvider", () => {
  const fullConfig = {
    host: "smtp.gmail.com",
    port: 465,
    user: "u@gmail.com",
    pass: "app-pass",
    from: "Mova <u@gmail.com>",
  };

  it("isEnabled() é false quando a configuração está incompleta", () => {
    expect(new NodemailerMailProvider({}).isEnabled()).toBe(false);
    expect(
      new NodemailerMailProvider({ ...fullConfig, pass: undefined }).isEnabled(),
    ).toBe(false);
  });

  it("isEnabled() é true com a configuração completa", () => {
    expect(new NodemailerMailProvider(fullConfig).isEnabled()).toBe(true);
  });

  it("envia via sendMail com os campos corretos", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "msg-1" });
    const provider = new NodemailerMailProvider(fullConfig);

    const result = await provider.send({
      to: "dest@test.local",
      subject: "Assunto",
      html: "<b>oi</b>",
      text: "oi",
    });

    expect(result.messageId).toBe("msg-1");
    expect(sendMailMock).toHaveBeenCalledWith({
      from: fullConfig.from,
      to: "dest@test.local",
      subject: "Assunto",
      html: "<b>oi</b>",
      text: "oi",
    });
  });

  it("propaga erro quando o SMTP falha", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP indisponível"));
    const provider = new NodemailerMailProvider(fullConfig);
    await expect(
      provider.send({ to: "x@x", subject: "s", html: "h" }),
    ).rejects.toThrow("SMTP indisponível");
  });

  it("lança sem tentar enviar quando desabilitado", async () => {
    const provider = new NodemailerMailProvider({});
    await expect(
      provider.send({ to: "x@x", subject: "s", html: "h" }),
    ).rejects.toThrow(/não configurado/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// NotificacaoReservaService (orquestração + tratamento de erro)
// ---------------------------------------------------------------------------

describe("NotificacaoReservaService", () => {
  it("envia e registra sucesso (PENDENTE -> ENVIADA)", async () => {
    const send = vi.fn(async () => ({ messageId: "ok" }));
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo } = makeNotificacaoRepo();

    const service = new NotificacaoReservaService(
      makeReportService(),
      provider,
      repo,
    );

    await service.notificarReservaConfirmada(makeReserva());

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "joao@test.local" }),
    );
    expect(repo.registrar).toHaveBeenCalledTimes(1);
    expect(repo.marcarEnviada).toHaveBeenCalledTimes(1);
    expect(repo.marcarFalha).not.toHaveBeenCalled();
  });

  it("registra falha quando o SMTP falha, sem lançar", async () => {
    const send = vi.fn(async () => {
      throw new Error("SMTP caiu");
    });
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo, records } = makeNotificacaoRepo();

    const service = new NotificacaoReservaService(
      makeReportService(),
      provider,
      repo,
    );

    await expect(
      service.notificarReservaConfirmada(makeReserva()),
    ).resolves.toBeUndefined();

    expect(repo.registrar).toHaveBeenCalledTimes(1);
    expect(repo.marcarFalha).toHaveBeenCalledTimes(1);
    expect(records[0].status).toBe("FALHA");
    expect(records[0].mensagemErro).toContain("SMTP caiu");
  });

  it("não envia nem registra quando o provedor está desabilitado", async () => {
    const send = vi.fn();
    const provider: IMailProvider = { isEnabled: () => false, send };
    const { repo } = makeNotificacaoRepo();

    const service = new NotificacaoReservaService(
      makeReportService(),
      provider,
      repo,
    );

    await service.notificarReservaConfirmada(makeReserva());

    expect(send).not.toHaveBeenCalled();
    expect(repo.registrar).not.toHaveBeenCalled();
  });

  it("ignora reservas cujo pagamento não foi confirmado", async () => {
    const send = vi.fn(async () => ({ messageId: "ok" }));
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo } = makeNotificacaoRepo();

    const service = new NotificacaoReservaService(
      makeReportService(),
      provider,
      repo,
    );

    await service.notificarReservaConfirmada(
      makeReserva({ statusPagamento: "AGUARDANDO_PAGAMENTO" }),
    );

    expect(send).not.toHaveBeenCalled();
    expect(repo.registrar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regressão: a reserva continua funcionando quando o e-mail falha
// ---------------------------------------------------------------------------

describe("ReservaService.update — regressão de e-mail", () => {
  function buildReservaService(notifier: NotificacaoReservaService) {
    const base = makeReserva({
      status: "AGUARDANDO_PAGAMENTO",
      statusPagamento: "AGUARDANDO_PAGAMENTO",
      codigoDesbloqueio: null,
    });
    const confirmada = makeReserva(); // com código e SUCESSO

    const reservaRepository = {
      findById: vi.fn(async () => base),
      update: vi.fn(async () => ({ ...base, statusPagamento: "SUCESSO" })),
      gerarCodigoDesbloqueio: vi.fn(async () => confirmada),
      findByCodigoDesbloqueio: vi.fn(async () => null),
    } as any;

    const service = new ReservaService(
      reservaRepository,
      {} as any, // veiculoRepository (não usado nesta rota)
      {} as any, // locatarioRepository
      {} as any, // garagemRepository
      {} as any, // deficienciaRepository
      {} as any, // bloqueioService
      {} as any, // servicoOpcionalRepository
      {} as any, // condutorRepository
      notifier,
    );
    return { service, reservaRepository, confirmada };
  }

  it("confirma o pagamento mesmo com o SMTP falhando", async () => {
    // Provider que sempre falha -> notifier registra FALHA mas não lança.
    const provider: IMailProvider = {
      isEnabled: () => true,
      send: vi.fn(async () => {
        throw new Error("SMTP fora do ar");
      }),
    };
    const { repo, records } = makeNotificacaoRepo();
    const notifier = new NotificacaoReservaService(
      makeReportService(),
      provider,
      repo,
    );

    const { service, confirmada } = buildReservaService(notifier);

    const result = await service.update(
      confirmada.id,
      { statusPagamento: "SUCESSO" },
      { id: "admin-1", cargo: "ADMIN" as any },
    );

    // Reserva confirmada normalmente, com código gerado.
    expect(result.statusPagamento).toBe("SUCESSO");
    expect(result.codigoDesbloqueio).toBe("ABCD-2345");
    // E a falha do e-mail ficou registrada, isoladamente.
    expect(records[0].status).toBe("FALHA");
  });
});
