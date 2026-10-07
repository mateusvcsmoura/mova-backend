import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  LocadorContext,
  LocatarioContext,
  createAdminAccount,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
} from "../helpers";

let locadorA: LocadorContext;
let locadorB: LocadorContext;
let locatario: LocatarioContext;
let admin: Awaited<ReturnType<typeof createAdminAccount>>;
let veiculoA: any;
let veiculoB: any;
let reservaA: any;
let reservaB: any;

beforeAll(async () => {
  locadorA = await createLocador();
  locadorB = await createLocador();
  locatario = await createLocatario();
  admin = await createAdminAccount();

  veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId);
  veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId);

  reservaA = await createReserva(
    locatario.token,
    veiculoA.id,
    locatario.locatarioId,
  );
  reservaB = await createReserva(
    locatario.token,
    veiculoB.id,
    locatario.locatarioId,
    futurePeriod(10, 2),
  );

  for (const reserva of [reservaA, reservaB]) {
    await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "PIX" });
  }
});

describe("FINAL-H-02 — matriz de ownership", () => {
  it("A → veículo A = 200", async () => {
    const res = await request(app)
      .get(`/api/reserva/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.result.length).toBeGreaterThan(0);
  });

  it("A → veículo B = 403", async () => {
    const res = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(reservaB.id);
  });

  it("B → veículo B = 200", async () => {
    const res = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorB.token}`);
    expect(res.status).toBe(200);
  });

  it("B → veículo A = 403", async () => {
    const res = await request(app)
      .get(`/api/reserva/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locadorB.token}`);
    expect(res.status).toBe(403);
  });

  it("ADMIN enxerga ambos (acesso administrativo global)", async () => {
    for (const veiculo of [veiculoA, veiculoB]) {
      const res = await request(app)
        .get(`/api/reserva/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    }
  });

  it("LOCATARIO = 403 e anônimo = 401", async () => {
    const comoLocatario = await request(app)
      .get(`/api/reserva/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(comoLocatario.status).toBe(403);

    const anonimo = await request(app).get(
      `/api/reserva/veiculo/${veiculoA.id}`,
    );
    expect(anonimo.status).toBe(401);
  });

  it("veículo inexistente = 404 e id malformado = 400", async () => {
    const inexistente = await request(app)
      .get(`/api/reserva/veiculo/${randomUUID()}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(inexistente.status).toBe(404);

    const malformado = await request(app)
      .get("/api/reserva/veiculo/nao-e-uuid")
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(malformado.status).toBe(400);
  });
});

describe("FINAL-H-02 — tentativas de bypass", () => {
  it("query params de identidade não trocam o dono efetivo", async () => {
    const tentativas = [
      `?idLocador=${locadorB.locadorId}`,
      `?idLocador=${locadorA.locadorId}`,
      `?idLocatario=${locatario.locatarioId}`,
      `?idVeiculo=${veiculoB.id}`,
    ];

    for (const query of tentativas) {
      const res = await request(app)
        .get(`/api/reserva/veiculo/${veiculoB.id}${query}`)
        .set("Authorization", `Bearer ${locadorA.token}`);
      expect(res.status).toBe(403);
    }
  });

  it("corpo em GET não altera a decisão de ownership", async () => {
    const res = await request(app)
      .get(`/api/reserva/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({ idLocador: locadorB.locadorId, cargo: "ADMIN" } as any);
    expect(res.status).toBe(403);
  });

  it("listagem geral não vaza reservas da frota alheia", async () => {
    const res = await request(app)
      .get(`/api/reserva?idVeiculo=${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual([]);
  });

  it("GET /api/reserva/:id de reserva alheia = 403", async () => {
    const res = await request(app)
      .get(`/api/reserva/${reservaB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(res.status).toBe(403);
  });
});

describe("FINAL-H-02 — exposição do codigoDesbloqueio", () => {
  it("o código existe de fato no banco (o teste não é falso negativo)", async () => {
    const reserva = await prisma.reserva.findUniqueOrThrow({
      where: { id: reservaA.id },
    });
    expect(reserva.codigoDesbloqueio).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("nenhuma rota de gestão do LOCADOR devolve a propriedade", async () => {
    const respostas: { rota: string; corpo: any }[] = [];

    const porVeiculo = await request(app)
      .get(`/api/reserva/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    respostas.push({ rota: "GET /reserva/veiculo/:id", corpo: porVeiculo.body });

    const listagem = await request(app)
      .get("/api/reserva")
      .set("Authorization", `Bearer ${locadorA.token}`);
    respostas.push({ rota: "GET /reserva", corpo: listagem.body });

    const detalhe = await request(app)
      .get(`/api/reserva/${reservaA.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    respostas.push({ rota: "GET /reserva/:id", corpo: detalhe.body });

    const put = await request(app)
      .put(`/api/reserva/${reservaA.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({ metodoPagamento: "PIX" });
    respostas.push({ rota: "PUT /reserva/:id", corpo: put.body });

    const codigoReal = (
      await prisma.reserva.findUniqueOrThrow({ where: { id: reservaA.id } })
    ).codigoDesbloqueio!;

    for (const { rota, corpo } of respostas) {
      const serializado = JSON.stringify(corpo);
      expect(serializado, rota).not.toContain("codigoDesbloqueio");
      expect(serializado, rota).not.toContain(codigoReal);
    }

    // Ausência, não `null`: o contrato é omitir a credencial.
    const item = porVeiculo.body.result[0];
    expect(Object.prototype.hasOwnProperty.call(item, "codigoDesbloqueio")).toBe(
      false,
    );
  });

  it("cancelamento pelo LOCADOR também não devolve a credencial", async () => {
    const locadorLocal = await createLocador();
    const locatarioLocal = await createLocatario();
    const veiculo = await createVeiculo(
      locadorLocal.token,
      locadorLocal.locadorId,
    );
    const reserva = await createReserva(
      locatarioLocal.token,
      veiculo.id,
      locatarioLocal.locatarioId,
    );
    await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set("Authorization", `Bearer ${locatarioLocal.token}`)
      .send({ metodoPagamento: "PIX" });

    const cancelar = await request(app)
      .post(`/api/reserva/${reserva.id}/cancelar`)
      .set("Authorization", `Bearer ${locadorLocal.token}`);
    expect(cancelar.status).toBe(200);
    expect(JSON.stringify(cancelar.body)).not.toContain("codigoDesbloqueio");
  });

  it("ADMIN mantém acesso administrativo ao código (contrato atual)", async () => {
    const res = await request(app)
      .get(`/api/reserva/${reservaA.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.result.codigoDesbloqueio).toMatch(
      /^[A-Z0-9]{4}-[A-Z0-9]{4}$/,
    );
  });

  it("RF15/RN03: o LOCATARIO dono continua recebendo código e QR", async () => {
    const detalhe = await request(app)
      .get(`/api/reserva/${reservaA.id}`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.result.codigoDesbloqueio).toMatch(
      /^[A-Z0-9]{4}-[A-Z0-9]{4}$/,
    );

    const qr = await request(app)
      .get(`/api/reserva/${reservaA.id}/desbloqueio/qr`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(qr.status).toBe(200);
    expect(qr.body.result.qr).toBeTruthy();
  });
});
