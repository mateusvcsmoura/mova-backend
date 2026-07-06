import { describe, it, expect, beforeAll } from "vitest";

import { LocalizacaoSimulador } from "../../src/services/localizacao-simulador";
import {
  localizacaoRepository,
  localizacaoService,
  veiculoRepository,
} from "../../src/routes/container";
import { createLocador, createVeiculo, type LocadorContext } from "../helpers";

describe("LocalizacaoSimulador", () => {
  let locador: LocadorContext;
  // Config determinística: base fixa e jitter pequeno.
  const simulador = new LocalizacaoSimulador(
    veiculoRepository,
    localizacaoRepository,
    localizacaoService,
    { baseLatitude: -23.55, baseLongitude: -46.63, jitter: 0.001 },
  );

  beforeAll(async () => {
    locador = await createLocador();
  });

  it("atualiza veículos DISPONIVEL/RESERVADO e ignora INATIVO/MANUTENCAO", async () => {
    const disponivel = await createVeiculo(locador.token, locador.locadorId);
    const reservado = await createVeiculo(locador.token, locador.locadorId, {
      status: "RESERVADO",
    });
    const inativo = await createVeiculo(locador.token, locador.locadorId, {
      status: "INATIVO",
    });

    const atualizados = await simulador.tick();
    expect(atualizados).toBeGreaterThanOrEqual(2);

    const paginacao = { page: 1, limit: 100 };
    const hDisponivel = await localizacaoRepository.findByVeiculoId(
      disponivel.id,
      paginacao,
    );
    const hReservado = await localizacaoRepository.findByVeiculoId(
      reservado.id,
      paginacao,
    );
    const hInativo = await localizacaoRepository.findByVeiculoId(
      inativo.id,
      paginacao,
    );

    expect(hDisponivel.total).toBe(1);
    expect(hReservado.total).toBe(1);
    expect(hInativo.total).toBe(0);
  }, 20_000);

  it("gera posição dentro dos limites válidos de coordenada", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    await simulador.tick();

    const ultima = await localizacaoRepository.findLatestByVeiculoId(
      veiculo.id,
    );
    expect(ultima).not.toBeNull();
    expect(ultima!.latitude).toBeGreaterThanOrEqual(-90);
    expect(ultima!.latitude).toBeLessThanOrEqual(90);
    expect(ultima!.longitude).toBeGreaterThanOrEqual(-180);
    expect(ultima!.longitude).toBeLessThanOrEqual(180);
  }, 20_000);

  it("acumula histórico a cada tick, sem sobrescrever (drift sobre a última)", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    await simulador.tick();
    await simulador.tick();
    await simulador.tick();

    const historico = await localizacaoRepository.findByVeiculoId(veiculo.id, {
      page: 1,
      limit: 100,
    });
    // 3 ticks => pelo menos 3 registros para este veículo.
    expect(historico.total).toBeGreaterThanOrEqual(3);

    // Drift contido: posições próximas da base (jitter acumulado pequeno).
    for (const ponto of historico.data) {
      expect(Math.abs(ponto.latitude - -23.55)).toBeLessThan(1);
      expect(Math.abs(ponto.longitude - -46.63)).toBeLessThan(1);
    }
  }, 20_000);
});
