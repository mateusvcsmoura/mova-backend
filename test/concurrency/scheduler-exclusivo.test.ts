import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "../../src/database/prisma";
import { MonitoramentoScheduler } from "../../src/services/monitoramento-scheduler";
import type { MonitoramentoVeiculoService } from "../../src/services/monitoramento-veiculo";
import {
  LOCK_LOCALIZACAO_SIMULADOR,
  LOCK_MONITORAMENTO,
  runExclusive,
} from "../../src/shared/advisory-lock";

// Execução única entre múltiplas instâncias: o advisory lock do PostgreSQL
// (pg_try_advisory_xact_lock) garante que, quando dois ticks disparam ao mesmo
// tempo, só um roda o trabalho — o outro pula. Simulamos "duas instâncias" com
// ticks concorrentes no mesmo processo: cada runExclusive abre uma transação
// interativa, fixando conexões distintas do pool = sessões distintas.
describe("Execução única do scheduler (advisory lock)", () => {
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Aquece o pool: força a criação de conexões concorrentes de antemão. Sem
  // isso, o primeiro par de transações pode serializar numa única conexão
  // (setup lazy), liberando o lock entre elas e mascarando a exclusão mútua.
  beforeAll(async () => {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);
  });

  it("MonitoramentoScheduler.tick concorrente executa o serviço uma só vez", async () => {
    let execucoes = 0;
    let liberar!: () => void;
    const portao = new Promise<void>((r) => (liberar = r));
    let sinalizarEntrada!: () => void;
    const entrou = new Promise<void>((r) => (sinalizarEntrada = r));

    const service = {
      // Ao entrar, sinaliza e segura o lock até liberarmos — garante que o
      // segundo tick tente o lock com o primeiro ainda dentro.
      executar: async () => {
        execucoes++;
        sinalizarEntrada();
        await portao;
      },
    } as unknown as MonitoramentoVeiculoService;

    const scheduler = new MonitoramentoScheduler(service);

    const primeiro = scheduler.tick(); // entra e segura o lock
    await entrou;
    const segundo = await scheduler.tick(); // tenta com o lock tomado -> pula
    liberar();
    const primeiroOk = await primeiro;

    expect(execucoes).toBe(1); // um executou, o outro pulou
    expect(primeiroOk).toBe(true);
    expect(segundo).toBe(false);
  });

  it("runExclusive não roda fn quando o lock já está tomado", async () => {
    let rodou = 0;
    let liberar!: () => void;
    const portao = new Promise<void>((r) => (liberar = r));
    let sinalizarEntrada!: () => void;
    const entrou = new Promise<void>((r) => (sinalizarEntrada = r));

    const trabalho = async () => {
      rodou++;
      sinalizarEntrada();
      await portao;
    };

    const primeiro = runExclusive(LOCK_MONITORAMENTO, trabalho);
    await entrou;
    const segundo = await runExclusive(LOCK_MONITORAMENTO, trabalho);
    liberar();
    const primeiroOk = await primeiro;

    expect(rodou).toBe(1);
    expect(primeiroOk).toBe(true);
    expect(segundo).toBe(false);
  });

  it("locks de jobs diferentes não competem entre si", async () => {
    let rodou = 0;
    const trabalho = async () => {
      rodou++;
      await espera(50);
    };

    // Chaves distintas => ambos rodam.
    const [a, b] = await Promise.all([
      runExclusive(LOCK_MONITORAMENTO, trabalho),
      runExclusive(LOCK_LOCALIZACAO_SIMULADOR, trabalho),
    ]);

    expect(rodou).toBe(2);
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
});
