import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createVeiculo,
  LocadorContext,
  LocatarioContext,
} from "../helpers";

// TASK 03 — representação de data/hora ponta a ponta.
// As regras RN05 permanecem intactas; aqui se verifica que o INSTANTE é o mesmo
// em todo o caminho e que as bordas respondem como documentado.
// Ver auditoria/DATAS-HORARIOS.md.
describe("Datas e horários da reserva", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  const HORA = 60 * 60 * 1000;
  const DIA = 24 * HORA;

  async function veiculoAlocado() {
    const garagem = await createGaragem(locador.token, locador.locadorId);
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    await request(app)
      .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`);
    return veiculo;
  }

  async function criar(inicio: Date, fim: Date) {
    const veiculo = await veiculoAlocado();
    return request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        valorTotal: 200,
        dataHoraInicio: inicio.toISOString(),
        dataHoraFim: fim.toISOString(),
      });
  }

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  describe("Casos de período", () => {
    it("daqui a algumas horas → 201", async () => {
      const inicio = new Date(Date.now() + 3 * HORA);
      const res = await criar(inicio, new Date(inicio.getTime() + 5 * HORA));
      expect(res.status).toBe(201);
    });

    it("amanhã → 201", async () => {
      const inicio = new Date(Date.now() + DIA);
      const res = await criar(inicio, new Date(inicio.getTime() + 2 * DIA));
      expect(res.status).toBe(201);
    });

    it("exatamente 1 hora → 201 (borda inclusiva)", async () => {
      const inicio = new Date(Date.now() + 2 * DIA);
      const res = await criar(inicio, new Date(inicio.getTime() + HORA));
      expect(res.status).toBe(201);
    });

    it("1 minuto a menos que 1 hora → 400", async () => {
      const inicio = new Date(Date.now() + 2 * DIA);
      const res = await criar(inicio, new Date(inicio.getTime() + HORA - 60_000));
      expect(res.status).toBe(400);
    });

    it("exatamente 30 dias → 201 (borda inclusiva)", async () => {
      const inicio = new Date(Date.now() + 3 * DIA);
      const res = await criar(inicio, new Date(inicio.getTime() + 30 * DIA));
      expect(res.status).toBe(201);
    });

    it("1 minuto a mais que 30 dias → 400", async () => {
      const inicio = new Date(Date.now() + 3 * DIA);
      const res = await criar(
        inicio,
        new Date(inicio.getTime() + 30 * DIA + 60_000),
      );
      expect(res.status).toBe(400);
    });

    it("fim anterior ao início → 400", async () => {
      const inicio = new Date(Date.now() + 5 * DIA);
      const res = await criar(inicio, new Date(inicio.getTime() - 2 * HORA));
      expect(res.status).toBe(400);
    });

    it("fim igual ao início → 400", async () => {
      const inicio = new Date(Date.now() + 5 * DIA);
      const res = await criar(inicio, new Date(inicio.getTime()));
      expect(res.status).toBe(400);
    });

    it("início no passado → 400", async () => {
      const inicio = new Date(Date.now() - HORA);
      const res = await criar(inicio, new Date(Date.now() + 5 * HORA));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/passado/i);
    });

    it("atravessa a virada do dia (23:30 → 00:30) → 201", async () => {
      // 1 hora exata cruzando a meia-noite. Se em algum ponto houvesse
      // truncamento por "dia" em vez de instante, este caso quebraria.
      const base = new Date(Date.now() + 10 * DIA);
      base.setUTCHours(23, 30, 0, 0);
      const fim = new Date(base.getTime() + HORA);
      expect(fim.getUTCDate()).not.toBe(base.getUTCDate());

      const res = await criar(base, fim);
      expect(res.status).toBe(201);
    });
  });

  describe("Representação do instante", () => {
    it("offset explícito e UTC representam o mesmo instante", async () => {
      // O mesmo momento escrito de duas formas: z.coerce.date() precisa tratar
      // as duas como idênticas, e a API responde sempre normalizada em UTC.
      const comOffset = "2027-06-10T10:00:00-03:00";
      const emUtc = "2027-06-10T13:00:00.000Z";
      expect(new Date(comOffset).getTime()).toBe(new Date(emUtc).getTime());

      const veiculo = await veiculoAlocado();
      const res = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          valorTotal: 200,
          dataHoraInicio: comOffset,
          dataHoraFim: "2027-06-11T13:00:00.000Z",
        });

      expect(res.status).toBe(201);
      expect(res.body.result.dataHoraInicio).toBe(emUtc);
    });

    it("o instante sobrevive ao round-trip banco → API", async () => {
      const inicio = new Date(Date.now() + 7 * DIA);
      inicio.setUTCMilliseconds(0);
      const fim = new Date(inicio.getTime() + 3 * HORA);

      const criada = await criar(inicio, fim);
      expect(criada.status).toBe(201);

      const noBanco = await prisma.reserva.findUnique({
        where: { id: criada.body.result.id },
        select: { dataHoraInicio: true, dataHoraFim: true },
      });

      expect(noBanco?.dataHoraInicio.getTime()).toBe(inicio.getTime());
      expect(noBanco?.dataHoraFim.getTime()).toBe(fim.getTime());

      const lida = await request(app)
        .get(`/api/reserva/${criada.body.result.id}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(new Date(lida.body.result.dataHoraInicio).getTime()).toBe(
        inicio.getTime(),
      );
      expect(new Date(lida.body.result.dataHoraFim).getTime()).toBe(
        fim.getTime(),
      );
    });

    it("a resposta JSON usa sempre ISO 8601 em UTC (sufixo Z)", async () => {
      const inicio = new Date(Date.now() + 8 * DIA);
      const res = await criar(inicio, new Date(inicio.getTime() + 4 * HORA));

      expect(res.status).toBe(201);
      expect(res.body.result.dataHoraInicio).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(res.body.result.dataHoraFim).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
