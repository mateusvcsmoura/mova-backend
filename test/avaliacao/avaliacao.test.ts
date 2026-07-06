import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  createReserva,
  createAvaliacao,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const RESERVA_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

describe("Avaliacao API", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outroLocatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outroLocatario = await createLocatario();
  });

  // Cada reserva REALIZADA usa um veículo próprio (o período fixo do helper
  // colidiria se reutilizasse o mesmo veículo).
  async function criarReservaRealizada(): Promise<any> {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    return createReserva(locatario.token, veiculo.id, locatario.locatarioId, {
      status: "REALIZADA",
    });
  }

  describe("POST /api/avaliacao", () => {
    it("deve criar avaliação para reserva concluída", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 5, comentario: "Excelente!" });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.idReserva).toBe(reserva.id);
      expect(response.body.result.nota).toBe(5);
      expect(response.body.result.comentario).toBe("Excelente!");
    }, 20_000);

    it("deve aceitar avaliação sem comentário (opcional)", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 4 });

      expect(response.status).toBe(201);
      expect(response.body.result.comentario).toBeNull();
    }, 20_000);

    it("deve preservar nota decimal (Decimal(2,1))", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 4.5 });

      expect(response.status).toBe(201);
      expect(response.body.result.nota).toBe(4.5);
    }, 20_000);

    it("deve recusar avaliação de reserva inexistente", async () => {
      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: RESERVA_INEXISTENTE, nota: 5 });

      expect(response.status).toBe(404);
    });

    it("deve recusar avaliação de reserva não concluída", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      // Reserva sem status -> AGUARDANDO_PAGAMENTO.
      const reserva = await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
      );

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 5 });

      expect(response.status).toBe(409);
    }, 20_000);

    it("deve recusar segunda avaliação para a mesma reserva", async () => {
      const reserva = await criarReservaRealizada();

      const primeira = await createAvaliacao(locatario.token, reserva.id);
      expect(primeira).toHaveProperty("id");

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 3 });

      expect(response.status).toBe(409);
    }, 20_000);

    it("deve recusar nota abaixo do mínimo", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 0 });

      expect(response.status).toBe(400);
    }, 20_000);

    it("deve recusar nota acima do máximo", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idReserva: reserva.id, nota: 6 });

      expect(response.status).toBe(400);
    }, 20_000);

    it("deve recusar avaliação de quem não é dono da reserva", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .set("Authorization", `Bearer ${outroLocatario.token}`)
        .send({ idReserva: reserva.id, nota: 5 });

      expect(response.status).toBe(403);
    }, 20_000);

    it("deve recusar avaliação sem autenticação", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .post("/api/avaliacao")
        .send({ idReserva: reserva.id, nota: 5 });

      expect(response.status).toBe(401);
    }, 20_000);
  });

  describe("GET /api/avaliacao/reserva/:id_reserva", () => {
    it("deve recuperar a avaliação de uma reserva", async () => {
      const reserva = await criarReservaRealizada();
      await createAvaliacao(locatario.token, reserva.id, {
        nota: 5,
        comentario: "Ótimo carro",
      });

      const response = await request(app)
        .get(`/api/avaliacao/reserva/${reserva.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.idReserva).toBe(reserva.id);
      expect(response.body.result.nota).toBe(5);
      expect(response.body.result.comentario).toBe("Ótimo carro");
    }, 20_000);

    it("deve retornar 404 quando a reserva não possui avaliação", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app)
        .get(`/api/avaliacao/reserva/${reserva.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(404);
    }, 20_000);

    it("deve recusar consulta sem autenticação", async () => {
      const reserva = await criarReservaRealizada();

      const response = await request(app).get(
        `/api/avaliacao/reserva/${reserva.id}`,
      );

      expect(response.status).toBe(401);
    }, 20_000);
  });
});
