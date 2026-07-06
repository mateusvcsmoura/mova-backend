import { describe, it, expect, vi, afterEach } from "vitest";

import {
  MonitoramentoVeiculoService,
  ResultadoMonitoramento,
} from "../../src/services/monitoramento-veiculo";
import { MonitoramentoScheduler } from "../../src/services/monitoramento-scheduler";
import { NotificacaoAlertaVeiculoService } from "../../src/services/notificacao-alerta-veiculo";
import { VeiculoService } from "../../src/services/veiculo";
import type { IMailProvider } from "../../src/infra/email/mail-provider";
import type { IMonitoramentoVeiculoRepository } from "../../src/repositories/monitoramento.repository";
import type {
  AlertaVeiculoResponse,
  VeiculoBaixaAvaliacaoRow,
  VeiculoInativoRow,
} from "../../src/repositories/contracts/monitoramento.contract";
import type { VeiculoResponse } from "../../src/repositories/contracts/veiculo.contract";

// ---------------------------------------------------------------------------
// Fakes compartilhados
// ---------------------------------------------------------------------------

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const diasAtras = (dias: number) => new Date(Date.now() - dias * UM_DIA_MS);

const VEICULO_1 = "cccccccc-3333-3333-3333-333333333333";
const VEICULO_2 = "dddddddd-4444-4444-4444-444444444444";
const LOCADOR_1 = "eeeeeeee-5555-5555-5555-555555555555";

function makeInativoRow(
  overrides: Partial<VeiculoInativoRow> = {},
): VeiculoInativoRow {
  return {
    idVeiculo: VEICULO_1,
    idLocador: LOCADOR_1,
    placa: "ABC1234",
    marca: "Fiat",
    modelo: "Argo",
    ano: 2022,
    inativoDesde: diasAtras(9),
    locadorNome: "Lúcia Locadora",
    locadorEmail: "lucia@test.local",
    locadorEmpresa: "Locadora Mova Ltda",
    ...overrides,
  };
}

function makeBaixaRow(
  overrides: Partial<VeiculoBaixaAvaliacaoRow> = {},
): VeiculoBaixaAvaliacaoRow {
  return {
    idVeiculo: VEICULO_2,
    idLocador: LOCADOR_1,
    placa: "XYZ9876",
    marca: "Chevrolet",
    modelo: "Onix",
    ano: 2023,
    media: 2.2,
    quantidade: 4,
    quantidadeNotasBaixas: 3,
    locadorNome: "Lúcia Locadora",
    locadorEmail: "lucia@test.local",
    locadorEmpresa: "Locadora Mova Ltda",
    ...overrides,
  };
}

// Repositório de monitoramento em memória. As consultas de candidatos aplicam
// os MESMOS critérios das queries reais (data-limite / HAVING), para que os
// testes exerçam os thresholds passados pelo service.
function makeMonitoramentoRepo(dados?: {
  inativos?: VeiculoInativoRow[];
  avaliacoes?: VeiculoBaixaAvaliacaoRow[];
}) {
  let seq = 0;
  const alertas: AlertaVeiculoResponse[] = [];
  const inativos = dados?.inativos ?? [];
  const avaliacoes = dados?.avaliacoes ?? [];
  const transicoes: Array<{ idVeiculo: string; status: string }> = [];

  const repo: IMonitoramentoVeiculoRepository = {
    registrarStatus: vi.fn(async (idVeiculo, status) => {
      transicoes.push({ idVeiculo, status });
    }),
    findVeiculosInativosDesde: vi.fn(async (limite) =>
      inativos.filter((v) => v.inativoDesde.getTime() <= limite.getTime()),
    ),
    findVeiculosComBaixaAvaliacao: vi.fn(async (criterio) =>
      avaliacoes.filter(
        (v) =>
          (v.quantidade >= criterio.minAvaliacoes &&
            v.media < criterio.mediaMinima) ||
          v.quantidadeNotasBaixas >= criterio.minNotasBaixas,
      ),
    ),
    registrarAlerta: vi.fn(async (data) => {
      const alerta: AlertaVeiculoResponse = {
        id: `alerta-${++seq}`,
        tipo: data.tipo,
        idVeiculo: data.idVeiculo,
        idLocador: data.idLocador,
        descricao: data.descricao,
        destinatario: data.destinatario,
        assunto: data.assunto,
        canal: data.canal ?? "EMAIL",
        status: "PENDENTE",
        mensagemErro: null,
        criadoEm: new Date(),
        enviadoEm: null,
        resolvidoEm: null,
        atualizadoEm: new Date(),
      };
      alertas.push(alerta);
      return alerta;
    }),
    marcarEnviado: vi.fn(async (id, enviadoEm) => {
      const a = alertas.find((x) => x.id === id)!;
      a.status = "ENVIADA";
      a.enviadoEm = enviadoEm;
      a.mensagemErro = null;
      return a;
    }),
    marcarFalha: vi.fn(async (id, mensagemErro) => {
      const a = alertas.find((x) => x.id === id)!;
      a.status = "FALHA";
      a.mensagemErro = mensagemErro;
      return a;
    }),
    resolver: vi.fn(async (id, resolvidoEm) => {
      const a = alertas.find((x) => x.id === id)!;
      a.resolvidoEm = resolvidoEm;
      return a;
    }),
    findAlertaAtivo: vi.fn(
      async (idVeiculo, tipo) =>
        alertas.find(
          (a) =>
            a.idVeiculo === idVeiculo &&
            a.tipo === tipo &&
            a.resolvidoEm === null,
        ) ?? null,
    ),
    findAtivosByTipo: vi.fn(async (tipo) =>
      alertas.filter((a) => a.tipo === tipo && a.resolvidoEm === null),
    ),
    findByVeiculo: vi.fn(async (idVeiculo) =>
      alertas.filter((a) => a.idVeiculo === idVeiculo),
    ),
  };

  return { repo, alertas, inativos, avaliacoes, transicoes };
}

