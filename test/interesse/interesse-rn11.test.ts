import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

describe("RN11 — descoberta, interesse e aviso de disponibilidade", () => {
  let locador: LocadorContext;
  let ana: LocatarioContext;
  let beto: LocatarioContext;
  let manutencao: any;
  let reservado: any;
  let inativo: any;

  beforeAll(async () => {
    locador = await createLocador();
    ana = await createLocatario();
    beto = await createLocatario();
    manutencao = await createVeiculo(locador.token, locador.locadorId, {
      status: "MANUTENCAO",
      modelo: "Argo Interesse",
    });
    reservado = await createVeiculo(locador.token, locador.locadorId, {
      status: "RESERVADO",
      modelo: "Onix Reservado",
    });
    inativo = await createVeiculo(locador.token, locador.locadorId, {
      status: "INATIVO",
      modelo: "Civic Inativo",
    });
  });

  it("exige JWT na descoberta de veículos indisponíveis", async () => {
    const response = await request(app).get("/api/interesse/veiculos");
    expect(response.status).toBe(401);
  });

  it("não permite que LOCADOR consulte descoberta ou notificações de locatário", async () => {
    const descoberta = await request(app)
      .get("/api/interesse/veiculos")
      .set("Authorization", `Bearer ${locador.token}`);
    const notificacoes = await request(app)
      .get("/api/interesse/notificacoes")
      .set("Authorization", `Bearer ${locador.token}`);
    expect(descoberta.status).toBe(403);
    expect(notificacoes.status).toBe(403);
  });

  it("descobre MANUTENCAO/RESERVADO sem expor dados privados e exclui INATIVO", async () => {
    const response = await request(app)
      .get("/api/interesse/veiculos")
      .set("Authorization", `Bearer ${ana.token}`);

    expect(response.status).toBe(200);
    const ids = response.body.result.map((item: any) => item.id);
    expect(ids).toEqual(expect.arrayContaining([manutencao.id, reservado.id]));
    expect(ids).not.toContain(inativo.id);
    expect(response.body.result.every((item: any) =>
      ["MANUTENCAO", "RESERVADO"].includes(item.status),
    )).toBe(true);
    expect(response.body.result[0]).not.toHaveProperty("idLocador");
    expect(response.body.result[0]).not.toHaveProperty("placa");
  });

  it("mantém a descoberta separada do catálogo reservável", async () => {
    const response = await request(app)
      .get("/api/veiculo")
      .set("Authorization", `Bearer ${ana.token}`);

    expect(response.status).toBe(200);
    const ids = response.body.result.map((item: any) => item.id);
    expect(ids).not.toContain(manutencao.id);
    expect(ids).not.toContain(reservado.id);
    expect(ids).not.toContain(inativo.id);
  });

  it("não permite registrar interesse direto em veículo INATIVO", async () => {
    const response = await request(app)
      .post("/api/interesse")
      .set("Authorization", `Bearer ${ana.token}`)
      .send({ idVeiculo: inativo.id });
    expect(response.status).toBe(409);
  });

  it("registra, lista e cancela interesse usando a identidade do JWT", async () => {
    const created = await request(app)
      .post("/api/interesse")
      .set("Authorization", `Bearer ${ana.token}`)
      .send({ idVeiculo: manutencao.id });

    expect(created.status).toBe(201);
    expect(created.body.result.idLocatario).toBe(ana.locatarioId);

    const own = await request(app)
      .get("/api/interesse")
      .set("Authorization", `Bearer ${ana.token}`);
    expect(own.status).toBe(200);
    expect(own.body.result.map((item: any) => item.idVeiculo)).toContain(manutencao.id);

    const other = await request(app)
      .get("/api/interesse")
      .set("Authorization", `Bearer ${beto.token}`);
    expect(other.status).toBe(200);
    expect(other.body.result.map((item: any) => item.idVeiculo)).not.toContain(manutencao.id);

    const canceled = await request(app)
      .delete(`/api/interesse/veiculo/${manutencao.id}`)
      .set("Authorization", `Bearer ${beto.token}`);
    expect(canceled.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/interesse/veiculo/${manutencao.id}`)
      .set("Authorization", `Bearer ${ana.token}`);
    expect(removed.status).toBe(204);
  });

  it("não duplica interesse em concorrência", async () => {
    const responses = await Promise.all([
      request(app)
        .post("/api/interesse")
        .set("Authorization", `Bearer ${ana.token}`)
        .send({ idVeiculo: reservado.id }),
      request(app)
        .post("/api/interesse")
        .set("Authorization", `Bearer ${ana.token}`)
        .send({ idVeiculo: reservado.id }),
    ]);

    expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
    const rows = await prisma.interesseVeiculo.findMany({
      where: { idLocatario: ana.locatarioId, idVeiculo: reservado.id },
    });
    expect(rows).toHaveLength(1);
  });

  it("gera uma notificação interna quando MANUTENCAO vira DISPONIVEL", async () => {
    const active = await request(app)
      .post("/api/interesse")
      .set("Authorization", `Bearer ${beto.token}`)
      .send({ idVeiculo: manutencao.id });
    expect(active.status).toBe(201);

    const updated = await request(app)
      .put(`/api/veiculo/${manutencao.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ status: "DISPONIVEL" });
    expect(updated.status).toBe(200);

    const notifications = await request(app)
      .get("/api/interesse/notificacoes")
      .set("Authorization", `Bearer ${beto.token}`);
    expect(notifications.status).toBe(200);
    expect(notifications.body.result).toHaveLength(1);
    expect(notifications.body.result[0].status).toBe("ENVIADA");
    expect(notifications.body.result[0].canal).toBe("INTERNA");

    const again = await request(app)
      .put(`/api/veiculo/${manutencao.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ status: "MANUTENCAO" });
    expect(again.status).toBe(200);
    await request(app)
      .put(`/api/veiculo/${manutencao.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ status: "DISPONIVEL" });

    const afterCycle = await request(app)
      .get("/api/interesse/notificacoes")
      .set("Authorization", `Bearer ${beto.token}`);
    // A inscrição é consumida após o primeiro aviso; novo ciclo exige novo
    // opt-in, evitando spam em transições repetidas.
    expect(afterCycle.body.result).toHaveLength(1);
  });

  it("interesse cancelado não recebe aviso futuro", async () => {
    const target = await createVeiculo(locador.token, locador.locadorId, {
      status: "MANUTENCAO",
      modelo: "HB20 Cancelado",
    });
    const registered = await request(app)
      .post("/api/interesse")
      .set("Authorization", `Bearer ${ana.token}`)
      .send({ idVeiculo: target.id });
    expect(registered.status).toBe(201);
    await request(app)
      .delete(`/api/interesse/veiculo/${target.id}`)
      .set("Authorization", `Bearer ${ana.token}`);

    await request(app)
      .put(`/api/veiculo/${target.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ status: "DISPONIVEL" });

    const notifications = await request(app)
      .get("/api/interesse/notificacoes")
      .set("Authorization", `Bearer ${ana.token}`);
    expect(notifications.body.result).toEqual([]);
  });
});
