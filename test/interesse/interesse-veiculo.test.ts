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
import { InteresseVeiculoService } from "../../src/services/interesse-veiculo";
import {
  IVeiculoDisponivelNotifier,
  NotificacaoVeiculoDisponivelService,
} from "../../src/services/notificacao-veiculo-disponivel";
import { VeiculoService } from "../../src/services/veiculo";
import { HttpError } from "../../src/errors/HttpError";
import { buildPaginatedResult } from "../../src/shared/pagination";
import type { IMailProvider } from "../../src/infra/email/mail-provider";
import type { IInteresseVeiculoRepository } from "../../src/repositories/interesse.repository";
import type { INotificacaoInteresseRepository } from "../../src/repositories/notificacao-interesse.repository";
import type {
  InteressadoResponse,
  InteresseResponse,
} from "../../src/repositories/contracts/interesse.contract";
import type { NotificacaoInteresseResponse } from "../../src/repositories/contracts/notificacao-interesse.contract";
import type { VeiculoResponse } from "../../src/repositories/contracts/veiculo.contract";

// ---------------------------------------------------------------------------
// Fakes compartilhados
// ---------------------------------------------------------------------------

const LOCATARIO_A = "aaaaaaaa-1111-1111-1111-111111111111";
const LOCATARIO_B = "bbbbbbbb-2222-2222-2222-222222222222";
const VEICULO_1 = "cccccccc-3333-3333-3333-333333333333";

const CONTAS: Record<string, { nome: string; email: string }> = {
  [LOCATARIO_A]: { nome: "Ana Locatária", email: "ana@test.local" },
  [LOCATARIO_B]: { nome: "Beto Locatário", email: "beto@test.local" },
};

function makeVeiculo(
  overrides: Partial<VeiculoResponse> = {},
): VeiculoResponse {
  return {
    id: VEICULO_1,
    idLocador: "eeeeeeee-5555-5555-5555-555555555555",
    idModeloVeiculo: "mod-1",
    modeloVeiculo: {
      id: "mod-1",
      idLocador: "eeeeeeee-5555-5555-5555-555555555555",
      marca: "Fiat",
      modelo: "Argo",
      ano: 2022,
      cambio: "Manual",
      capacidade: 5,
      eletrico: false,
      adaptado: false,
      criadoEm: new Date(),
    },
    garagemId: "ffffffff-6666-6666-6666-666666666666",
    placa: "ABC1234",
    status: "MANUTENCAO",
    criadoEm: new Date(),
    ...overrides,
  } as VeiculoResponse;
}

// Repositório de inscrições em memória (spies para asserção de persistência).
function makeInteresseRepo() {
  let seq = 0;
  const records: InteresseResponse[] = [];

  const repo: IInteresseVeiculoRepository = {
    create: vi.fn(async (data) => {
      const rec: InteresseResponse = {
        id: `int-${++seq}`,
        idLocatario: data.idLocatario,
        idVeiculo: data.idVeiculo,
        status: "ATIVO",
        optInEm: new Date(),
        canceladoEm: null,
        notificadoEm: null,
        veiculo: {} as any,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      };
      records.push(rec);
      return rec;
    }),
    reativar: vi.fn(async (id) => {
      const rec = records.find((r) => r.id === id)!;
      rec.status = "ATIVO";
      rec.optInEm = new Date();
      rec.canceladoEm = null;
      rec.notificadoEm = null;
      return rec;
    }),
    cancelar: vi.fn(async (id) => {
      const rec = records.find((r) => r.id === id)!;
      rec.status = "CANCELADO";
      rec.canceladoEm = new Date();
    }),
    marcarNotificado: vi.fn(async (id, notificadoEm) => {
      const rec = records.find((r) => r.id === id)!;
      rec.status = "NOTIFICADO";
      rec.notificadoEm = notificadoEm;
    }),
    findByLocatarioAndVeiculo: vi.fn(
      async (idLocatario, idVeiculo) =>
        records.find(
          (r) => r.idLocatario === idLocatario && r.idVeiculo === idVeiculo,
        ) ?? null,
    ),
    findAtivosByLocatarioId: vi.fn(async (idLocatario, pagination) => {
      const data = records.filter(
        (r) => r.idLocatario === idLocatario && r.status === "ATIVO",
      );
      return buildPaginatedResult(data, data.length, pagination);
    }),
    findAtivosByVeiculo: vi.fn(async (idVeiculo) =>
      records
        .filter((r) => r.idVeiculo === idVeiculo && r.status === "ATIVO")
        .map(
          (r): InteressadoResponse => ({
            id: r.id,
            idLocatario: r.idLocatario,
            idVeiculo: r.idVeiculo,
            locatario: CONTAS[r.idLocatario],
          }),
        ),
    ),
  };
  return { repo, records };
}