function makeProvider(sendImpl?: () => Promise<unknown>) {
  const send = vi.fn(sendImpl ?? (async () => ({ messageId: "ok" })));
  const provider: IMailProvider = {
    isEnabled: () => true,
    send: send as IMailProvider["send"],
  };
  return { provider, send };
}

function makeService(
  repo: IMonitoramentoVeiculoRepository,
  provider: IMailProvider,
) {
  const dispatcher = new NotificacaoAlertaVeiculoService(repo, provider);
  return new MonitoramentoVeiculoService(repo, dispatcher);
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Regra 1 — veículo inativo
// ---------------------------------------------------------------------------

describe("MonitoramentoVeiculoService — inatividade", () => {
  it("não gera alerta para veículo inativo há menos de 7 dias", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      inativos: [makeInativoRow({ inativoDesde: diasAtras(3) })],
    });
    const { provider, send } = makeProvider();

    const resultado = await makeService(repo, provider).executar();

    expect(resultado.inatividade.candidatos).toBe(0);
    expect(alertas).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("gera alerta, registra e envia e-mail para veículo inativo há mais de 7 dias", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      inativos: [makeInativoRow({ inativoDesde: diasAtras(9) })],
    });
    const { provider, send } = makeProvider();

    const resultado = await makeService(repo, provider).executar();

    expect(resultado.inatividade.candidatos).toBe(1);
    expect(resultado.inatividade.alertasGerados).toBe(1);
    expect(resultado.inatividade.notificacoesEnviadas).toBe(1);

    // Registro do alerta (auditoria).
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe("INATIVIDADE");
    expect(alertas[0].status).toBe("ENVIADA");
    expect(alertas[0].enviadoEm).toBeInstanceOf(Date);
    expect(alertas[0].descricao).toContain("9 dias");

    // Conteúdo do e-mail: veículo, placa, dias, recomendação.
    const mensagem = (send as any).mock.calls[0][0];
    expect(mensagem.to).toBe("lucia@test.local");
    expect(mensagem.subject).toContain("inativo há 9 dias");
    expect(mensagem.html).toContain("Fiat");
    expect(mensagem.html).toContain("Argo");
    expect(mensagem.html).toContain("ABC1234");
    expect(mensagem.html).toContain("Revise o cadastro");
  });
});

// ---------------------------------------------------------------------------
// Regra 2 — baixa avaliação recorrente
// ---------------------------------------------------------------------------

