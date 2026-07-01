import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  createGaragem,
  createFavorito,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const VEICULO_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

describe("Favorito API", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outroLocatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outroLocatario = await createLocatario();
  });

  describe("POST /api/favorito", () => {
    it("deve favoritar um veículo com sucesso", async () => {
      const veiculo = await createVeiculo(locador.locadorId);

      const response = await request(app)
        .post("/api/favorito")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idVeiculo: veiculo.id });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.idVeiculo).toBe(veiculo.id);
      expect(response.body.result.idLocatario).toBe(locatario.locatarioId);
      expect(response.body.result).toHaveProperty("criadoEm");
    }, 20_000);

    it("deve recusar veículo inexistente", async () => {
      const response = await request(app)
        .post("/api/favorito")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idVeiculo: VEICULO_INEXISTENTE });

      expect(response.status).toBe(404);
    });

    it("deve recusar veículo já favoritado pelo mesmo locatário", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      await createFavorito(locatario.token, veiculo.id);

      const response = await request(app)
        .post("/api/favorito")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idVeiculo: veiculo.id });

      expect(response.status).toBe(409);
    }, 20_000);

    it("deve permitir que locatários diferentes favoritem o mesmo veículo", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      await createFavorito(locatario.token, veiculo.id);

      const response = await request(app)
        .post("/api/favorito")
        .set("Authorization", `Bearer ${outroLocatario.token}`)
        .send({ idVeiculo: veiculo.id });

      expect(response.status).toBe(201);
    }, 20_000);

    it("deve recusar id de veículo inválido (não uuid)", async () => {
      const response = await request(app)
        .post("/api/favorito")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ idVeiculo: "nao-e-uuid" });

      expect(response.status).toBe(400);
    });

    it("deve recusar requisição sem autenticação", async () => {
      const veiculo = await createVeiculo(locador.locadorId);

      const response = await request(app)
        .post("/api/favorito")
        .send({ idVeiculo: veiculo.id });

      expect(response.status).toBe(401);
    }, 20_000);

    it("deve recusar requisição de LOCADOR (rota exclusiva de locatário)", async () => {
      const veiculo = await createVeiculo(locador.locadorId);

      const response = await request(app)
        .post("/api/favorito")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ idVeiculo: veiculo.id });

      expect(response.status).toBe(403);
    }, 20_000);
  });

  describe("DELETE /api/favorito/veiculo/:id_veiculo", () => {
    it("deve remover um favorito com sucesso", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      await createFavorito(locatario.token, veiculo.id);

      const response = await request(app)
        .delete(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(204);

      // Confirma remoção: verificação retorna favoritado = false.
      const check = await request(app)
        .get(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);
      expect(check.body.result.favoritado).toBe(false);
    }, 20_000);

    it("deve retornar 404 ao remover favorito inexistente", async () => {
      const veiculo = await createVeiculo(locador.locadorId);

      const response = await request(app)
        .delete(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(404);
    }, 20_000);

    it("não deve remover o favorito de outro locatário (isolamento)", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      await createFavorito(locatario.token, veiculo.id);

      // outroLocatario não favoritou este veículo — 404, e o favorito
      // do dono permanece intacto.
      const response = await request(app)
        .delete(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${outroLocatario.token}`);

      expect(response.status).toBe(404);

      const check = await request(app)
        .get(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);
      expect(check.body.result.favoritado).toBe(true);
    }, 20_000);

    it("deve recusar requisição sem autenticação", async () => {
      const veiculo = await createVeiculo(locador.locadorId);

      const response = await request(app).delete(
        `/api/favorito/veiculo/${veiculo.id}`,
      );

      expect(response.status).toBe(401);
    }, 20_000);
  });

  describe("GET /api/favorito", () => {
    it("deve listar apenas os favoritos do locatário autenticado", async () => {
      const dono = await createLocatario();
      const intruso = await createLocatario();

      const veiculoA = await createVeiculo(locador.locadorId);
      const veiculoB = await createVeiculo(locador.locadorId);
      const veiculoC = await createVeiculo(locador.locadorId);

      await createFavorito(dono.token, veiculoA.id);
      await createFavorito(dono.token, veiculoB.id);
      await createFavorito(intruso.token, veiculoC.id);

      const response = await request(app)
        .get("/api/favorito")
        .set("Authorization", `Bearer ${dono.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result).toHaveLength(2);
      const ids = response.body.result.map((f: any) => f.idVeiculo);
      expect(ids).toContain(veiculoA.id);
      expect(ids).toContain(veiculoB.id);
      expect(ids).not.toContain(veiculoC.id);
      expect(
        response.body.result.every(
          (f: any) => f.idLocatario === dono.locatarioId,
        ),
      ).toBe(true);
    }, 30_000);

    it("deve retornar os dados completos do veículo (modelo, locador, garagem, status)", async () => {
      const consultor = await createLocatario();
      const garagem = await createGaragem(locador.token, locador.locadorId);
      const veiculo = await createVeiculo(locador.locadorId);
      // createVeiculoSchema não expõe garagemId — vincula direto via Prisma.
      await prisma.veiculo.update({
        where: { id: veiculo.id },
        data: { garagemId: garagem.id },
      });

      await createFavorito(consultor.token, veiculo.id);

      const response = await request(app)
        .get("/api/favorito")
        .set("Authorization", `Bearer ${consultor.token}`);

      expect(response.status).toBe(200);
      const [favorito] = response.body.result;

      expect(favorito.veiculo.id).toBe(veiculo.id);
      expect(favorito.veiculo.placa).toBe(veiculo.placa);
      expect(favorito.veiculo.status).toBe("DISPONIVEL");

      expect(favorito.veiculo.modeloVeiculo.marca).toBe("Fiat");
      expect(favorito.veiculo.modeloVeiculo.modelo).toBe("Argo");

      expect(favorito.veiculo.locador.id).toBe(locador.locadorId);
      expect(favorito.veiculo.locador.empresa).toBe(locador.empresa);

      expect(favorito.veiculo.garagem.id).toBe(garagem.id);
      expect(favorito.veiculo.garagem.nome).toBe(garagem.nome);
    }, 30_000);

    it("deve paginar a listagem de favoritos", async () => {
      const paginador = await createLocatario();

      for (let i = 0; i < 3; i++) {
        const veiculo = await createVeiculo(locador.locadorId);
        await createFavorito(paginador.token, veiculo.id);
      }

      const response = await request(app)
        .get("/api/favorito?page=1&limit=2")
        .set("Authorization", `Bearer ${paginador.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });

      const page2 = await request(app)
        .get("/api/favorito?page=2&limit=2")
        .set("Authorization", `Bearer ${paginador.token}`);

      expect(page2.status).toBe(200);
      expect(page2.body.result).toHaveLength(1);
    }, 30_000);

    it("deve retornar lista vazia para locatário sem favoritos", async () => {
      const semFavoritos = await createLocatario();

      const response = await request(app)
        .get("/api/favorito")
        .set("Authorization", `Bearer ${semFavoritos.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    }, 20_000);

    it("deve recusar requisição sem autenticação", async () => {
      const response = await request(app).get("/api/favorito");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/favorito/veiculo/:id_veiculo", () => {
    it("deve informar quando o veículo está favoritado", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      await createFavorito(locatario.token, veiculo.id);

      const response = await request(app)
        .get(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.favoritado).toBe(true);
      expect(response.body.result.favorito.idVeiculo).toBe(veiculo.id);
    }, 20_000);

    it("deve informar quando o veículo não está favoritado", async () => {
      const veiculo = await createVeiculo(locador.locadorId);

      const response = await request(app)
        .get(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.favoritado).toBe(false);
      expect(response.body.result.favorito).toBeNull();
    }, 20_000);

    it("deve considerar apenas os favoritos do próprio usuário (isolamento)", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      await createFavorito(locatario.token, veiculo.id);

      const response = await request(app)
        .get(`/api/favorito/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${outroLocatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.favoritado).toBe(false);
    }, 20_000);

    it("deve retornar 404 para veículo inexistente", async () => {
      const response = await request(app)
        .get(`/api/favorito/veiculo/${VEICULO_INEXISTENTE}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe("Consistência na exclusão do veículo", () => {
    it("deve remover os favoritos quando o veículo é excluído (cascade)", async () => {
      const veiculo = await createVeiculo(locador.locadorId);
      const favorito = await createFavorito(locatario.token, veiculo.id);
      expect(favorito).toHaveProperty("id");

      const del = await request(app).delete(`/api/veiculo/${veiculo.id}`);
      expect(del.status).toBe(204);

      const restante = await prisma.favorito.findUnique({
        where: { id: favorito.id },
      });
      expect(restante).toBeNull();

      const lista = await request(app)
        .get("/api/favorito")
        .set("Authorization", `Bearer ${locatario.token}`);
      const ids = lista.body.result.map((f: any) => f.idVeiculo);
      expect(ids).not.toContain(veiculo.id);
    }, 30_000);
  });
});
