import { MonitoramentoVeiculoService } from "./monitoramento-veiculo.js";
import {
  LOCK_MONITORAMENTO,
  runExclusive,
} from "../shared/advisory-lock.js";

export interface MonitoramentoSchedulerConfig {
  intervaloMs: number;
}

const CONFIG_PADRAO: MonitoramentoSchedulerConfig = {
  intervaloMs: 60 * 60 * 1000,
};

export class MonitoramentoScheduler {
  private readonly config: MonitoramentoSchedulerConfig;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly monitoramentoService: MonitoramentoVeiculoService,
    config: Partial<MonitoramentoSchedulerConfig> = {},
  ) {
    this.config = { ...CONFIG_PADRAO, ...config };
  }

  async tick(): Promise<boolean> {
    return runExclusive(LOCK_MONITORAMENTO, async () => {
      await this.monitoramentoService.executar();
    });
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
