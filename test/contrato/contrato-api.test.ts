import { describe, expect, it, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  LocadorContext,
  LocatarioContext,
} from "../helpers";

// Contrato frontend <-> backend (TASK 01).
// Ver auditoria/CONTRATO-FRONTEND-BACKEND.md.
describe("Contrato da API", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  describe("Formato de erro de validação", () => {
    it("responde {code, message, errors[]} — array, não objeto aninhado", async () => {
      const res = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idVeiculo: "nao-e-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(typeof res.body.message).toBe("string");
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
      // cada issue traz path + message, que é o que o cliente exibe
      expect(res.body.errors[0]).toHaveProperty("path");
      expect(res.body.errors[0]).toHaveProperty("message");
    });
  });

  describe("POST /api/reserva — status é do domínio", () => {
    it("ignora status enviado pelo cliente: nasce AGUARDANDO_PAGAMENTO", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const garagem = await createGaragem(locador.token, locador.locadorId);
      await request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
        .set("Authorization", `Bearer ${locador.token}`);

      const res = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          valorTotal: 250,
          status: "REALIZADA",
          statusPagamento: "SUCESSO",
          ...futurePeriod(),
        });

      expect(res.status).toBe(201);
      expect(res.body.result.status).toBe("AGUARDANDO_PAGAMENTO");
      expect(res.body.result.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    });
  });

  describe("Resposta da reserva", () => {
    it("inclui o veículo aninhado, no mesmo formato de GET /api/veiculo/:id", async () => {
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const garagem = await createGaragem(locador.token, locador.locadorId);
      await request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
        .set("Authorization", `Bearer ${locador.token}`);

      const reserva = await createReserva(
        locatario.token,
        veiculo.id,
        locatario.locatarioId,
      );

      const res = await request(app)
        .get(`/api/reserva/${reserva.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.veiculo).toBeDefined();
      expect(res.body.result.veiculo.id).toBe(veiculo.id);
      expect(res.body.result.veiculo.placa).toBe(veiculo.placa);
      expect(res.body.result.veiculo.modeloVeiculo.marca).toBeDefined();
      expect(res.body.result.veiculo.modeloVeiculo.modelo).toBeDefined();
    });
  });

  describe("GET /api/reserva/locatario/:id — lista vazia", () => {
    it("responde 200 com result vazio e pagination, não 404", async () => {
      const novo = await createLocatario();

      const res = await request(app)
        .get(`/api/reserva/locatario/${novo.locatarioId}`)
        .set("Authorization", `Bearer ${novo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result).toEqual([]);
      expect(res.body.pagination).toMatchObject({ total: 0, totalPages: 0 });
    });
  });

  describe("GET /api/garagem — leitura pelo locatário", () => {
    it("locatário lista garagens ATIVAS", async () => {
      const garagem = await createGaragem(locador.token, locador.locadorId);

      const res = await request(app)
        .get("/api/garagem")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.some((g: any) => g.id === garagem.id)).toBe(true);
      expect(res.body.result.every((g: any) => g.status === "ATIVA")).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    it("locatário lê uma garagem ATIVA por id", async () => {
      const garagem = await createGaragem(locador.token, locador.locadorId);

      const res = await request(app)
        .get(`/api/garagem/${garagem.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.id).toBe(garagem.id);
    });

    it("locatário NÃO enxerga garagem inativa (404)", async () => {
      const garagem = await createGaragem(locador.token, locador.locadorId);
      await prisma.garagem.update({
        where: { id: garagem.id },
        data: { status: "INATIVA" },
      });

      const res = await request(app)
        .get(`/api/garagem/${garagem.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(404);
    });

    it("leitura não vira escrita: locatário continua sem criar garagem (403)", async () => {
      const res = await request(app)
        .post("/api/garagem")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idLocador: locador.locadorId,
          nome: "Garagem proibida",
          endereco: "Rua X, 1",
          capacidade: 5,
        });

      expect(res.status).toBe(403);
    });
  });
});
