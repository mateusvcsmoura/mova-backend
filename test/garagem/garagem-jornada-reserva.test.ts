import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createVeiculo,
  futurePeriod,
  LocadorContext,
  LocatarioContext,
} from "../helpers";

async function alocarVeiculo(token: string, garagemId: string, veiculoId: string) {
  return request(app)
    .post(`/api/garagem/${garagemId}/veiculos/${veiculoId}`)
    .set("Authorization", `Bearer ${token}`);
}

// TASK 02 — garagens reais na jornada de reserva.
// Cobre o que o frontend precisa para escolher retirada/devolução:
// listagem filtrada pelo locador dono do veículo e as pré-condições de criação.
// Ver auditoria/GARAGENS.md.
describe("Garagens na jornada de reserva", () => {
  let locador: LocadorContext;
  let outroLocador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    outroLocador = await createLocador();
    locatario = await createLocatario();
  });

  describe("GET /api/garagem?idLocador — catálogo da devolução", () => {
    it("locatário recebe apenas as garagens do locador informado", async () => {
      const doLocador = await createGaragem(locador.token, locador.locadorId);
      const doOutro = await createGaragem(
        outroLocador.token,
        outroLocador.locadorId,
      );

      const res = await request(app)
        .get(`/api/garagem?idLocador=${locador.locadorId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.result.map((g: any) => g.id);
      expect(ids).toContain(doLocador.id);
      expect(ids).not.toContain(doOutro.id);
      expect(
        res.body.result.every((g: any) => g.idLocador === locador.locadorId),
      ).toBe(true);
    });

    it("garagem INATIVA não aparece, mesmo filtrando pelo locador dono", async () => {
      const ativa = await createGaragem(locador.token, locador.locadorId);
      const inativa = await createGaragem(locador.token, locador.locadorId);
      await prisma.garagem.update({
        where: { id: inativa.id },
        data: { status: "INATIVA" },
      });

      const res = await request(app)
        .get(`/api/garagem?idLocador=${locador.locadorId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.result.map((g: any) => g.id);
      expect(ids).toContain(ativa.id);
      expect(ids).not.toContain(inativa.id);
    });

    it("o filtro de status não pode ser burlado pela query", async () => {
      const inativa = await createGaragem(locador.token, locador.locadorId);
      await prisma.garagem.update({
        where: { id: inativa.id },
        data: { status: "INATIVA" },
      });

      const res = await request(app)
        .get("/api/garagem?status=INATIVA")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.every((g: any) => g.status === "ATIVA")).toBe(true);
      expect(res.body.result.map((g: any) => g.id)).not.toContain(inativa.id);
    });

    it("volta ao catálogo somente após o locador reativar a garagem", async () => {
      const garagem = await createGaragem(locador.token, locador.locadorId);

      const desativar = await request(app)
        .delete(`/api/garagem/${garagem.id}`)
        .set("Authorization", `Bearer ${locador.token}`);
      expect(desativar.status).toBe(204);

      const duranteInatividade = await request(app)
        .get(`/api/garagem?idLocador=${locador.locadorId}`)
        .set("Authorization", `Bearer ${locatario.token}`);
      expect(duranteInatividade.body.result.map((g: any) => g.id)).not.toContain(
        garagem.id,
      );

      const reativar = await request(app)
        .put(`/api/garagem/${garagem.id}`)
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ status: "ATIVA" });
      expect(reativar.status).toBe(200);

      const aposReativacao = await request(app)
        .get(`/api/garagem?idLocador=${locador.locadorId}`)
        .set("Authorization", `Bearer ${locatario.token}`);
      expect(aposReativacao.body.result.map((g: any) => g.id)).toContain(
        garagem.id,
      );
    });

    it("locador continua vendo só as próprias garagens", async () => {
      const doOutro = await createGaragem(
        outroLocador.token,
        outroLocador.locadorId,
      );

      const res = await request(app)
        .get("/api/garagem")
        .set("Authorization", `Bearer ${locador.token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.map((g: any) => g.id)).not.toContain(doOutro.id);
      expect(
        res.body.result.every((g: any) => g.idLocador === locador.locadorId),
      ).toBe(true);
    });

    it("sem autenticação não lista (401)", async () => {
      const res = await request(app).get("/api/garagem");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/garagem/:id", () => {
    it("garagem inexistente responde 404 para o locatário", async () => {
      const res = await request(app)
        .get("/api/garagem/11111111-2222-4333-8444-555555555555")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/reserva — uso dos ids reais", () => {
    it("persiste retirada (garagem do veículo) e devolução escolhida", async () => {
      const retirada = await createGaragem(locador.token, locador.locadorId);
      const devolucao = await createGaragem(locador.token, locador.locadorId);
      const veiculo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });
      await alocarVeiculo(locador.token, retirada.id, veiculo.id);

      const res = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          valorTotal: 300,
          idGaragemRetirada: retirada.id,
          idGaragemDevolucao: devolucao.id,
          ...futurePeriod(200, 2),
        });

      expect(res.status).toBe(201);
      expect(res.body.result.idGaragemRetirada).toBe(retirada.id);
      expect(res.body.result.idGaragemDevolucao).toBe(devolucao.id);

      // persistido de fato, não só ecoado na resposta
      const noBanco = await prisma.reserva.findUnique({
        where: { id: res.body.result.id },
        select: { idGaragemRetirada: true, idGaragemDevolucao: true },
      });
      expect(noBanco?.idGaragemRetirada).toBe(retirada.id);
      expect(noBanco?.idGaragemDevolucao).toBe(devolucao.id);

      await request(app)
        .delete(`/api/garagem/${devolucao.id}`)
        .set("Authorization", `Bearer ${locador.token}`)
        .expect(204);

      const reservaExistente = await request(app)
        .get(`/api/reserva/${res.body.result.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);
      expect(reservaExistente.status).toBe(200);
      expect(reservaExistente.body.result.idGaragemDevolucao).toBe(devolucao.id);
    });

    it("devolução em garagem inexistente responde 404", async () => {
      const retirada = await createGaragem(locador.token, locador.locadorId);
      const veiculo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });
      await alocarVeiculo(locador.token, retirada.id, veiculo.id);

      const res = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          valorTotal: 300,
          idGaragemDevolucao: "11111111-2222-4333-8444-555555555555",
          ...futurePeriod(210, 2),
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/devolução não encontrada/i);
    });

    it("veículo sem garagem alocada rejeita nova reserva sem local de retirada", async () => {
      const devolucao = await createGaragem(locador.token, locador.locadorId);
      const veiculo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });

      const res = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          valorTotal: 300,
          idGaragemDevolucao: devolucao.id,
          ...futurePeriod(220, 2),
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/garagem|retirada|local/i);

      const reserva = await prisma.reserva.findFirst({
        where: { idVeiculo: veiculo.id, idLocatario: locatario.locatarioId },
      });
      expect(reserva).toBeNull();
    });
  });
});
