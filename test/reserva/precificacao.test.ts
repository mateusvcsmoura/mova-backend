import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createServico,
  createVeiculo,
} from "../helpers";

function periodoEmHoras(inicioEmDias: number, horas: number) {
  const inicio = new Date(Date.now() + inicioEmDias * 24 * 60 * 60 * 1000);
  return {
    dataHoraInicio: inicio.toISOString(),
    dataHoraFim: new Date(inicio.getTime() + horas * 60 * 60 * 1000).toISOString(),
  };
}

describe("POST /api/reserva/precificacao", () => {
  async function contexto(valorDiaria = 100) {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Modelo preço ${valorDiaria}`,
      valorDiaria,
    });
    return { locatario, veiculo };
  }

  async function cotar(
    token: string,
    idLocatario: string,
    idVeiculo: string,
    periodo: ReturnType<typeof periodoEmHoras>,
    extras: Record<string, unknown> = {},
  ) {
    return request(app)
      .post("/api/reserva/precificacao")
      .set("Authorization", `Bearer ${token}`)
      .send({ idLocatario, idVeiculo, ...periodo, ...extras });
  }

  it("cobra uma diária para uma hora e para exatamente um dia", async () => {
    const { locatario, veiculo } = await contexto(100);

    const umaHora = await cotar(locatario.token, locatario.locatarioId, veiculo.id, periodoEmHoras(10, 1));
    const umDia = await cotar(locatario.token, locatario.locatarioId, veiculo.id, periodoEmHoras(20, 24));

    expect(umaHora.status).toBe(200);
    expect(umaHora.body.result).toMatchObject({ diarias: 1, valorBase: 100, valorTotal: 100 });
    expect(umDia.status).toBe(200);
    expect(umDia.body.result).toMatchObject({ diarias: 1, valorBase: 100, valorTotal: 100 });
  });

  it("arredonda múltiplos dias para cima e soma os serviços do catálogo", async () => {
    const { locatario, veiculo } = await contexto(100);
    const servico = await createServico({ valor: 49.9 });

    const resposta = await cotar(locatario.token, locatario.locatarioId, veiculo.id, periodoEmHoras(10, 49), { servicosIds: [servico.id] });

    expect(resposta.status).toBe(200);
    expect(resposta.body.result).toMatchObject({
      valorDiaria: 100,
      diarias: 3,
      valorBase: 300,
      valorServicos: 49.9,
      valorTotal: 349.9,
    });
  });

  it("ignora valorTotal manipulado e mantém o snapshot após reajuste do modelo", async () => {
    const { locatario, veiculo } = await contexto(100);
    const periodo = periodoEmHoras(10, 24);

    const cotacao = await cotar(locatario.token, locatario.locatarioId, veiculo.id, periodo, { valorTotal: 1 });
    expect(cotacao.status).toBe(200);
    expect(cotacao.body.result.valorTotal).toBe(100);

    const criacao = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idLocatario: locatario.locatarioId,
        idVeiculo: veiculo.id,
        ...periodo,
        valorTotal: 1,
      });
    expect(criacao.status).toBe(201);
    expect(criacao.body.result.valorTotal).toBe(100);
    const reserva = criacao.body.result;

    await prisma.modeloVeiculo.update({
      where: { id: veiculo.idModeloVeiculo },
      data: { valorDiaria: 200 },
    });

    const existente = await request(app)
      .get(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(existente.status).toBe(200);
    expect(existente.body.result.valorTotal).toBe(100);

    const novaCotacao = await cotar(locatario.token, locatario.locatarioId, veiculo.id, periodoEmHoras(20, 24));
    expect(novaCotacao.body.result.valorTotal).toBe(200);
  });
});
