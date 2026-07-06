import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createAccount,
  createLocador,
  createLocatario,
  createVeiculo,
  createLocalizacao,
  createReserva,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const VEICULO_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

describe("Localizacao API", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
  });

  describe("POST /api/localizacao", () => {
    it("deve registrar uma localização válida", async () => {
      const response = await request(app)
        .post("/api/localizacao")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ idVeiculo: veiculoId, latitude: -23.55, longitude: -46.63 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.idVeiculo).toBe(veiculoId);
      expect(response.body.result.latitude).toBe(-23.55);
      expect(response.body.result.longitude).toBe(-46.63);
      expect(response.body.result).toHaveProperty("dataHora");
    });

    it("deve recusar registro para veículo inexistente", async () => {
      const response = await request(app)
        .post("/api/localizacao")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({
          idVeiculo: VEICULO_INEXISTENTE,
          latitude: -23.55,
          longitude: -46.63,
        });

      expect(response.status).toBe(404);
    });

    it("deve recusar latitude inválida (> 90)", async () => {
      const response = await request(app)
        .post("/api/localizacao")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ idVeiculo: veiculoId, latitude: 91, longitude: -46.63 });

      expect(response.status).toBe(400);
    });

    it("deve recusar longitude inválida (< -180)", async () => {
      const response = await request(app)
        .post("/api/localizacao")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ idVeiculo: veiculoId, latitude: -23.55, longitude: -181 });

      expect(response.status).toBe(400);
    });

    it("deve recusar registro de LOCATARIO (autorização)", async () => {
      const response = await request(app)
        .post("/api/localizacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idVeiculo: veiculoId, latitude: -23.55, longitude: -46.63 });

      expect(response.status).toBe(403);
    });

    it("deve recusar registro sem autenticação", async () => {
      const response = await request(app)
        .post("/api/localizacao")
        .send({ idVeiculo: veiculoId, latitude: -23.55, longitude: -46.63 });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/localizacao/veiculo/:id_veiculo (histórico)", () => {
    it("deve retornar o histórico ordenado do mais recente para o mais antigo", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);

      // Registros com data/hora controlada (ordem de envio embaralhada).
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 1,
        longitude: 1,
        dataHora: "2026-01-01T10:00:00.000Z",
      });
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 3,
        longitude: 3,
        dataHora: "2026-01-03T10:00:00.000Z",
      });
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 2,
        longitude: 2,
        dataHora: "2026-01-02T10:00:00.000Z",
      });

      const response = await request(app)
        .get(`/api/localizacao/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBe(3);
      // mais recente primeiro
      expect(response.body.result[0].latitude).toBe(3);
      expect(response.body.result[1].latitude).toBe(2);
      expect(response.body.result[2].latitude).toBe(1);
    }, 20_000);

    it("deve retornar lista vazia quando não houver localizações", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);

      const response = await request(app)
        .get(`/api/localizacao/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result).toEqual([]);
    });

    it("deve recusar histórico de veículo inexistente", async () => {
      const response = await request(app)
        .get(`/api/localizacao/veiculo/${VEICULO_INEXISTENTE}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/localizacao/veiculo/:id_veiculo/ultima", () => {
    it("deve retornar o único registro existente", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 10,
        longitude: 20,
        dataHora: "2026-02-01T10:00:00.000Z",
      });

      const response = await request(app)
        .get(`/api/localizacao/veiculo/${veiculo.id}/ultima`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.latitude).toBe(10);
      expect(response.body.result.longitude).toBe(20);
    });

    it("deve retornar a mais recente entre múltiplos registros", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 1,
        longitude: 1,
        dataHora: "2026-03-01T10:00:00.000Z",
      });
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 9,
        longitude: 9,
        dataHora: "2026-03-05T10:00:00.000Z",
      });
      await createLocalizacao(locador.token, veiculo.id, {
        latitude: 5,
        longitude: 5,
        dataHora: "2026-03-03T10:00:00.000Z",
      });

      const response = await request(app)
        .get(`/api/localizacao/veiculo/${veiculo.id}/ultima`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.latitude).toBe(9);
    }, 20_000);

    it("deve retornar 404 quando o veículo não possui localização", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);

      const response = await request(app)
        .get(`/api/localizacao/veiculo/${veiculo.id}/ultima`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(404);
    });

    it("deve recusar última localização de veículo inexistente", async () => {
      const response = await request(app)
        .get(`/api/localizacao/veiculo/${VEICULO_INEXISTENTE}/ultima`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(404);
    });

    it("deve recusar consulta sem autenticação", async () => {
      const response = await request(app).get(
        `/api/localizacao/veiculo/${veiculoId}/ultima`,
      );

      expect(response.status).toBe(401);
    });
  });
});

describe("Localizacao — autorização de acesso (ownership)", () => {
  let dono: LocadorContext;
  let outroLocador: LocadorContext;
  let locatarioComReserva: LocatarioContext;
  let locatarioSemReserva: LocatarioContext;
  let admin: Account;
  let veiculoId: string;

  beforeAll(async () => {
    dono = await createLocador();
    outroLocador = await createLocador();
    locatarioComReserva = await createLocatario();
    locatarioSemReserva = await createLocatario();
    admin = await createAccount("ADMIN");

    const veiculo = await createVeiculo(dono.token, dono.locadorId);
    veiculoId = veiculo.id;

    await createLocalizacao(dono.token, veiculoId, {
      latitude: -23.55,
      longitude: -46.63,
    });

    await createReserva(
      locatarioComReserva.token,
      veiculoId,
      locatarioComReserva.locatarioId,
    );
  });

  it("locador dono vê a localização do próprio veículo", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${dono.token}`);

    expect(response.status).toBe(200);
  });

  it("outro locador NÃO vê a localização (403)", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${outroLocador.token}`);

    expect(response.status).toBe(403);
  });

  it("locatário com reserva no veículo vê a localização", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${locatarioComReserva.token}`);

    expect(response.status).toBe(200);
  });

  it("locatário SEM reserva no veículo NÃO vê a localização (403)", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${locatarioSemReserva.token}`);

    expect(response.status).toBe(403);
  });

  it("ADMIN vê a localização de qualquer veículo", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}/ultima`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
  });

  it("aplica a mesma regra ao histórico (outro locador → 403)", async () => {
    const response = await request(app)
      .get(`/api/localizacao/veiculo/${veiculoId}`)
      .set("Authorization", `Bearer ${outroLocador.token}`);

    expect(response.status).toBe(403);
  });
});