describe("MonitoramentoVeiculoService — baixa avaliação", () => {
  it("não gera alerta para veículo com média adequada", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      avaliacoes: [
        makeBaixaRow({ media: 4.5, quantidade: 10, quantidadeNotasBaixas: 1 }),
      ],
    });
    const { provider, send } = makeProvider();

    const resultado = await makeService(repo, provider).executar();

    expect(resultado.baixaAvaliacao.candidatos).toBe(0);
    expect(alertas).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("não gera alerta baseado em uma única avaliação isolada", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      avaliacoes: [
        makeBaixaRow({ media: 1, quantidade: 1, quantidadeNotasBaixas: 1 }),
      ],
    });
    const { provider } = makeProvider();

    const resultado = await makeService(repo, provider).executar();

    expect(resultado.baixaAvaliacao.candidatos).toBe(0);
    expect(alertas).toHaveLength(0);
  });

  it("gera alerta para média baixa recorrente, com resumo no e-mail", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      avaliacoes: [
        makeBaixaRow({ media: 2.2, quantidade: 4, quantidadeNotasBaixas: 3 }),
      ],
    });
    const { provider, send } = makeProvider();

    const resultado = await makeService(repo, provider).executar();

    expect(resultado.baixaAvaliacao.alertasGerados).toBe(1);
    expect(alertas[0].tipo).toBe("BAIXA_AVALIACAO");
    expect(alertas[0].status).toBe("ENVIADA");

    // Conteúdo: média, quantidade, resumo das notas, recomendação.
    const mensagem = (send as any).mock.calls[0][0];
    expect(mensagem.subject).toContain("2.2");
    expect(mensagem.html).toContain("2.2");
    expect(mensagem.html).toContain("Avaliações no período");
    expect(mensagem.html).toContain("manutenção");
  });

  it("gera alerta por notas baixas recorrentes mesmo com média >= 3 (critério OU)", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      avaliacoes: [
        makeBaixaRow({ media: 3.4, quantidade: 10, quantidadeNotasBaixas: 3 }),
      ],
    });
    const { provider } = makeProvider();

    const resultado = await makeService(repo, provider).executar();

    expect(resultado.baixaAvaliacao.candidatos).toBe(1);
    expect(alertas).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Deduplicação, falha de envio e resolução
// ---------------------------------------------------------------------------

