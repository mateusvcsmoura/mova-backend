import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createAccount,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type Account,
  type LocadorContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("FINAL-H-03 — contrato de edição de veículo", () => {
  let locador: LocadorContext;
  let outroLocador: LocadorContext;
  let admin: Account;

  beforeAll(async () => {
    locador = await createLocador();
    outroLocador = await createLocador();
    admin = await createAccount("ADMIN");
  });

  it("atualiza Veiculo e ModeloVeiculo atomicamente pelo contrato explícito", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      valorDiaria: 100,
    });

    const response = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locador.token))
      .send({
        placa: "XYZ9A88",
        status: "MANUTENCAO",
        modelo: {
          marca: "Toyota",
          modelo: "Corolla",
          ano: 2024,
          cambio: "Automatico",
          capacidade: 7,
          valorDiaria: 321.45,
          eletrico: true,
          adaptado: true,
          categoria: "EXECUTIVO",
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.result).toMatchObject({
      placa: "XYZ9A88",
      status: "MANUTENCAO",
      modeloVeiculo: {
        marca: "Toyota",
        modelo: "Corolla",
        ano: 2024,
        cambio: "Automatico",
        capacidade: 7,
        valorDiaria: 321.45,
        eletrico: true,
        adaptado: true,
        categoria: "EXECUTIVO",
      },
    });

    const refetch = await request(app).get(`/api/veiculo/${veiculo.id}`);
    const persistido = await prisma.veiculo.findUnique({
      where: { id: veiculo.id },
      include: { modeloVeiculo: true },
    });

    expect(refetch.status).toBe(200);
    expect(refetch.body.result).toMatchObject({
      placa: "XYZ9A88",
      modeloVeiculo: { marca: "Toyota", valorDiaria: 321.45 },
    });
    expect(persistido).toMatchObject({
      placa: "XYZ9A88",
      status: "MANUTENCAO",
      modeloVeiculo: { marca: "Toyota" },
    });
    expect(Number(persistido?.modeloVeiculo.valorDiaria)).toBe(321.45);
  });

  it("rejeita campos de ModeloVeiculo no nível raiz, sem falso 200", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const response = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locador.token))
      .send({ marca: "Ignorada", valorDiaria: 1, capacidade: 9 });

    expect(response.status).toBe(400);
    const persistido = await prisma.veiculo.findUnique({
      where: { id: veiculo.id },
      include: { modeloVeiculo: true },
    });
    expect(persistido?.modeloVeiculo).toMatchObject({
      marca: "Fiat",
      capacidade: 5,
    });
    expect(Number(persistido?.modeloVeiculo.valorDiaria)).toBe(100);
  });

  it("rejeita campos desconhecidos no endpoint de modelo", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const response = await request(app)
      .patch(`/api/veiculo/modelos/${veiculo.idModeloVeiculo}`)
      .set(auth(locador.token))
      .send({ marca: "Não suportada" });

    expect(response.status).toBe(400);
  });

  it("preserva ownership no veículo e no modelo", async () => {
    const veiculo = await createVeiculo(
      outroLocador.token,
      outroLocador.locadorId,
    );

    const updateVeiculo = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locador.token))
      .send({ status: "MANUTENCAO" });
    const updateModelo = await request(app)
      .patch(`/api/veiculo/modelos/${veiculo.idModeloVeiculo}`)
      .set(auth(locador.token))
      .send({ capacidade: 9 });

    expect(updateVeiculo.status).toBe(403);
    expect(updateModelo.status).toBe(403);
  });

  it("mantém semântica explícita de ModeloVeiculo compartilhado", async () => {
    const primeiro = await createVeiculo(locador.token, locador.locadorId);
    const segundo = await createVeiculo(locador.token, locador.locadorId, {
      placa: "XYZ9B88",
    });

    expect(primeiro.idModeloVeiculo).toBe(segundo.idModeloVeiculo);

    const response = await request(app)
      .put(`/api/veiculo/${primeiro.id}`)
      .set(auth(locador.token))
      .send({ modelo: { valorDiaria: 222.22 } });

    expect(response.status).toBe(200);
    const outro = await prisma.veiculo.findUnique({
      where: { id: segundo.id },
      include: { modeloVeiculo: true },
    });
    expect(Number(outro?.modeloVeiculo.valorDiaria)).toBe(222.22);
  });

  it("cria modelo próprio quando a identidade do modelo muda", async () => {
    const primeiro = await createVeiculo(locador.token, locador.locadorId);
    const segundo = await createVeiculo(locador.token, locador.locadorId, {
      placa: "XYZ9C88",
    });

    const response = await request(app)
      .put(`/api/veiculo/${primeiro.id}`)
      .set(auth(locador.token))
      .send({ modelo: { marca: "Honda", modelo: "Civic", ano: 2023 } });

    expect(response.status).toBe(200);
    const [um, dois] = await Promise.all([
      prisma.veiculo.findUnique({ where: { id: primeiro.id }, include: { modeloVeiculo: true } }),
      prisma.veiculo.findUnique({ where: { id: segundo.id }, include: { modeloVeiculo: true } }),
    ]);
    expect(um?.modeloVeiculo).toMatchObject({ marca: "Honda", modelo: "Civic", ano: 2023 });
    expect(dois?.modeloVeiculo).toMatchObject({ marca: "Fiat", modelo: "Argo", ano: 2022 });
    expect(um?.idModeloVeiculo).not.toBe(dois?.idModeloVeiculo);
  });

  it("não deixa edição física e de catálogo parcialmente aplicada", async () => {
    const primeiro = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Ford",
      modelo: "Ka",
      ano: 2020,
      valorDiaria: 100,
    });
    const segundo = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Honda",
      modelo: "Civic",
      ano: 2023,
      placa: "XYZ9D88",
      valorDiaria: 150,
    });

    const response = await request(app)
      .put(`/api/veiculo/${primeiro.id}`)
      .set(auth(locador.token))
      .send({
        placa: segundo.placa,
        modelo: { valorDiaria: 999 },
      });

    expect(response.status).toBe(409);
    const persistido = await prisma.veiculo.findUnique({
      where: { id: primeiro.id },
      include: { modeloVeiculo: true },
    });
    expect(persistido?.placa).toBe(primeiro.placa);
    expect(Number(persistido?.modeloVeiculo.valorDiaria)).toBe(100);
  });

  it("faz nova cotação com a diária nova e preserva reserva já criada", async () => {
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Ford",
      modelo: "Ka",
      ano: 2020,
      valorDiaria: 100,
    });
    const antiga = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(1, 1),
    );

    const update = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locador.token))
      .send({ modelo: { valorDiaria: 200 } });
    expect(update.status).toBe(200);

    const nova = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(5, 1),
    );
    const antigaPersistida = await prisma.reserva.findUnique({ where: { id: antiga.id } });

    expect(antigaPersistida?.valorTotal.toString()).toBe("100");
    expect(nova.valorTotal).toBe(200);
  });

  it("mantém acesso administrativo ao contrato coordenado", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const response = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(admin.token))
      .send({ modelo: { categoria: "ECONOMICO" } });

    expect(response.status).toBe(200);
    expect(response.body.result.modeloVeiculo.categoria).toBe("ECONOMICO");
  });
});
