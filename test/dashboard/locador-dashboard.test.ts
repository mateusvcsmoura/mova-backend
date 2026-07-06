import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// Seed direto de reserva (bypassa regras de negócio de criação — foco é o
// relatório). Duração de 24h por padrão.
async function seedReserva(
  idVeiculo: string,
  idLocatario: string,
  opts: {
    status: string;
    statusPagamento: string;
    valorTotal: number;
    horas?: number;
  },
) {
  const inicio = new Date("2026-01-01T10:00:00.000Z");
  const fim = new Date(inicio.getTime() + (opts.horas ?? 24) * 3600 * 1000);
  return prisma.reserva.create({
    data: {
      idVeiculo,
      idLocatario,
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      valorTotal: opts.valorTotal,
      status: opts.status as any,
      statusPagamento: opts.statusPagamento as any,
    },
  });
}

describe("Dashboard do locador (RF17/RF18)", () => {
  let locadorA: LocadorContext;
  let locadorB: LocadorContext;
  let locatario: LocatarioContext;
  let v1: string;
  let v2: string;
  let v3: string;

  beforeAll(async () => {
    locadorA = await createLocador();
    locadorB = await createLocador();
    locatario = await createLocatario();

    v1 = (await createVeiculo(locadorA.token, locadorA.locadorId)).id;
    v2 = (await createVeiculo(locadorA.token, locadorA.locadorId)).id;
    v3 = (await createVeiculo(locadorA.token, locadorA.locadorId)).id;

    // Reservas do locador A (5 no total).
    await seedReserva(v1, locatario.locatarioId, {
      status: "REALIZADA",
      statusPagamento: "SUCESSO",
      valorTotal: 100,
    });
    await seedReserva(v1, locatario.locatarioId, {
      status: "EM_ANDAMENTO",
      statusPagamento: "SUCESSO",
      valorTotal: 200,
    });
    await seedReserva(v2, locatario.locatarioId, {
      status: "CANCELADA",
      statusPagamento: "AGUARDANDO_PAGAMENTO",
      valorTotal: 999,
    });
    await seedReserva(v2, locatario.locatarioId, {
      status: "CONFIRMADA",
      statusPagamento: "SUCESSO",
      valorTotal: 300,
    });
    await seedReserva(v3, locatario.locatarioId, {
      status: "AGUARDANDO_PAGAMENTO",
      statusPagamento: "AGUARDANDO_PAGAMENTO",
      valorTotal: 50,
    });

    // Estado da frota + alerta + localização do locador A.
    await prisma.veiculo.update({
      where: { id: v1 },
      data: { status: "RESERVADO" },
    });
    await prisma.alertaVeiculo.create({
      data: {
        tipo: "INATIVIDADE",
        idVeiculo: v3,
        idLocador: locadorA.locadorId,
        descricao: "Inativo há 10 dias",
        destinatario: locadorA.email,
        assunto: "Alerta de inatividade",
      },
    });
    await prisma.localizacao.create({
      data: { idVeiculo: v1, latitude: -23.55, longitude: -46.63 },
    });

    // Locador B: dados que NÃO devem vazar para o dashboard de A.
    const vB = (await createVeiculo(locadorB.token, locadorB.locadorId)).id;
    await seedReserva(vB, locatario.locatarioId, {
      status: "REALIZADA",
      statusPagamento: "SUCESSO",
      valorTotal: 5000,
    });
  }, 60_000);

  describe("GET /api/dashboard/reservas", () => {
    it("conta reservas do locador por status", async () => {
      const res = await request(app)
        .get("/api/dashboard/reservas")
        .set(auth(locadorA.token));

      expect(res.status).toBe(200);
      expect(res.body.result.total).toBe(5);
      expect(res.body.result.canceladas).toBe(1);
      expect(res.body.result.concluidas).toBe(1);
      expect(res.body.result.emAndamento).toBe(1);
      expect(res.body.result.confirmadas).toBe(1);
    });

    it("recusa locatário (403)", async () => {
      const res = await request(app)
        .get("/api/dashboard/reservas")
        .set(auth(locatario.token));
      expect(res.status).toBe(403);
    });

    it("recusa sem autenticação (401)", async () => {
      const res = await request(app).get("/api/dashboard/reservas");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/dashboard/financeiro", () => {
    it("soma apenas pagamentos confirmados, isolado por locador", async () => {
      const res = await request(app)
        .get("/api/dashboard/financeiro")
        .set(auth(locadorA.token));

      expect(res.status).toBe(200);
      // 100 + 200 + 300 (SUCESSO); 999 (cancelada, não paga) e 50 fora.
      expect(res.body.result.faturamentoBruto).toBe(600);
      expect(res.body.result.porVeiculo.length).toBe(2);
      expect(res.body.result.porPeriodo.length).toBeGreaterThan(0);
    });

    it("não vaza faturamento entre locadores", async () => {
      const res = await request(app)
        .get("/api/dashboard/financeiro")
        .set(auth(locadorB.token));

      expect(res.status).toBe(200);
      expect(res.body.result.faturamentoBruto).toBe(5000);
    });
  });

  describe("GET /api/dashboard/utilizacao", () => {
    it("calcula ocupação e tempo médio da frota do locador", async () => {
      const res = await request(app)
        .get("/api/dashboard/utilizacao")
        .set(auth(locadorA.token));

      expect(res.status).toBe(200);
      expect(res.body.result.totalVeiculos).toBe(3);
      expect(res.body.result.veiculosReservados).toBe(1); // v1
      expect(res.body.result.taxaOcupacao).toBeCloseTo(1 / 3, 4);
      // 4 reservas não canceladas, 24h cada -> média 24h.
      expect(res.body.result.tempoMedioReservadoHoras).toBe(24);
      expect(res.body.result.maisUtilizados.length).toBeGreaterThan(0);
      expect(res.body.result.maisUtilizados[0].idVeiculo).toBe(v1); // 2 reservas
    });
  });

  describe("GET /api/dashboard/frota", () => {
    it("retorna contagens de status, alertas ativos e últimas localizações", async () => {
      const res = await request(app)
        .get("/api/dashboard/frota")
        .set(auth(locadorA.token));

      expect(res.status).toBe(200);
      expect(res.body.result.veiculos.total).toBe(3);
      expect(res.body.result.veiculos.reservado).toBe(1);
      expect(res.body.result.veiculos.disponivel).toBe(2);
      expect(res.body.result.alertasAtivos).toBe(1);
      expect(res.body.result.ultimasLocalizacoes.length).toBe(1);
      expect(res.body.result.ultimasLocalizacoes[0].idVeiculo).toBe(v1);
    });
  });
});
