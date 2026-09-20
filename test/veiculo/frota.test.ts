import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import {
  createAccount,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("gestão de frota do locador — H-05/RF19", () => {
  let locadorA: LocadorContext;
  let locadorB: LocadorContext;
  let locatario: LocatarioContext;
  let admin: Account;

  beforeAll(async () => {
    locadorA = await createLocador();
    locadorB = await createLocador();
    locatario = await createLocatario();
    admin = await createAccount("ADMIN");
  });

  it("exige autenticação e cargo LOCADOR/ADMIN para gestão", async () => {
    expect((await request(app).get("/api/veiculo/meus")).status).toBe(401);
    expect(
      (await request(app)
        .get("/api/veiculo/meus")
        .set(auth(locatario.token))).status,
    ).toBe(403);
  });

  it("lista todos os status próprios e exclui frota de outro locador", async () => {
    const disponivel = await createVeiculo(locadorA.token, locadorA.locadorId, {
      status: "DISPONIVEL",
    });
    const manutencao = await createVeiculo(locadorA.token, locadorA.locadorId, {
      status: "MANUTENCAO",
    });
    const inativo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      status: "INATIVO",
    });
    const deOutro = await createVeiculo(locadorB.token, locadorB.locadorId);

    const response = await request(app)
      .get(
        `/api/veiculo/meus?idLocador=${locadorB.locadorId}&page=1&limit=100`,
      )
      .set(auth(locadorA.token));

    expect(response.status).toBe(200);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 100 });
    expect(response.body.result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: disponivel.id, status: "DISPONIVEL" }),
        expect.objectContaining({ id: manutencao.id, status: "MANUTENCAO" }),
        expect.objectContaining({ id: inativo.id, status: "INATIVO" }),
      ]),
    );
    expect(response.body.result.map((item: { id: string }) => item.id)).not.toContain(
      deOutro.id,
    );
  });

  it("preserva ownership na edição", async () => {
    const veiculo = await createVeiculo(locadorB.token, locadorB.locadorId);
    const response = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ status: "MANUTENCAO" });

    expect(response.status).toBe(403);
  });

  it("fecha ciclo DISPONIVEL ↔ MANUTENCAO e mantém veículo na frota", async () => {
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId);

    const paraManutencao = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ status: "MANUTENCAO" });
    expect(paraManutencao.status).toBe(200);

    const durante = await request(app)
      .get("/api/veiculo/meus")
      .set(auth(locadorA.token));
    expect(durante.body.result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: veiculo.id, status: "MANUTENCAO" }),
      ]),
    );

    const reativado = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ status: "DISPONIVEL" });
    expect(reativado.status).toBe(200);
    expect(reativado.body.result.status).toBe("DISPONIVEL");
  });

  it("fecha ciclo DISPONIVEL ↔ INATIVO e mantém veículo na frota", async () => {
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId);

    const paraInativo = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ status: "INATIVO" });
    expect(paraInativo.status).toBe(200);

    const durante = await request(app)
      .get("/api/veiculo/meus")
      .set(auth(locadorA.token));
    expect(durante.body.result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: veiculo.id, status: "INATIVO" }),
      ]),
    );

    const reativado = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ status: "DISPONIVEL" });
    expect(reativado.status).toBe(200);
  });

  it("exclui MANUTENCAO/INATIVO do catálogo e reintroduz veículo reativado", async () => {
    const manutencao = await createVeiculo(locadorA.token, locadorA.locadorId, {
      status: "MANUTENCAO",
    });
    const inativo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      status: "INATIVO",
    });
    const reativavel = await createVeiculo(locadorA.token, locadorA.locadorId, {
      status: "MANUTENCAO",
    });

    const catalogoBloqueado = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    expect(catalogoBloqueado.status).toBe(200);
    const idsBloqueados = catalogoBloqueado.body.result.map(
      (item: { id: string }) => item.id,
    );
    expect(idsBloqueados).not.toContain(manutencao.id);
    expect(idsBloqueados).not.toContain(inativo.id);
    expect(idsBloqueados).not.toContain(reativavel.id);

    const reativado = await request(app)
      .put(`/api/veiculo/${reativavel.id}`)
      .set(auth(locadorA.token))
      .send({ status: "DISPONIVEL" });
    expect(reativado.status).toBe(200);

    const catalogoDisponivel = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    expect(catalogoDisponivel.body.result.map((item: { id: string }) => item.id)).toContain(
      reativavel.id,
    );
  });

  it("preserva reserva existente após mudança administrativa de status", async () => {
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      { ...futurePeriod(900, 2) },
    );
    expect(reserva.id).toBeTruthy();

    const alterado = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ status: "INATIVO" });
    expect(alterado.status).toBe(200);

    const consulta = await request(app)
      .get(`/api/reserva/${reserva.id}`)
      .set(auth(locatario.token));
    expect(consulta.status).toBe(200);
    expect(consulta.body.result).toMatchObject({
      id: reserva.id,
      idVeiculo: veiculo.id,
    });
  });

  it("mantém comportamento administrativo para ADMIN", async () => {
    const response = await request(app)
      .get("/api/veiculo/meus")
      .set(auth(admin.token));

    expect(response.status).toBe(200);
    expect(response.body.result.length).toBeGreaterThan(0);
  });
});