// Repositório do histórico de envios em memória.
function makeNotificacaoInteresseRepo() {
  const records: NotificacaoInteresseResponse[] = [];
  const repo: INotificacaoInteresseRepository = {
    registrar: vi.fn(async (data) => {
      const rec: NotificacaoInteresseResponse = {
        id: `notif-${records.length + 1}`,
        idInteresse: data.idInteresse,
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
    findByInteresse: vi.fn(async (idInteresse) =>
      records.filter((r) => r.idInteresse === idInteresse),
    ),
  };
  return { repo, records };
}

const locatarioRepo = {
  findById: async (id: string) => (CONTAS[id] ? { id } : null),
} as any;

const veiculoRepoSomenteLeitura = (veiculo: VeiculoResponse | null) =>
  ({
    findById: async (id: string) =>
      veiculo && veiculo.id === id ? veiculo : null,
  }) as any;

const locadorRepo = {
  findById: async () => ({
    id: "eeeeeeee-5555-5555-5555-555555555555",
    empresa: "Locadora Mova Ltda",
    cnpj: "12345678000199",
  }),
} as any;

const garagemRepo = {
  findById: async () => ({
    id: "ffffffff-6666-6666-6666-666666666666",
    nome: "Garagem Central",
    endereco: "Avenida das Garagens, 500",
  }),
} as any;

function makeDispatcher(
  interesseRepo: IInteresseVeiculoRepository,
  notificacaoRepo: INotificacaoInteresseRepository,
  provider: IMailProvider,
) {
  return new NotificacaoVeiculoDisponivelService(
    interesseRepo,
    notificacaoRepo,
    locadorRepo,
    garagemRepo,
    provider,
  );
}

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
});

// ---------------------------------------------------------------------------
// InteresseVeiculoService — registro, duplicidade, cancelamento, isolamento
// ---------------------------------------------------------------------------

describe("InteresseVeiculoService", () => {
  function buildService(veiculo: VeiculoResponse | null = makeVeiculo()) {
    const { repo, records } = makeInteresseRepo();
    const service = new InteresseVeiculoService(
      repo,
      veiculoRepoSomenteLeitura(veiculo),
      locatarioRepo,
    );
    return { service, repo, records };
  }

  it("registra interesse com sucesso (opt-in persistido)", async () => {
    const { service, repo } = buildService();

    const interesse = await service.registrar(LOCATARIO_A, VEICULO_1);

    expect(interesse.status).toBe("ATIVO");
    expect(interesse.idLocatario).toBe(LOCATARIO_A);
    expect(interesse.idVeiculo).toBe(VEICULO_1);
    expect(interesse.optInEm).toBeInstanceOf(Date);
    expect(repo.create).toHaveBeenCalledWith({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });
  });

  it("retorna 404 ao registrar interesse em veículo inexistente", async () => {
    const { service, repo } = buildService(null);

    await expect(
      service.registrar(LOCATARIO_A, VEICULO_1),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("retorna 409 para inscrição duplicada enquanto ativa", async () => {
    const { service } = buildService();

    await service.registrar(LOCATARIO_A, VEICULO_1);

    await expect(
      service.registrar(LOCATARIO_A, VEICULO_1),
    ).rejects.toMatchObject({
      status: 409,
      message: "Você já possui uma inscrição ativa para este veículo.",
    });
  });

  it("cancela a inscrição ativa do próprio locatário", async () => {
    const { service, records } = buildService();

    await service.registrar(LOCATARIO_A, VEICULO_1);
    await service.cancelar(LOCATARIO_A, VEICULO_1);

    expect(records[0].status).toBe("CANCELADO");
    expect(records[0].canceladoEm).toBeInstanceOf(Date);
  });

  it("retorna 404 ao cancelar inscrição inexistente ou já encerrada", async () => {
    const { service } = buildService();

    await expect(
      service.cancelar(LOCATARIO_A, VEICULO_1),
    ).rejects.toBeInstanceOf(HttpError);

    await service.registrar(LOCATARIO_A, VEICULO_1);
    await service.cancelar(LOCATARIO_A, VEICULO_1);
    await expect(
      service.cancelar(LOCATARIO_A, VEICULO_1),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("permite reinscrição após cancelamento (reativação, opt-in renovado)", async () => {
    const { service, repo, records } = buildService();

    await service.registrar(LOCATARIO_A, VEICULO_1);
    await service.cancelar(LOCATARIO_A, VEICULO_1);
    const reativado = await service.registrar(LOCATARIO_A, VEICULO_1);

    expect(repo.reativar).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(1); // mesma linha, não duplica
    expect(reativado.status).toBe("ATIVO");
    expect(reativado.canceladoEm).toBeNull();
  });

  it("isola inscrições entre usuários", async () => {
    const { service, records } = buildService();

    await service.registrar(LOCATARIO_A, VEICULO_1);
    await service.registrar(LOCATARIO_B, VEICULO_1);

    // O cancelamento de B não afeta a inscrição de A.
    await service.cancelar(LOCATARIO_B, VEICULO_1);
    const deA = records.find((r) => r.idLocatario === LOCATARIO_A)!;
    const deB = records.find((r) => r.idLocatario === LOCATARIO_B)!;
    expect(deA.status).toBe("ATIVO");
    expect(deB.status).toBe("CANCELADO");

    // Listagem devolve apenas as inscrições ativas do próprio usuário.
    const listaA = await service.listar(LOCATARIO_A, { page: 1, limit: 10 });
    expect(listaA.data).toHaveLength(1);
    expect(listaA.data[0].idLocatario).toBe(LOCATARIO_A);
    const listaB = await service.listar(LOCATARIO_B, { page: 1, limit: 10 });
    expect(listaB.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// NotificacaoVeiculoDisponivelService — disparo, persistência, falhas
// ---------------------------------------------------------------------------

describe("NotificacaoVeiculoDisponivelService", () => {
  it("envia e-mail para os interessados e registra sucesso (PENDENTE -> ENVIADA)", async () => {
    const send = vi.fn(async () => ({ messageId: "ok" }));
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo: interesseRepo, records } = makeInteresseRepo();
    const { repo: notifRepo, records: envios } =
      makeNotificacaoInteresseRepo();

    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    await dispatcher.notificarVeiculoDisponivel(makeVeiculo());

    expect(send).toHaveBeenCalledTimes(1);
    const mensagem = (send as any).mock.calls[0][0];
    expect(mensagem.to).toBe("ana@test.local");
    // Conteúdo: veículo (marca/modelo/ano), placa, locador e garagem.
    expect(mensagem.subject).toContain("Fiat Argo");
    expect(mensagem.html).toContain("Fiat");
    expect(mensagem.html).toContain("Argo");
    expect(mensagem.html).toContain("ABC1234");
    expect(mensagem.html).toContain("Locadora Mova Ltda");
    expect(mensagem.html).toContain("Garagem Central");
    expect(mensagem.html).toContain("dispon");

    // Registro do envio persistido.
    expect(envios).toHaveLength(1);
    expect(envios[0].status).toBe("ENVIADA");
    expect(envios[0].destinatario).toBe("ana@test.local");
    expect(envios[0].enviadaEm).toBeInstanceOf(Date);

    // Inscrição encerrada automaticamente após o sucesso (sem reenvio).
    expect(records[0].status).toBe("NOTIFICADO");
    expect(records[0].notificadoEm).toBeInstanceOf(Date);
  });

  it("registra falha quando o SMTP falha, sem lançar, e mantém a inscrição ativa", async () => {
    const send = vi.fn(async () => {
      throw new Error("SMTP caiu");
    });
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo: interesseRepo, records } = makeInteresseRepo();
    const { repo: notifRepo, records: envios } =
      makeNotificacaoInteresseRepo();

    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    await expect(
      dispatcher.notificarVeiculoDisponivel(makeVeiculo()),
    ).resolves.toBeUndefined();

    expect(envios[0].status).toBe("FALHA");
    expect(envios[0].mensagemErro).toContain("SMTP caiu");
    // Inscrição permanece ATIVA para nova tentativa em disponibilidade futura.
    expect(records[0].status).toBe("ATIVO");
  });

  it("não notifica inscrições canceladas nem já notificadas — apenas ativas", async () => {
    const send = vi.fn(async () => ({ messageId: "ok" }));
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo: interesseRepo, records } = makeInteresseRepo();
    const { repo: notifRepo } = makeNotificacaoInteresseRepo();

    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });
    await interesseRepo.create({
      idLocatario: LOCATARIO_B,
      idVeiculo: VEICULO_1,
    });
    // A cancelou; B já foi notificado em evento anterior.
    await interesseRepo.cancelar(records[0].id);
    await interesseRepo.marcarNotificado(records[1].id, new Date());

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    await dispatcher.notificarVeiculoDisponivel(makeVeiculo());

    expect(send).not.toHaveBeenCalled();
  });

  it("uma falha de envio não interrompe os demais interessados", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("recusado"))
      .mockResolvedValueOnce({ messageId: "ok" });
    const provider: IMailProvider = { isEnabled: () => true, send };
    const { repo: interesseRepo, records } = makeInteresseRepo();
    const { repo: notifRepo, records: envios } =
      makeNotificacaoInteresseRepo();

    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });
    await interesseRepo.create({
      idLocatario: LOCATARIO_B,
      idVeiculo: VEICULO_1,
    });

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    await dispatcher.notificarVeiculoDisponivel(makeVeiculo());

    expect(send).toHaveBeenCalledTimes(2);
    expect(envios[0].status).toBe("FALHA");
    expect(envios[1].status).toBe("ENVIADA");
    expect(records[0].status).toBe("ATIVO"); // falhou -> continua ativa
    expect(records[1].status).toBe("NOTIFICADO");
  });

  it("não envia nem registra quando o provedor está desabilitado", async () => {
    const send = vi.fn();
    const provider: IMailProvider = { isEnabled: () => false, send };
    const { repo: interesseRepo } = makeInteresseRepo();
    const { repo: notifRepo } = makeNotificacaoInteresseRepo();

    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    await dispatcher.notificarVeiculoDisponivel(makeVeiculo());

    expect(send).not.toHaveBeenCalled();
    expect(notifRepo.registrar).not.toHaveBeenCalled();
  });

  it("envia através do Nodemailer (transport mockado)", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "msg-1" });
    const provider = new NodemailerMailProvider({
      host: "smtp.test.local",
      port: 465,
      user: "u@test.local",
      pass: "app-pass",
      from: "Mova <u@test.local>",
    });
    const { repo: interesseRepo, records } = makeInteresseRepo();
    const { repo: notifRepo, records: envios } =
      makeNotificacaoInteresseRepo();

    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    await dispatcher.notificarVeiculoDisponivel(makeVeiculo());

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@test.local" }),
    );
    expect(envios[0].status).toBe("ENVIADA");
    expect(records[0].status).toBe("NOTIFICADO");
  });
});

