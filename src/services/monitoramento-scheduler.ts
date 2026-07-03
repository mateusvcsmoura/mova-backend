import { MonitoramentoVeiculoService } from "./monitoramento-veiculo.js";

export interface MonitoramentoSchedulerConfig {
  // Período entre execuções da rotina (ms). Alterável via env
  // MONITORAMENTO_INTERVALO_MS sem tocar no código.
  intervaloMs: number;
}

const CONFIG_PADRAO: MonitoramentoSchedulerConfig = {
  // 1x por hora por padrão: as regras têm granularidade de dias, então uma
  // frequência maior só gastaria consultas sem mudar o resultado.
  intervaloMs: 60 * 60 * 1000,
};

/**
 * Rotina periódica de monitoramento da frota (mesma estratégia do
 * LocalizacaoSimulador: setInterval iniciado opcionalmente no boot — ver
 * src/server.ts). Sem dependências novas de cron: o intervalo cobre a
 * necessidade e é configurável por env.
 *
 * Roda inteiramente no servidor (sem HTTP/auth). O MonitoramentoVeiculoService
 * nunca lança, mas o tick ainda captura qualquer erro para o timer jamais
 * derrubar o processo.
 */
export class MonitoramentoScheduler {
  private readonly config: MonitoramentoSchedulerConfig;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly monitoramentoService: MonitoramentoVeiculoService,
    config: Partial<MonitoramentoSchedulerConfig> = {},
  ) {
    this.config = { ...CONFIG_PADRAO, ...config };
  }

  // Executa uma rodada. Público para ser testável e acionável sem timer
  // (endpoint administrativo usa o service diretamente).
  async tick(): Promise<void> {
    await this.monitoramentoService.executar();
  }

  // Inicia o loop periódico. `unref` evita que o timer segure o processo vivo.
  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.tick().catch((error) =>
        console.error("[monitoramento] erro no tick:", error),
      );
    }, this.config.intervaloMs);

    this.timer.unref?.();
    console.log(
      `[monitoramento] ativo (intervalo ${this.config.intervaloMs}ms)`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
