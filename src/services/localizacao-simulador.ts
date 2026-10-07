import { Cargo, StatusVeiculo } from "@prisma/client";

import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { VeiculoResponse } from "../repositories/contracts/veiculo.contract.js";
import { LocalizacaoService } from "./localizacao.js";
import {
  LOCK_LOCALIZACAO_SIMULADOR,
  runExclusive,
} from "../shared/advisory-lock.js";

// Status de veículos que o simulador mantém em movimento.
const STATUS_ATIVOS: StatusVeiculo[] = [
  StatusVeiculo.DISPONIVEL,
  StatusVeiculo.RESERVADO,
];

export interface LocalizacaoSimuladorConfig {
  // Período entre atualizações automáticas (ms).
  intervaloMs: number;
  // Coordenada base usada quando o veículo ainda não tem nenhuma posição.
  baseLatitude: number;
  baseLongitude: number;
  // Deslocamento máximo por tick, em graus (~0.0009° ≈ 100m).
  jitter: number;
}

const CONFIG_PADRAO: LocalizacaoSimuladorConfig = {
  intervaloMs: 15_000,
  baseLatitude: -23.5505, // centro de São Paulo
  baseLongitude: -46.6333,
  jitter: 0.0009,
};

const clamp = (valor: number, min: number, max: number) =>
  Math.min(Math.max(valor, min), max);

export class LocalizacaoSimulador {
  private readonly config: LocalizacaoSimuladorConfig;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly localizacaoRepository: ILocalizacaoRepository,
    private readonly localizacaoService: LocalizacaoService,
    config: Partial<LocalizacaoSimuladorConfig> = {},
  ) {
    this.config = { ...CONFIG_PADRAO, ...config };
  }

  // Próxima posição: drift aleatório sobre a última, ou a base se for a 1ª.
  private async proximaPosicao(idVeiculo: string) {
    const ultima =
      await this.localizacaoRepository.findLatestByVeiculoId(idVeiculo);

    const origemLat = ultima ? ultima.latitude : this.config.baseLatitude;
    const origemLng = ultima ? ultima.longitude : this.config.baseLongitude;

    const delta = () => (Math.random() * 2 - 1) * this.config.jitter;

    return {
      latitude: clamp(origemLat + delta(), -90, 90),
      longitude: clamp(origemLng + delta(), -180, 180),
    };
  }

  private async listarTodosVeiculos(): Promise<VeiculoResponse[]> {
    const limit = 100;
    const todos: VeiculoResponse[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const resultado = await this.veiculoRepository.findAll({ page, limit });
      todos.push(...resultado.data);
      totalPages = resultado.totalPages;
      page++;
    } while (page <= totalPages);

    return todos;
  }

  async tick(): Promise<number> {
    let atualizados = 0;
    await runExclusive(LOCK_LOCALIZACAO_SIMULADOR, async () => {
      atualizados = await this.executarRodada();
    });
    return atualizados;
  }

  private async executarRodada(): Promise<number> {
    const veiculos = await this.listarTodosVeiculos();
    const ativos = veiculos.filter((v) => STATUS_ATIVOS.includes(v.status));

    // Veículos são independentes: atualiza todos em paralelo.
    const resultados = await Promise.all(
      ativos.map(async (veiculo) => {
        try {
          const { latitude, longitude } = await this.proximaPosicao(veiculo.id);
          await this.localizacaoService.registrar({
            idVeiculo: veiculo.id,
            latitude,
            longitude,
          }, { id: veiculo.idLocador, cargo: Cargo.LOCADOR });
          return true;
        } catch (error) {
          // Falha em um veículo não derruba a rodada inteira.
          console.error(
            `[localizacao-simulador] falha ao atualizar veículo ${veiculo.id}:`,
            error,
          );
          return false;
        }
      }),
    );

    return resultados.filter(Boolean).length;
  }

  // Inicia o loop periódico. `unref` evita que o timer segure o processo vivo.
  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.tick().catch((error) =>
        console.error("[localizacao-simulador] erro no tick:", error),
      );
    }, this.config.intervaloMs);

    this.timer.unref?.();
    console.log(
      `[localizacao-simulador] ativo (intervalo ${this.config.intervaloMs}ms)`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