// ---------------------------------------------------------------------------
// VeiculoService — disparo automático na transição de status
// ---------------------------------------------------------------------------

describe("VeiculoService — disparo automático ao voltar a DISPONIVEL", () => {
  function makeVeiculoRepo(antes: VeiculoResponse) {
    let atual = antes;
    return {
      findById: vi.fn(async () => atual),
      update: vi.fn(async (_id: string, data: any) => {
        atual = { ...atual, ...data };
        return atual;
      }),
    } as any;
  }

  it("notifica quando o status muda para DISPONIVEL", async () => {
    const notifier: IVeiculoDisponivelNotifier = {
      notificarVeiculoDisponivel: vi.fn(async () => {}),
    };
    const repo = makeVeiculoRepo(makeVeiculo({ status: "MANUTENCAO" as any }));
    const service = new VeiculoService(repo, notifier);

    const atualizado = await service.update(
      VEICULO_1,
      { status: "DISPONIVEL" as any },
      { id: "admin", cargo: "ADMIN" as any },
    );

    expect(atualizado.status).toBe("DISPONIVEL");
    expect(notifier.notificarVeiculoDisponivel).toHaveBeenCalledTimes(1);
    expect(notifier.notificarVeiculoDisponivel).toHaveBeenCalledWith(
      expect.objectContaining({ id: VEICULO_1, status: "DISPONIVEL" }),
    );
  });

  it("não notifica em mudanças para outros status", async () => {
    const notifier: IVeiculoDisponivelNotifier = {
      notificarVeiculoDisponivel: vi.fn(async () => {}),
    };
    const repo = makeVeiculoRepo(makeVeiculo({ status: "DISPONIVEL" as any }));
    const service = new VeiculoService(repo, notifier);

    await service.update(VEICULO_1, { status: "MANUTENCAO" as any }, {
      id: "admin",
      cargo: "ADMIN" as any,
    });

    expect(notifier.notificarVeiculoDisponivel).not.toHaveBeenCalled();
  });

  it("não notifica quando o veículo já estava DISPONIVEL (sem transição)", async () => {
    const notifier: IVeiculoDisponivelNotifier = {
      notificarVeiculoDisponivel: vi.fn(async () => {}),
    };
    const repo = makeVeiculoRepo(makeVeiculo({ status: "DISPONIVEL" as any }));
    const service = new VeiculoService(repo, notifier);

    await service.update(VEICULO_1, { placa: "XYZ9876" }, {
      id: "admin",
      cargo: "ADMIN" as any,
    });

    expect(notifier.notificarVeiculoDisponivel).not.toHaveBeenCalled();
  });

  it("regressão: atualização de status continua funcionando sem notifier", async () => {
    const repo = makeVeiculoRepo(makeVeiculo({ status: "MANUTENCAO" as any }));
    const service = new VeiculoService(repo); // sem notifier (compatível)

    const atualizado = await service.update(
      VEICULO_1,
      { status: "DISPONIVEL" as any },
      { id: "admin", cargo: "ADMIN" as any },
    );

    expect(atualizado.status).toBe("DISPONIVEL");
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("regressão: a atualização conclui mesmo com o SMTP falhando", async () => {
    // Dispatcher real com provider que sempre falha — nunca lança.
    const provider: IMailProvider = {
      isEnabled: () => true,
      send: vi.fn(async () => {
        throw new Error("SMTP fora do ar");
      }),
    };
    const { repo: interesseRepo } = makeInteresseRepo();
    const { repo: notifRepo, records: envios } =
      makeNotificacaoInteresseRepo();
    await interesseRepo.create({
      idLocatario: LOCATARIO_A,
      idVeiculo: VEICULO_1,
    });

    const dispatcher = makeDispatcher(interesseRepo, notifRepo, provider);
    const repo = makeVeiculoRepo(makeVeiculo({ status: "RESERVADO" as any }));
    const service = new VeiculoService(repo, dispatcher);

    const atualizado = await service.update(
      VEICULO_1,
      { status: "DISPONIVEL" as any },
      { id: "admin", cargo: "ADMIN" as any },
    );

    // Veículo atualizado normalmente; a falha ficou registrada isoladamente.
    expect(atualizado.status).toBe("DISPONIVEL");
    expect(envios[0].status).toBe("FALHA");
  });
});
