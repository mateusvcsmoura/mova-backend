import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import {
  confirmarPagamentoWebhook,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  createAdminAccount,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

describe("FINAL-H-02 — ownership de reservas por veículo", () => {
  let locadorA: LocadorContext;
  let locadorB: LocadorContext;
  let admin: Account;
  let locatario: LocatarioContext;
  let veiculoA: any;
  let veiculoAUnpaid: any;
  let veiculoB: any;
  let reservaAId: string;

  beforeAll(async () => {
    locadorA = await createLocador();
    locadorB = await createLocador();
    admin = await createAdminAccount();
    locatario = await createLocatario();
    veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId);
    veiculoAUnpaid = await createVeiculo(locadorA.token, locadorA.locadorId);
    veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId);

    const reservaA = await createReserva(
      locatario.token,
      veiculoA.id,
      locatario.locatarioId,
    );
    const reservaB = await createReserva(
      locatario.token,
      veiculoB.id,
      locatario.locatarioId,
    );
    await createReserva(
      locatario.token,
      veiculoAUnpaid.id,
      locatario.locatarioId,
    );
    for (const reserva of [reservaA, reservaB]) {
      const webhook = await confirmarPagamentoWebhook(reserva.id);
      expect(webhook.status).toBe(200);
    }
    reservaAId = reservaA.id;
  });

  it("rejeita LOCADOR que consulta reservas do veículo de outro LOCADOR", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(403);
  });

  it("permite ao LOCADOR consultar somente seu próprio veículo", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0].idVeiculo).toBe(veiculoA.id);
    expect(response.body.result[0]).not.toHaveProperty("codigoDesbloqueio");
  });

  it("permite ao dono B consultar seu próprio veículo, sem código de desbloqueio", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorB.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0].idVeiculo).toBe(veiculoB.id);
    expect(response.body.result[0]).not.toHaveProperty("codigoDesbloqueio");
  });

  it("não expõe campo de código para reserva ainda não paga", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoAUnpaid.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0]).not.toHaveProperty("codigoDesbloqueio");
  });

  it("permite ADMIN consultar veículo A", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0].idVeiculo).toBe(veiculoA.id);
    expect(response.body.result[0]).not.toHaveProperty("codigoDesbloqueio");
  });

  it("permite ADMIN consultar veículo B", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toHaveLength(1);
    expect(response.body.result[0].idVeiculo).toBe(veiculoB.id);
    expect(response.body.result[0]).not.toHaveProperty("codigoDesbloqueio");
  });

  it("preserva RBAC: LOCATARIO recebe 403 e anônimo recebe 401", async () => {
    const locatarioResponse = await request(app).get(
      `/api/reserva/veiculo/${veiculoA.id}`,
    ).set("Authorization", `Bearer ${locatario.token}`);
    const anonimoResponse = await request(app).get(
      `/api/reserva/veiculo/${veiculoA.id}`,
    );

    expect(locatarioResponse.status).toBe(403);
    expect(anonimoResponse.status).toBe(401);
  });

  it("retorna 404 para veículo inexistente", async () => {
    const response = await request(app)
      .get("/api/reserva/veiculo/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(404);
  });

  it("ignora tentativa de escolher o proprietário por query string", async () => {
    const response = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}?idLocador=${locadorA.locadorId}`)
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(403);
  });

  it("não expõe código na listagem geral de reservas do LOCADOR", async () => {
    const response = await request(app)
      .get("/api/reserva")
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: reservaAId, idVeiculo: veiculoA.id }),
      ]),
    );
    expect(response.body.result.every((item: any) =>
      !Object.prototype.hasOwnProperty.call(item, "codigoDesbloqueio"),
    )).toBe(true);
  });

  it("não expõe código no detalhe de reserva visto pelo LOCADOR", async () => {
    const response = await request(app)
      .get(`/api/reserva/${reservaAId}`)
      .set("Authorization", `Bearer ${locadorA.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.id).toBe(reservaAId);
    expect(response.body.result).not.toHaveProperty("codigoDesbloqueio");
  });
});
