import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  createAccount,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Semeia uma Reserva REALIZADA + Avaliacao diretamente via Prisma. O módulo de
// relatório é de leitura e percorre Avaliacao -> Reserva -> Veiculo -> Locador;
// semear direto dá controle total sobre nota/data/veículo sem esbarrar nas
// regras de período/overlap da criação de reservas.
async function seedAvaliacao(
  idVeiculo: string,
  idLocatario: string,
  opts: { nota: number; data: Date; comentario?: string | null },
) {
  const inicio = new Date(opts.data);
  const fim = new Date(inicio.getTime() + 2 * 24 * 60 * 60 * 1000);

  const reserva = await prisma.reserva.create({
    data: {
      idVeiculo,
      idLocatario,
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      valorTotal: 100,
      status: "REALIZADA",
    },
  });

  return prisma.avaliacao.create({
    data: {
      idReserva: reserva.id,
      nota: opts.nota,
      comentario: opts.comentario ?? null,
      data: opts.data,
    },
  });
}

const relatorio = (token: string, query = "") =>
  request(app)
    .get(`/api/avaliacao/relatorio${query}`)
    .set("Authorization", `Bearer ${token}`);

describe("Relatório de Avaliações (dashboard do locador)", () => {
  let locadorA: LocadorContext;
  let locadorB: LocadorContext;
  let locatario: LocatarioContext;

  // Veículos do locador A.
  let vA1: any;
  let vA2: any;
  // Veículo do locador B (nunca deve aparecer nos relatórios de A).
  let vB1: any;

  // Datas fixas para tornar os buckets de evolução e os filtros de período
  // determinísticos (meia-noite p/ evitar viés de fuso na borda dos meses).
  const DATA_ABR = new Date("2026-04-10T12:00:00.000Z");
  const DATA_MAI = new Date("2026-05-10T12:00:00.000Z");
  const DATA_JUN = new Date("2026-06-10T12:00:00.000Z");

  beforeAll(async () => {
    locadorA = await createLocador();
    locadorB = await createLocador();
    locatario = await createLocatario();

    vA1 = await createVeiculo(locadorA.locadorId, {
      marca: "Fiat",
      modelo: "Argo",
    });
    vA2 = await createVeiculo(locadorA.locadorId, {
      marca: "VW",
      modelo: "Gol",
    });
    vB1 = await createVeiculo(locadorB.locadorId);

    // Locador A: vA1 -> [5 (mai), 4 (jun)]; vA2 -> [3 (abr)].
    await seedAvaliacao(vA1.id, locatario.locatarioId, {
      nota: 5,
      data: DATA_MAI,
      comentario: "Excelente",
    });
    await seedAvaliacao(vA1.id, locatario.locatarioId, {
      nota: 4,
      data: DATA_JUN,
      comentario: "Bom",
    });
    await seedAvaliacao(vA2.id, locatario.locatarioId, {
      nota: 3,
      data: DATA_ABR,
      comentario: "Regular",
    });

    // Locador B: vB1 -> [1 (jun)]. Isolamento.
    await seedAvaliacao(vB1.id, locatario.locatarioId, {
      nota: 1,
      data: DATA_JUN,
      comentario: "Ruim",
    });
  });

  describe("Resumo geral", () => {
    it("deve calcular total, média, maior e menor nota", async () => {
      const res = await relatorio(locadorA.token);

      expect(res.status).toBe(200);
      const { resumo } = res.body.result;
      expect(resumo.total).toBe(3);
      expect(resumo.media).toBeCloseTo(4, 5); // (5+4+3)/3
      expect(resumo.maior).toBe(5);
      expect(resumo.menor).toBe(3);
    });

    it("não deve incluir avaliações de outro locador (isolamento)", async () => {
      const res = await relatorio(locadorA.token);
      // nota 1 pertence ao locador B; jamais entra no total/menor de A.
      expect(res.body.result.resumo.total).toBe(3);
      expect(res.body.result.resumo.menor).toBe(3);
    });

    it("relatório do locador B considera apenas os veículos de B", async () => {
      const res = await relatorio(locadorB.token);
      expect(res.body.result.resumo.total).toBe(1);
      expect(res.body.result.resumo.media).toBeCloseTo(1, 5);
    });
  });

  describe("Distribuição das notas", () => {
    it("deve contar avaliações por nota", async () => {
      const res = await relatorio(locadorA.token);
      const dist = res.body.result.distribuicao as Array<{
        nota: number;
        quantidade: number;
      }>;

      const mapa = Object.fromEntries(dist.map((d) => [d.nota, d.quantidade]));
      expect(mapa[3]).toBe(1);
      expect(mapa[4]).toBe(1);
      expect(mapa[5]).toBe(1);
      // nota 1 (locador B) não aparece.
      expect(mapa[1]).toBeUndefined();
    });
  });

  describe("Média por veículo e ranking", () => {
    it("deve retornar média por veículo ordenada da maior para a menor", async () => {
      const res = await relatorio(locadorA.token);
      const lista = res.body.result.mediaPorVeiculo as Array<any>;

      expect(lista).toHaveLength(2);
      // vA1 (média 4.5) antes de vA2 (média 3).
      expect(lista[0].veiculo.id).toBe(vA1.id);
      expect(lista[0].quantidade).toBe(2);
      expect(lista[0].media).toBeCloseTo(4.5, 5);
      expect(lista[0].maior).toBe(5);
      expect(lista[0].menor).toBe(4);

      expect(lista[1].veiculo.id).toBe(vA2.id);
      expect(lista[1].media).toBeCloseTo(3, 5);
    });

    it("deve incluir dados de exibição do veículo (placa, marca, modelo)", async () => {
      const res = await relatorio(locadorA.token);
      const veic = res.body.result.mediaPorVeiculo[0].veiculo;
      expect(veic.placa).toBe(vA1.placa);
      expect(veic.marca).toBe("Fiat");
      expect(veic.modelo).toBe("Argo");
    });

    it("deve rankear veículos por quantidade de avaliações", async () => {
      const res = await relatorio(locadorA.token);
      const ranking = res.body.result.ranking as Array<any>;

      expect(ranking[0].veiculo.id).toBe(vA1.id);
      expect(ranking[0].quantidade).toBe(2);
      expect(ranking[1].veiculo.id).toBe(vA2.id);
      expect(ranking[1].quantidade).toBe(1);
    });
  });

  describe("Evolução por período", () => {
    it("deve agregar por mês (default)", async () => {
      const res = await relatorio(locadorA.token);
      const evo = res.body.result.evolucao as Array<{
        periodo: string;
        quantidade: number;
        media: number;
      }>;

      // 3 meses distintos: abr, mai, jun (ordem ascendente).
      expect(evo).toHaveLength(3);
      expect(evo[0].periodo.startsWith("2026-04")).toBe(true);
      expect(evo[0].media).toBeCloseTo(3, 5);
      expect(evo[2].periodo.startsWith("2026-06")).toBe(true);
      expect(evo[2].media).toBeCloseTo(4, 5);
    });

    it("deve agregar por ano quando granularidade=ano", async () => {
      const res = await relatorio(locadorA.token, "?granularidade=ano");
      const evo = res.body.result.evolucao;
      expect(evo).toHaveLength(1);
      expect(evo[0].periodo.startsWith("2026")).toBe(true);
      expect(evo[0].quantidade).toBe(3);
    });
  });

  describe("Comentários recentes", () => {
    it("deve retornar comentários do mais recente ao mais antigo", async () => {
      const res = await relatorio(locadorA.token);
      const coments = res.body.result.comentariosRecentes as Array<any>;

      expect(coments).toHaveLength(3);
      expect(coments[0].comentario).toBe("Bom"); // jun
      expect(coments[0].nota).toBe(4);
      expect(coments[0].veiculo.id).toBe(vA1.id);
      expect(coments[2].comentario).toBe("Regular"); // abr
    });

    it("deve respeitar o limite de comentários", async () => {
      const res = await relatorio(locadorA.token, "?limiteComentarios=1");
      expect(res.body.result.comentariosRecentes).toHaveLength(1);
      expect(res.body.result.comentariosRecentes[0].comentario).toBe("Bom");
    });
  });

  describe("Filtros", () => {
    it("deve filtrar por período", async () => {
      const res = await relatorio(
        locadorA.token,
        "?dataInicio=2026-05-01&dataFim=2026-06-30",
      );
      // Exclui a avaliação de abril (vA2).
      expect(res.body.result.resumo.total).toBe(2);
      expect(res.body.result.resumo.media).toBeCloseTo(4.5, 5);
    });

    it("deve filtrar por veículo específico", async () => {
      const res = await relatorio(locadorA.token, `?idVeiculo=${vA1.id}`);
      expect(res.body.result.resumo.total).toBe(2);
      expect(res.body.result.mediaPorVeiculo).toHaveLength(1);
      expect(res.body.result.mediaPorVeiculo[0].veiculo.id).toBe(vA1.id);
    });

    it("deve filtrar por modelo do veículo", async () => {
      const res = await relatorio(
        locadorA.token,
        `?idModeloVeiculo=${vA1.idModeloVeiculo}`,
      );
      expect(res.body.result.resumo.total).toBe(2);
      expect(res.body.result.mediaPorVeiculo[0].veiculo.id).toBe(vA1.id);
    });

    it("deve filtrar por nota mínima", async () => {
      const res = await relatorio(locadorA.token, "?notaMin=5");
      expect(res.body.result.resumo.total).toBe(1);
      expect(res.body.result.resumo.media).toBeCloseTo(5, 5);
    });

    it("deve filtrar por faixa de nota", async () => {
      const res = await relatorio(locadorA.token, "?notaMin=4&notaMax=5");
      expect(res.body.result.resumo.total).toBe(2);
      expect(res.body.result.resumo.menor).toBe(4);
    });

    it("deve recusar dataFim anterior a dataInicio", async () => {
      const res = await relatorio(
        locadorA.token,
        "?dataInicio=2026-06-01&dataFim=2026-05-01",
      );
      expect(res.status).toBe(400);
    });

    it("deve recusar nota fora da escala 1..5", async () => {
      const res = await relatorio(locadorA.token, "?notaMin=0");
      expect(res.status).toBe(400);
    });
  });

  describe("Ausência de avaliações", () => {
    it("deve retornar zeros e listas vazias para locador sem avaliações", async () => {
      const semDados = await createLocador();
      const res = await relatorio(semDados.token);

      expect(res.status).toBe(200);
      const r = res.body.result;
      expect(r.resumo).toEqual({
        total: 0,
        media: null,
        maior: null,
        menor: null,
      });
      expect(r.distribuicao).toEqual([]);
      expect(r.mediaPorVeiculo).toEqual([]);
      expect(r.ranking).toEqual([]);
      expect(r.evolucao).toEqual([]);
      expect(r.comentariosRecentes).toEqual([]);
    });
  });

  describe("Autorização", () => {
    it("deve recusar acesso sem autenticação (401)", async () => {
      const res = await request(app).get("/api/avaliacao/relatorio");
      expect(res.status).toBe(401);
    });

    it("deve recusar acesso de LOCATARIO (403)", async () => {
      const res = await relatorio(locatario.token);
      expect(res.status).toBe(403);
    });

    it("deve recusar acesso de ADMIN (403)", async () => {
      const admin = await createAccount("ADMIN");
      const res = await relatorio(admin.token);
      expect(res.status).toBe(403);
    });
  });
});
