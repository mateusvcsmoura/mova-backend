import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createLocatario,
  createServico,
  type LocatarioContext,
} from "../helpers";

describe("Servico Opcional API", () => {
  let locatario: LocatarioContext;
  let seguro: Awaited<ReturnType<typeof createServico>>;
  let tanque: Awaited<ReturnType<typeof createServico>>;
  let inativo: Awaited<ReturnType<typeof createServico>>;

  beforeAll(async () => {
    locatario = await createLocatario();
    seguro = await createServico({
      nome: "Seguro adicional",
      descricao: "Cobertura adicional",
      valor: 49.9,
    });
    tanque = await createServico({
      nome: "Tanque cheio",
      descricao: "Devolucao com tanque cheio",
      valor: 250,
    });
    inativo = await createServico({
      nome: "Servico inativo",
      valor: 10,
      ativo: false,
    });
  });

  describe("GET /api/servico", () => {
    it("deve listar os serviços disponíveis (ativos)", async () => {
      const response = await request(app)
        .get("/api/servico")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);

      const nomes = response.body.result.map((s: any) => s.nome);
      expect(nomes).toContain(seguro.nome);
      expect(nomes).toContain(tanque.nome);
    });

    it("não deve listar serviços inativos por padrão", async () => {
      const response = await request(app)
        .get("/api/servico")
        .set("Authorization", `Bearer ${locatario.token}`);

      const ids = response.body.result.map((s: any) => s.id);
      expect(ids).not.toContain(inativo.id);
    });

    it("deve retornar valor como número", async () => {
      const response = await request(app)
        .get("/api/servico")
        .set("Authorization", `Bearer ${locatario.token}`);

      const encontrado = response.body.result.find(
        (s: any) => s.id === seguro.id,
      );
      expect(encontrado).toBeDefined();
      expect(typeof encontrado.valor).toBe("number");
      expect(encontrado.valor).toBe(49.9);
    });

    it("deve recusar listagem sem autenticação", async () => {
      const response = await request(app).get("/api/servico");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/servico/:id", () => {
    it("deve retornar um serviço por id", async () => {
      const response = await request(app)
        .get(`/api/servico/${tanque.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(tanque.id);
      expect(response.body.result.nome).toBe(tanque.nome);
    });

    it("deve retornar 404 para serviço inexistente", async () => {
      const response = await request(app)
        .get("/api/servico/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(404);
    });
  });
});
