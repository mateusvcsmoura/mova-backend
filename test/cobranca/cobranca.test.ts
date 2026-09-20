import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

describe("Cobranças financeiras — H-04", () => {
  let locador: LocadorContext;
  let locatarioA: LocatarioContext;
  let locatarioB: LocatarioContext;
  let deslocamento = 1;

  beforeAll(async () => {
    locador = await createLocador();
    locatarioA = await createLocatario();
    locatarioB = await createLocatario();
  });

  afterEach(async () => {
    // Cada caso cria cobranças próprias; quitá-las ao final evita que RN07
    // contamine o próximo caso sem resetar o banco inteiro no meio do arquivo.
    await prisma.cobrancaReserva.updateMany({
      where: { statusPagamento: { in: ["AGUARDANDO_PAGAMENTO", "PROCESSANDO", "FALHA"] } },
      data: { statusPagamento: "SUCESSO" },
    });
  });

  async function pendencia(
    locatario = locatarioA,
    statusPagamento: "AGUARDANDO_PAGAMENTO" | "FALHA" | "PROCESSANDO" =
      "AGUARDANDO_PAGAMENTO",
  ) {
    const reserva = await reservaBase(locatario);
    return cobrancaDaReserva(reserva.id, statusPagamento);
  }

  async function reservaBase(locatario = locatarioA) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    return createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(deslocamento++, 1),
    );
  }

  async function cobrancaDaReserva(
    idReserva: string,
    statusPagamento: "AGUARDANDO_PAGAMENTO" | "FALHA" | "PROCESSANDO" =
      "AGUARDANDO_PAGAMENTO",
  ) {
    return prisma.cobrancaReserva.create({
      data: {
        idReserva,
        tipo: "ATRASO_DEVOLUCAO",
        valor: 42.5,
        statusPagamento,
      },
    });
  }

  function listar(token?: string) {
    const req = request(app).get("/api/cobranca/pendentes");
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  }

  function pagar(id: string, token: string, body: Record<string, unknown> = { metodoPagamento: "PIX" }) {
    return request(app)
      .post(`/api/cobranca/${id}/pagamento`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  it("lista somente pendências próprias e exige autenticação", async () => {
    const propria = await pendencia(locatarioA);
    const deOutro = await pendencia(locatarioB);

    const lista = await listar(locatarioA.token);
    expect(lista.status).toBe(200);
    expect(lista.body.result.map((item: { id: string }) => item.id)).toContain(propria.id);
    expect(lista.body.result.map((item: { id: string }) => item.id)).not.toContain(deOutro.id);

    expect((await listar()).status).toBe(401);
  });

  it("recusa pagamento de outra conta e cobrança inexistente sem revelar dados", async () => {
    const propria = await pendencia(locatarioA);
    const deOutro = await pendencia(locatarioB);

    expect((await pagar(deOutro.id, locatarioA.token)).status).toBe(404);
    expect(
      (await pagar("11111111-2222-4333-8444-555555555555", locatarioA.token)).status,
    ).toBe(404);
    expect(
      (await request(app).post(`/api/cobranca/${propria.id}/pagamento`).send({ metodoPagamento: "PIX" })).status,
    ).toBe(401);
    expect((await listar(locatarioA.token)).body.result.map((item: { id: string }) => item.id)).toContain(propria.id);
  });

  it("aprova PIX, persiste quitação e remove a pendência após nova consulta", async () => {
    const cobranca = await pendencia();

    const pagamento = await pagar(cobranca.id, locatarioA.token);
    expect(pagamento.status).toBe(202);
    expect(pagamento.body.result.cobranca.statusPagamento).toBe("SUCESSO");
    expect(pagamento.body.result.idempotente).toBe(false);

    const persistida = await prisma.cobrancaReserva.findUniqueOrThrow({ where: { id: cobranca.id } });
    expect(persistida.statusPagamento).toBe("SUCESSO");
    expect((await listar(locatarioA.token)).body.result.map((item: { id: string }) => item.id)).not.toContain(cobranca.id);
  });

  it("pagamento já quitado é idempotente e não cria segunda quitação lógica", async () => {
    const cobranca = await pendencia();
    expect((await pagar(cobranca.id, locatarioA.token)).status).toBe(202);
    const novamente = await pagar(cobranca.id, locatarioA.token);

    expect(novamente.status).toBe(202);
    expect(novamente.body.result.idempotente).toBe(true);
    expect(novamente.body.result.cobranca.statusPagamento).toBe("SUCESSO");
    expect(await prisma.cobrancaReserva.count({ where: { id: cobranca.id } })).toBe(1);
  });

  it("recusa do sandbox mantém cobrança pendente", async () => {
    const cobranca = await pendencia();
    const resposta = await pagar(cobranca.id, locatarioA.token, {
      metodoPagamento: "CARTAO_CREDITO",
      cartao: { numero: "4111111111110000", nome: "Teste Sandbox", validade: "12/30", cvv: "123" },
    });

    expect(resposta.status).toBe(202);
    expect(resposta.body.result.cobranca.statusPagamento).toBe("FALHA");
    expect((await listar(locatarioA.token)).body.result.map((item: { id: string }) => item.id)).toContain(cobranca.id);
  });

  it("erro de validação do sandbox não altera cobrança", async () => {
    const cobranca = await pendencia();
    const resposta = await pagar(cobranca.id, locatarioA.token, {
      metodoPagamento: "CARTAO_CREDITO",
    });

    expect(resposta.status).toBe(400);
    expect((await prisma.cobrancaReserva.findUniqueOrThrow({ where: { id: cobranca.id } })).statusPagamento).toBe(
      "AGUARDANDO_PAGAMENTO",
    );
  });

  it("duas tentativas concorrentes geram no máximo uma quitação", async () => {
    const cobranca = await pendencia();
    const respostas = await Promise.all([
      pagar(cobranca.id, locatarioA.token),
      pagar(cobranca.id, locatarioA.token),
    ]);

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([202, 409]);
    expect(await prisma.cobrancaReserva.count({ where: { id: cobranca.id, statusPagamento: "SUCESSO" } })).toBe(1);
  });

  it("mantém bloqueio com qualquer pendência e libera somente após quitar todas", async () => {
    // Cria as duas reservas antes das cobranças: depois da primeira pendência
    // RN07 já impede a criação de nova reserva para o mesmo locatário.
    const reserva1 = await reservaBase();
    const reserva2 = await reservaBase();
    const primeira = await cobrancaDaReserva(reserva1.id);
    const segunda = await cobrancaDaReserva(reserva2.id);
    const novoVeiculo = await createVeiculo(locador.token, locador.locadorId);
    const dadosReserva = { idVeiculo: novoVeiculo.id, idLocatario: locatarioA.locatarioId, ...futurePeriod(1000, 1) };

    expect(
      (await request(app).post("/api/reserva").set("Authorization", `Bearer ${locatarioA.token}`).send(dadosReserva)).status,
    ).toBe(403);
    expect((await pagar(primeira.id, locatarioA.token)).status).toBe(202);
    expect(
      (await request(app).post("/api/reserva").set("Authorization", `Bearer ${locatarioA.token}`).send({ ...dadosReserva, ...futurePeriod(1001, 1) })).status,
    ).toBe(403);
    expect((await pagar(segunda.id, locatarioA.token)).status).toBe(202);

    const liberada = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatarioA.token}`)
      .send({ ...dadosReserva, ...futurePeriod(1002, 1) });
    expect(liberada.status).toBe(201);
  });

  it("estados AGUARDANDO, PROCESSANDO e FALHA bloqueiam; SUCESSO não bloqueia", async () => {
    const estados = ["AGUARDANDO_PAGAMENTO", "PROCESSANDO", "FALHA"] as const;
    for (const statusPagamento of estados) {
      const reserva = await reservaBase(locatarioB);
      const cobranca = await cobrancaDaReserva(reserva.id, statusPagamento);
      expect((await listar(locatarioB.token)).body.result.map((item: { id: string }) => item.id)).toContain(cobranca.id);

      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const bloqueada = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatarioB.token}`)
        .send({ idVeiculo: veiculo.id, idLocatario: locatarioB.locatarioId, ...futurePeriod(2000 + deslocamento++, 1) });
      expect(bloqueada.status).toBe(403);
      await prisma.cobrancaReserva.update({ where: { id: cobranca.id }, data: { statusPagamento: "SUCESSO" } });
    }

    const quitada = await pendencia(locatarioB);
    await prisma.cobrancaReserva.update({ where: { id: quitada.id }, data: { statusPagamento: "SUCESSO" } });
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const liberada = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatarioB.token}`)
      .send({ idVeiculo: veiculo.id, idLocatario: locatarioB.locatarioId, ...futurePeriod(3000, 1) });
    expect(liberada.status).toBe(201);
  });
});
