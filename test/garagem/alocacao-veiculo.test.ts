import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  confirmarPagamentoWebhook,
  futurePeriod,
  LocadorContext,
  LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("FINAL-H-04 — alocação operacional de veículos", () => {
  let locadorA: LocadorContext;
  let locadorB: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locadorA = await createLocador();
    locadorB = await createLocador();
    locatario = await createLocatario();
  });

  async function reservaComStatus(
    veiculoId: string,
    status: "AGUARDANDO_PAGAMENTO" | "CONFIRMADA" | "EM_ANDAMENTO" | "REALIZADA" | "CANCELADA",
    idGaragemDevolucao?: string,
  ) {
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      { ...futurePeriod(100, 2), idGaragemDevolucao },
    );
    if (status !== "AGUARDANDO_PAGAMENTO") {
      await prisma.reserva.update({ where: { id: reserva.id }, data: { status } });
    }
    return reserva;
  }

  async function estadoAlocacao(veiculoId: string, garagemIds: string[]) {
    const [veiculo, garagens] = await Promise.all([
      prisma.veiculo.findUniqueOrThrow({
        where: { id: veiculoId },
        select: { garagemId: true },
      }),
      prisma.garagem.findMany({
        where: { id: { in: garagemIds } },
        select: { id: true, veiculosAlocados: true },
      }),
    ]);
    return { veiculo, garagens };
  }

  it("persiste garagemId informado no cadastro do veículo", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId);

    const response = await request(app)
      .post("/api/veiculo")
      .set(auth(locadorA.token))
      .send({
        idLocador: locadorA.locadorId,
        placa: "H040001",
        marca: "MOVA",
        modelo: "Cadastro H04",
        ano: 2024,
        cambio: "Manual",
        capacidade: 5,
        valorDiaria: 150,
        eletrico: false,
        adaptado: false,
        garagemId: garagem.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.result.garagemId).toBe(garagem.id);

    const persisted = await prisma.veiculo.findUnique({
      where: { id: response.body.result.id },
      select: { garagemId: true },
    });
    expect(persisted?.garagemId).toBe(garagem.id);
  });

  it("rejeita garagem de outro locador no cadastro", async () => {
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId);

    const response = await request(app)
      .post("/api/veiculo")
      .set(auth(locadorA.token))
      .send({
        idLocador: locadorA.locadorId,
        placa: "H040002",
        marca: "MOVA",
        modelo: "Ownership H04",
        ano: 2024,
        cambio: "Manual",
        capacidade: 5,
        valorDiaria: 150,
        eletrico: false,
        adaptado: false,
        garagemId: garagemB.id,
      });

    expect(response.status).toBe(403);
  });

  it("aloca, move e torna a repetição idempotente sem consumir vaga duas vezes", async () => {
    const garagemA = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 2,
    });
    const garagemB = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 2,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });

    const primeira = await request(app)
      .post(`/api/garagem/${garagemA.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));
    expect(primeira.status).toBe(204);

    const repetida = await request(app)
      .post(`/api/garagem/${garagemA.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));
    expect(repetida.status).toBe(204);

    const movida = await request(app)
      .post(`/api/garagem/${garagemB.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));
    expect(movida.status).toBe(204);

    const estado = await prisma.veiculo.findUnique({
      where: { id: veiculo.id },
      select: { garagemId: true },
    });
    const contagens = await prisma.garagem.findMany({
      where: { id: { in: [garagemA.id, garagemB.id] } },
      select: { id: true, veiculosAlocados: true },
    });

    expect(estado?.garagemId).toBe(garagemB.id);
    expect(contagens.find((g) => g.id === garagemA.id)?.veiculosAlocados).toBe(0);
    expect(contagens.find((g) => g.id === garagemB.id)?.veiculosAlocados).toBe(1);
  });

  it("não permite cruzar ownership de garagem ou veículo", async () => {
    const garagemA = await createGaragem(locadorA.token, locadorA.locadorId);
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId);
    const veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });
    const veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId, {
      garagemId: null,
    });

    const garagemAlheia = await request(app)
      .post(`/api/garagem/${garagemB.id}/veiculos/${veiculoA.id}`)
      .set(auth(locadorA.token));
    expect(garagemAlheia.status).toBe(403);

    const veiculoAlheio = await request(app)
      .post(`/api/garagem/${garagemA.id}/veiculos/${veiculoB.id}`)
      .set(auth(locadorA.token));
    expect(veiculoAlheio.status).toBe(403);
  });

  it.each(["MANUTENCAO", "INATIVA"])(
    "não permite alocação nova em garagem %s",
    async (status) => {
      const garagem = await createGaragem(locadorA.token, locadorA.locadorId);
      const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
        garagemId: null,
      });

      await request(app)
        .put(`/api/garagem/${garagem.id}`)
        .set(auth(locadorA.token))
        .send({ status });

      const response = await request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token));

      expect(response.status).toBe(409);
    },
  );

  it("não excede capacidade 1 em duas alocações concorrentes", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 1,
    });
    const veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });
    const veiculoB = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });

    const respostas = await Promise.all([
      request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculoA.id}`)
        .set(auth(locadorA.token)),
      request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculoB.id}`)
        .set(auth(locadorA.token)),
    ]);

    expect(respostas.filter((resposta) => resposta.status === 204)).toHaveLength(1);
    expect(respostas.filter((resposta) => resposta.status === 409)).toHaveLength(1);

    const estado = await prisma.garagem.findUnique({
      where: { id: garagem.id },
      select: { capacidade: true, veiculosAlocados: true },
    });
    const alocados = await prisma.veiculo.count({ where: { garagemId: garagem.id } });
    expect(estado?.veiculosAlocados).toBe(1);
    expect(alocados).toBe(1);
    expect(alocados).toBeLessThanOrEqual(estado?.capacidade ?? 0);
  });

  it("edição de garagemId move atomicamente e rejeita destino cheio", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 1,
    });
    const ocupante = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: destino.id,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: origem.id,
      placa: "H040003",
    });

    const response = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locadorA.token))
      .send({ garagemId: destino.id, status: "DISPONIVEL" });

    expect(response.status).toBe(409);
    expect(ocupante.id).toBeTruthy();

    const persisted = await prisma.veiculo.findUnique({
      where: { id: veiculo.id },
      select: { garagemId: true },
    });
    expect(persisted?.garagemId).toBe(origem.id);
  });

  it("não permite reduzir capacidade abaixo dos veículos já alocados", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 2,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagem.id,
    });
    await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagem.id,
    });

    const response = await request(app)
      .put(`/api/garagem/${garagem.id}`)
      .set(auth(locadorA.token))
      .send({ capacidade: 1 });

    expect(response.status).toBe(409);
    const persistida = await prisma.garagem.findUnique({
      where: { id: garagem.id },
      select: { capacidade: true, veiculosAlocados: true },
    });
    expect(persistida).toMatchObject({ capacidade: 2, veiculosAlocados: 2 });
    expect(veiculo.garagemId).toBe(garagem.id);
  });

  it("não oferece nem reserva veículo sem garagem operacional", async () => {
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });

    const catalogo = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.result.map((item: any) => item.id)).not.toContain(veiculo.id);

    const reserva = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(50, 2),
      });
    expect(reserva.status).toBe(409);
    expect(reserva.body.message).toMatch(/garagem|retirada|local/i);
  });

  it("não oferece nem reserva veículo em garagem não operacional", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagem.id,
    });

    await request(app)
      .put(`/api/garagem/${garagem.id}`)
      .set(auth(locadorA.token))
      .send({ status: "MANUTENCAO" });

    const catalogo = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.result.map((item: any) => item.id)).not.toContain(veiculo.id);

    const reserva = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(60, 2),
      });
    expect(reserva.status).toBe(409);
  });

  it.each(["AGUARDANDO_PAGAMENTO", "CONFIRMADA", "EM_ANDAMENTO"] as const)(
    "B9: POST bloqueia veículo com reserva %s e preserva locais e contadores",
    async (status) => {
      const origem = await createGaragem(locadorA.token, locadorA.locadorId);
      const destino = await createGaragem(locadorA.token, locadorA.locadorId);
      const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
        garagemId: origem.id,
      });
      const reserva = await reservaComStatus(veiculo.id, status, destino.id);

      const response = await request(app)
        .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token));

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: "VEHICLE_HAS_ACTIVE_RESERVATION",
        message: expect.stringMatching(/reserva.*impede.*transfer/i),
        requestId: expect.any(String),
      });
      const [estado, reservaPersistida] = await Promise.all([
        estadoAlocacao(veiculo.id, [origem.id, destino.id]),
        prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } }),
      ]);
      expect(estado.veiculo.garagemId).toBe(origem.id);
      expect(estado.garagens.find((g) => g.id === origem.id)?.veiculosAlocados).toBe(1);
      expect(estado.garagens.find((g) => g.id === destino.id)?.veiculosAlocados).toBe(0);
      expect(reservaPersistida).toMatchObject({
        idGaragemRetirada: origem.id,
        idGaragemDevolucao: destino.id,
      });
    },
  );

  it.each(["CONFIRMADA", "EM_ANDAMENTO"] as const)(
    "B9: PUT e desalocação não contornam reserva %s",
    async (status) => {
      const origem = await createGaragem(locadorA.token, locadorA.locadorId);
      const destino = await createGaragem(locadorA.token, locadorA.locadorId);
      const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
        garagemId: origem.id,
      });
      const reserva = await reservaComStatus(veiculo.id, status, destino.id);

      const viaPut = await request(app)
        .put(`/api/veiculo/${veiculo.id}`)
        .set(auth(locadorA.token))
        .send({ garagemId: destino.id });
      const viaDelete = await request(app)
        .delete(`/api/garagem/${origem.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token));

      expect(viaPut.body).toMatchObject({ code: "VEHICLE_HAS_ACTIVE_RESERVATION" });
      expect(viaPut.status).toBe(409);
      expect(viaDelete.body).toMatchObject({ code: "VEHICLE_HAS_ACTIVE_RESERVATION" });
      expect(viaDelete.status).toBe(409);
      const [estado, reservaPersistida] = await Promise.all([
        estadoAlocacao(veiculo.id, [origem.id, destino.id]),
        prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } }),
      ]);
      expect(estado.veiculo.garagemId).toBe(origem.id);
      expect(reservaPersistida.idGaragemRetirada).toBe(origem.id);
      expect(reservaPersistida.idGaragemDevolucao).toBe(destino.id);
    },
  );

  it.each(["CANCELADA", "REALIZADA"] as const)(
    "B9: reserva %s encerrada libera movimentação",
    async (status) => {
      const origem = await createGaragem(locadorA.token, locadorA.locadorId);
      const destino = await createGaragem(locadorA.token, locadorA.locadorId);
      const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
        garagemId: origem.id,
      });
      await reservaComStatus(veiculo.id, status);

      const response = await request(app)
        .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token));

      expect(response.status).toBe(204);
      expect((await estadoAlocacao(veiculo.id, [origem.id, destino.id])).veiculo.garagemId).toBe(destino.id);
    },
  );

  it("B9: data passada não expira pendência sem transição de domínio", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: origem.id,
    });
    const reserva = await reservaComStatus(veiculo.id, "AGUARDANDO_PAGAMENTO");
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        dataHoraInicio: new Date(Date.now() - 3 * 86_400_000),
        dataHoraFim: new Date(Date.now() - 2 * 86_400_000),
      },
    });

    const response = await request(app)
      .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("VEHICLE_HAS_ACTIVE_RESERVATION");
  });

  it("B9: mesma garagem é no-op mesmo quando há pendência", async () => {
    const garagem = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, { garagemId: garagem.id });
    await reservaComStatus(veiculo.id, "AGUARDANDO_PAGAMENTO");

    const response = await request(app)
      .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
      .set(auth(locadorA.token));

    expect(response.status).toBe(204);
    expect((await estadoAlocacao(veiculo.id, [garagem.id])).garagens[0]?.veiculosAlocados).toBe(1);
  });

  it("B9: locatário não movimenta veículo antes da regra de domínio", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, { garagemId: origem.id });
    await reservaComStatus(veiculo.id, "AGUARDANDO_PAGAMENTO");

    const response = await request(app)
      .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
      .set(auth(locatario.token));

    expect(response.status).toBe(403);
  });

  it("B9: confirmação concorrente não move, nem reescreve o local prometido", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, { garagemId: origem.id });
    const reserva = await reservaComStatus(veiculo.id, "AGUARDANDO_PAGAMENTO", destino.id);

    const [confirmacao, movimento] = await Promise.all([
      confirmarPagamentoWebhook(reserva.id),
      request(app)
        .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token)),
    ]);

    expect(confirmacao.status).toBe(200);
    expect(movimento.status).toBe(409);
    const [estado, persistida] = await Promise.all([
      estadoAlocacao(veiculo.id, [origem.id, destino.id]),
      prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } }),
    ]);
    expect(estado.veiculo.garagemId).toBe(origem.id);
    expect(persistida).toMatchObject({
      status: "CONFIRMADA",
      idGaragemRetirada: origem.id,
      idGaragemDevolucao: destino.id,
    });
  });

  it("B9: criação concorrente não deixa retirada obsoleta", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, { garagemId: origem.id });

    const [criacao, movimento] = await Promise.all([
      request(app)
        .post("/api/reserva")
        .set(auth(locatario.token))
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          ...futurePeriod(200, 2),
        }),
      request(app)
        .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token)),
    ]);

    expect([201, 409]).toContain(criacao.status);
    expect([204, 409]).toContain(movimento.status);
    const [estado, reservas] = await Promise.all([
      estadoAlocacao(veiculo.id, [origem.id, destino.id]),
      prisma.reserva.findMany({ where: { idVeiculo: veiculo.id } }),
    ]);
    expect(reservas).toHaveLength(criacao.status === 201 ? 1 : 0);
    for (const reserva of reservas) {
      expect(reserva.idGaragemRetirada).toBe(estado.veiculo.garagemId);
    }
  });

  it("B9: cancelamento concorrente resulta em bloqueio conservador ou movimento após cancelamento", async () => {
    const origem = await createGaragem(locadorA.token, locadorA.locadorId);
    const destino = await createGaragem(locadorA.token, locadorA.locadorId);
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, { garagemId: origem.id });
    const reserva = await reservaComStatus(veiculo.id, "AGUARDANDO_PAGAMENTO", destino.id);

    const [cancelamento, movimento] = await Promise.all([
      request(app)
        .post(`/api/reserva/${reserva.id}/cancelar`)
        .set(auth(locatario.token)),
      request(app)
        .post(`/api/garagem/${destino.id}/veiculos/${veiculo.id}`)
        .set(auth(locadorA.token)),
    ]);

    expect(cancelamento.status).toBe(200);
    expect([204, 409]).toContain(movimento.status);
    const [estado, persistida] = await Promise.all([
      estadoAlocacao(veiculo.id, [origem.id, destino.id]),
      prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } }),
    ]);
    expect(persistida).toMatchObject({
      status: "CANCELADA",
      idGaragemRetirada: origem.id,
      idGaragemDevolucao: destino.id,
    });
    expect(estado.veiculo.garagemId).toBe(movimento.status === 204 ? destino.id : origem.id);
  });
});