describe("MonitoramentoVeiculoService — dedup, falha e resolução", () => {
  it("não envia e-mail repetido enquanto o alerta continuar ativo", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      inativos: [makeInativoRow()],
    });
    const { provider, send } = makeProvider();
    const service = makeService(repo, provider);

    await service.executar();
    const segunda = await service.executar();

    expect(alertas).toHaveLength(1); // nenhum alerta novo
    expect(send).toHaveBeenCalledTimes(1); // nenhum reenvio
    expect(segunda.inatividade.ignoradosDuplicados).toBe(1);
    expect(segunda.inatividade.alertasGerados).toBe(0);
  });

  it("registra falha de envio (FALHA + mensagem) sem lançar e re-tenta na execução seguinte", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      inativos: [makeInativoRow()],
    });
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("SMTP caiu"))
      .mockResolvedValueOnce({ messageId: "ok" });
    const provider: IMailProvider = {
      isEnabled: () => true,
      send: send as IMailProvider["send"],
    };
    const service = makeService(repo, provider);

    // 1ª execução: falha registrada, sem exceção.
    const primeira = await service.executar();
    expect(primeira.inatividade.falhasEnvio).toBe(1);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].status).toBe("FALHA");
    expect(alertas[0].mensagemErro).toContain("SMTP caiu");

    // 2ª execução: reaproveita o MESMO alerta (sem duplicar) e envia.
    const segunda = await service.executar();
    expect(segunda.inatividade.reenvios).toBe(1);
    expect(segunda.inatividade.notificacoesEnviadas).toBe(1);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].status).toBe("ENVIADA");
  });

  it("mantém o alerta PENDENTE quando o provedor está desabilitado", async () => {
    const { repo, alertas } = makeMonitoramentoRepo({
      inativos: [makeInativoRow()],
    });
    const send = vi.fn();
    const provider: IMailProvider = {
      isEnabled: () => false,
      send: send as IMailProvider["send"],
    };

    await makeService(repo, provider).executar();

    expect(send).not.toHaveBeenCalled();
    expect(alertas).toHaveLength(1); // alerta registrado mesmo sem envio
    expect(alertas[0].status).toBe("PENDENTE");
  });

  it("resolve o alerta quando a condição deixa de valer e permite novo alerta em reincidência", async () => {
    const inativos = [makeInativoRow()];
    const { repo, alertas } = makeMonitoramentoRepo({ inativos });
    const { provider } = makeProvider();
    const service = makeService(repo, provider);

    await service.executar();
    expect(alertas[0].resolvidoEm).toBeNull();

    // Veículo reativado: deixa de ser candidato -> alerta resolvido.
    inativos.length = 0;
    const segunda = await service.executar();
    expect(segunda.inatividade.alertasResolvidos).toBe(1);
    expect(alertas[0].resolvidoEm).toBeInstanceOf(Date);

    // Reincidência: volta a ficar inativo -> novo alerta (o anterior está
    // resolvido, então não bloqueia).
    inativos.push(makeInativoRow());
    const terceira = await service.executar();
    expect(terceira.inatividade.alertasGerados).toBe(1);
    expect(alertas).toHaveLength(2);
  });

  it("nunca lança, mesmo com o repositório falhando", async () => {
    const { repo } = makeMonitoramentoRepo();
    (repo.findVeiculosInativosDesde as any).mockRejectedValue(
      new Error("db fora do ar"),
    );
    (repo.findVeiculosComBaixaAvaliacao as any).mockRejectedValue(
      new Error("db fora do ar"),
    );
    const { provider } = makeProvider();

    const resultado: ResultadoMonitoramento = await makeService(
      repo,
      provider,
    ).executar();

    expect(resultado.inatividade.candidatos).toBe(0);
    expect(resultado.baixaAvaliacao.candidatos).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rotina periódica (scheduler)
// ---------------------------------------------------------------------------

describe("MonitoramentoScheduler", () => {
  it("executa o monitoramento periodicamente e para no stop()", async () => {
    vi.useFakeTimers();
    const executar = vi.fn(async () => ({}) as ResultadoMonitoramento);
    const scheduler = new MonitoramentoScheduler(
      { executar } as unknown as MonitoramentoVeiculoService,
      { intervaloMs: 1000 },
    );

    scheduler.start();
    expect(executar).not.toHaveBeenCalled(); // só dispara após o intervalo

    await vi.advanceTimersByTimeAsync(1000);
    expect(executar).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(executar).toHaveBeenCalledTimes(3);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(executar).toHaveBeenCalledTimes(3); // nada após stop
  });

  it("um erro no tick não derruba o loop", async () => {
    vi.useFakeTimers();
    const executar = vi
      .fn()
      .mockRejectedValueOnce(new Error("falhou"))
      .mockResolvedValue({});
    const scheduler = new MonitoramentoScheduler(
      { executar } as unknown as MonitoramentoVeiculoService,
      { intervaloMs: 1000 },
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(2000);

    expect(executar).toHaveBeenCalledTimes(2); // continuou após o erro
    scheduler.stop();
  });
});

// ---------------------------------------------------------------------------
// Regressão — VeiculoService continua funcionando com/sem recorder
// ---------------------------------------------------------------------------

describe("VeiculoService — histórico de status (regressão)", () => {
  function makeVeiculo(status: string): VeiculoResponse {
    return {
      id: VEICULO_1,
      idLocador: LOCADOR_1,
      idModeloVeiculo: "mod-1",
      modeloVeiculo: {
        id: "mod-1",
        idLocador: LOCADOR_1,
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
      status: status as VeiculoResponse["status"],
      criadoEm: new Date(),
    };
  }

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

  it("registra a transição de status quando há recorder", async () => {
    const { repo: monitRepo, transicoes } = makeMonitoramentoRepo();
    const repo = makeVeiculoRepo(makeVeiculo("DISPONIVEL"));
    const service = new VeiculoService(repo, undefined, monitRepo);

    await service.update(VEICULO_1, { status: "INATIVO" as any }, {
      id: "admin",
      cargo: "ADMIN" as any,
    });

    expect(transicoes).toEqual([{ idVeiculo: VEICULO_1, status: "INATIVO" }]);
  });

  it("não registra transição quando o status não muda", async () => {
    const { repo: monitRepo, transicoes } = makeMonitoramentoRepo();
    const repo = makeVeiculoRepo(makeVeiculo("DISPONIVEL"));
    const service = new VeiculoService(repo, undefined, monitRepo);

    await service.update(VEICULO_1, { placa: "XYZ9876" }, {
      id: "admin",
      cargo: "ADMIN" as any,
    });

    expect(transicoes).toHaveLength(0);
  });

  it("a atualização conclui mesmo com o recorder falhando (ex.: migration pendente)", async () => {
    const { repo: monitRepo } = makeMonitoramentoRepo();
    (monitRepo.registrarStatus as any).mockRejectedValue(
      new Error("tabela inexistente"),
    );
    const repo = makeVeiculoRepo(makeVeiculo("DISPONIVEL"));
    const service = new VeiculoService(repo, undefined, monitRepo);

    const atualizado = await service.update(
      VEICULO_1,
      { status: "INATIVO" as any },
      { id: "admin", cargo: "ADMIN" as any },
    );

    expect(atualizado.status).toBe("INATIVO");
  });

  it("regressão: atualização de status continua funcionando sem recorder", async () => {
    const repo = makeVeiculoRepo(makeVeiculo("MANUTENCAO"));
    const service = new VeiculoService(repo);

    const atualizado = await service.update(
      VEICULO_1,
      { status: "DISPONIVEL" as any },
      { id: "admin", cargo: "ADMIN" as any },
    );

    expect(atualizado.status).toBe("DISPONIVEL");
  });
});
