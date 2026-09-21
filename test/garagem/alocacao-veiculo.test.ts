import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createVeiculo,
  futurePeriod,
  LocadorContext,
  LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("FINAL-H-04 — alocação operacional de veículos", () => {
  let locadorA: LocadorContext;
  let locadorB: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locadorA = await createLocador();
    locadorB = await createLocador();
    locatario = await createLocatario();
  });

  it("persiste garagemId informado no cadastro do veículo", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId);

    const response = await request(app)
      .post("/api/veiculo")
      .set(auth(locadorA.token))
      .send({
        idLocador: locadorA.locadorId,
        placa: "H040001",
        marca: "MOVA",
        modelo: "Cadastro H04",
        ano: 2024,
        cambio: "Manual",
        capacidade: 5,
        valorDiaria: 150,
        eletrico: false,
        adaptado: false,
        garagemId: garagem.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.result.garagemId).toBe(garagem.id);

    const persisted = await prisma.veiculo.findUnique({
      where: { id: response.body.result.id },
      select: { garagemId: true },
    });
    expect(persisted?.garagemId).toBe(garagem.id);
  });

  it("rejeita garagem de outro locador no cadastro", async () => {
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId);

    const response = await request(app)
      .post("/api/veiculo")
      .set(auth(locadorA.token))
      .send({
        idLocador: locadorA.locadorId,
        placa: "H040002",
        marca: "MOVA",
        modelo: "Ownership H04",
        ano: 2024,
        cambio: "Manual",
        capacidade: 5,
        valorDiaria: 150,
        eletrico: false,
        adaptado: false,
        garagemId: garagemB.id,
      });

    expect(response.status).toBe(403);
  });

  it("aloca, move e torna a repetição idempotente sem consumir vaga duas vezes", async () => {
    const garagemA = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 2,
    });
    const garagemB = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 2,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });

    const primeira = await request(app)
      .post(`/api/garagem/${garagemA.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));
    expect(primeira.status).toBe(204);

    const repetida = await request(app)
      .post(`/api/garagem/${garagemA.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));
    expect(repetida.status).toBe(204);

    const movida = await request(app)
      .post(`/api/garagem/${garagemB.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));
    expect(movida.status).toBe(204);

    const estado = await prisma.veiculo.findUnique({
      where: { id: veiculo.id },
      select: { garagemId: true },
    });
    const contagens = await prisma.garagem.findMany({
      where: { id: { in: [garagemA.id, garagemB.id] } },
      select: { id: true, veiculosAlocados: true },
    });

    expect(estado?.garagemId).toBe(garagemB.id);
    expect(contagens.find((g) => g.id === garagemA.id)?.veiculosAlocados).toBe(0);
    expect(contagens.find((g) => g.id === garagemB.id)?.veiculosAlocados).toBe(1);
  });

  it("não permite cruzar ownership de garagem ou veículo", async () => {
    const garagemA = await createGaragem(locadorA.token, locadorA.locadorId);
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId);
    const veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });
    const veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId, {
      garagemId: null,
    });

    const garagemAlheia = await request(app)
      .post(`/api/garagem/${garagemB.id}/veiculos/${veiculoA.id}`)
      .set(auth(locadorA.token));
    expect(garagemAlheia.status).toBe(403);

    const veiculoAlheio = await request(app)
      .post(`/api/garagem/${garagemA.id}/veiculos/${veiculoB.id}`)
      .set(auth(locadorA.token));
    expect(veiculoAlheio.status).toBe(403);
  });

  it.each(["MANUTENCAO", "INATIVA"])(
    "não permite alocação nova em garagem %s",
    async (status) => {
      const garagem = await createGaragem(locadorA.token, locadorA.locadorId);
      const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
        garagemId: null,
      });

      await request(app)
        .put(`/api/garagem/${garagem.id}`)
        .set(auth(locadorA.token))
        .send({ status });

      const response = await request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token));

      expect(response.status).toBe(409);
    },
  );

  it("não excede capacidade 1 em duas alocações concorrentes", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 1,
    });
    const veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });
    const veiculoB = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });

    const respostas = await Promise.all([
      request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculoA.id}`)
        .set(auth(locadorA.token)),
      request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculoB.id}`)
        .set(auth(locadorA.token)),
    ]);

    expect(respostas.filter((resposta) => resposta.status === 204)).toHaveLength(1);
    expect(respostas.filter((resposta) => resposta.status === 409)).toHaveLength(1);

    const estado = await prisma.garagem.findUnique({
      where: { id: garagem.id },
      select: { capacidade: true, veiculosAlocados: true },
    });
    const alocados = await prisma.veiculo.count({ where: { garagemId: garagem.id } });
    expect(estado?.veiculosAlocados).toBe(1);
    expect(alocados).toBe(1);
    expect(alocados).toBeLessThanOrEqual(estado?.capacidade ?? 0);
  });

  it("edição de garagemId move atomicamente e rejeita destino cheio", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 1,
    });
    const ocupante = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: destino.id,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: origem.id,
      placa: "H040003",
    });

    const response = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ garagemId: destino.id, status: "DISPONIVEL" });

    expect(response.status).toBe(409);
    expect(ocupante.id).toBeTruthy();

    const persisted = await prisma.veiculo.findUnique({
      where: { id: veiculo.id },
      select: { garagemId: true },
    });
    expect(persisted?.garagemId).toBe(origem.id);
  });

  it("não permite reduzir capacidade abaixo dos veículos já alocados", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 2,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagem.id,
    });
    await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagem.id,
    });

    const response = await request(app)
      .put(`/api/garagem/${garagem.id}`)
      .set(auth(locadorA.token))
      .send({ capacidade: 1 });

    expect(response.status).toBe(409);
    const persistida = await prisma.garagem.findUnique({
      where: { id: garagem.id },
      select: { capacidade: true, veiculosAlocados: true },
    });
    expect(persistida).toMatchObject({ capacidade: 2, veiculosAlocados: 2 });
    expect(veiculo.garagemId).toBe(garagem.id);
  });

  it("não oferece nem reserva veículo sem garagem operacional", async () => {
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });

    const catalogo = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.result.map((item: any) => item.id)).not.toContain(veiculo.id);

    const reserva = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(50, 2),
      });
    expect(reserva.status).toBe(409);
    expect(reserva.body.message).toMatch(/garagem|retirada|local/i);
  });

  it("não oferece nem reserva veículo em garagem não operacional", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagem.id,
    });

    await request(app)
      .put(`/api/garagem/${garagem.id}`)
      .set(auth(locadorA.token))
      .send({ status: "MANUTENCAO" });

    const catalogo = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.result.map((item: any) => item.id)).not.toContain(veiculo.id);

    const reserva = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(60, 2),
      });
    expect(reserva.status).toBe(409);
  });
});
