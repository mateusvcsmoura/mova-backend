import { StatusVeiculo } from "@prisma/client";

import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { LocalizacaoService } from "./localizacao.js";

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

/**
 * Simulador de rastreador GPS.
 *
 * NÃO integra hardware nem libs externas: a cada `intervaloMs` gera uma nova
 * posição (com pequeno drift sobre a última conhecida) para cada veículo ativo
 * e persiste via `LocalizacaoService.registrar`, reutilizando toda a validação
 * e o histórico já existentes.
 *
 * Roda inteiramente no servidor (sem HTTP/auth): é código confiável, então não
 * passa pela camada de autenticação — o endpoint HTTP continua disponível para
 * dispositivos reais no futuro.
 */
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

  /**
   * Executa uma rodada de atualização. Público para ser testável sem timer.
   * Retorna quantos veículos foram atualizados.
   */
  async tick(): Promise<number> {
    const veiculos = await this.veiculoRepository.findAll();
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
          });
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
