import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createVeiculo,
  futurePeriod,
  uniquePlaca,
} from "../helpers";

// FINAL-H-04 — cadeia garagem → veículo → catálogo → reserva.
// Todos os ataques passam pela API real; o estado é conferido no banco.

const garagemDb = (id: string) =>
  prisma.garagem.findUniqueOrThrow({
    where: { id },
    select: { id: true, capacidade: true, veiculosAlocados: true, status: true },
  });

const veiculoDb = (id: string) =>
  prisma.veiculo.findUniqueOrThrow({
    where: { id },
    select: { id: true, garagemId: true, status: true, idLocador: true },
  });

const alocar = (token: string, garagemId: string, veiculoId: string) =>
  request(app)
    .post(`/api/garagem/${garagemId}/veiculos/${veiculoId}`)
    .set("Authorization", `Bearer ${token}`);

describe("FINAL-H-04 — criação com garagem", () => {
  it("POST /api/veiculo com garagemId persiste vínculo e contador", async () => {
    const locador = await createLocador();
    const garagem = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 3,
    });

    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagem.id,
    });

    expect(veiculo.garagemId).toBe(garagem.id);

    const get = await request(app)
      .get(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`);
    expect(get.body.result.garagemId).toBe(garagem.id);
    expect(get.body.result.garagem.status).toBe("ATIVA");

    expect((await veiculoDb(veiculo.id)).garagemId).toBe(garagem.id);
    expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(1);
  });

  it("veículo criado sem garagem fica com garagemId null", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: null,
    });
    expect((await veiculoDb(veiculo.id)).garagemId).toBeNull();
  });
});

describe("FINAL-H-04 — cross-tenant", () => {
  it("criar veículo apontando para garagem de outro locador = 403", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId, {
      capacidade: 5,
    });
    const placa = uniquePlaca();

    const res = await request(app)
      .post("/api/veiculo")
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({
        idLocador: locadorA.locadorId,
        garagemId: garagemB.id,
        placa,
        marca: "Fiat",
        modelo: "Mobi",
        ano: 2022,
        cambio: "Manual",
        capacidade: 5,
        eletrico: false,
        adaptado: false,
        valorDiaria: 100,
      });

    expect(res.status).toBe(403);
    expect((await garagemDb(garagemB.id)).veiculosAlocados).toBe(0);
    expect(await prisma.veiculo.findUnique({ where: { placa } })).toBeNull();
  });

  it("mover veículo próprio para garagem alheia = 403 (PUT e rota de alocação)", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: null,
    });
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId, {
      capacidade: 5,
    });

    const viaPut = await request(app)
      .put(`/api/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({ garagemId: garagemB.id });
    expect(viaPut.status).toBe(403);

    const viaAlocacao = await alocar(locadorA.token, garagemB.id, veiculoA.id);
    expect(viaAlocacao.status).toBe(403);

    expect((await veiculoDb(veiculoA.id)).garagemId).toBeNull();
    expect((await garagemDb(garagemB.id)).veiculosAlocados).toBe(0);
  });

  it("locador A não move veículo de B para a própria garagem", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const garagemA = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 5,
    });
    const veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId, {
      garagemId: null,
    });

    const viaAlocacao = await alocar(locadorA.token, garagemA.id, veiculoB.id);
    expect(viaAlocacao.status).toBe(403);

    const viaPut = await request(app)
      .put(`/api/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({ garagemId: garagemA.id });
    expect(viaPut.status).toBe(403);

    expect((await veiculoDb(veiculoB.id)).garagemId).toBeNull();
    expect((await garagemDb(garagemA.id)).veiculosAlocados).toBe(0);
  });
});

describe("FINAL-H-04 — capacidade", () => {
  it("sequencial: a segunda alocação em garagem de capacidade 1 é recusada", async () => {
    const locador = await createLocador();
    const garagem = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 1,
    });
    const veiculoA = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: null,
    });
    const veiculoB = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: null,
    });

    const primeira = await alocar(locador.token, garagem.id, veiculoA.id);
    expect(primeira.status).toBe(204);

    const segunda = await alocar(locador.token, garagem.id, veiculoB.id);
    expect(segunda.status).toBe(409);

    expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(1);
    expect((await veiculoDb(veiculoA.id)).garagemId).toBe(garagem.id);
    expect((await veiculoDb(veiculoB.id)).garagemId).toBeNull();
  });

  it("concorrente: exatamente uma alocação vence (12 rodadas)", async () => {
    for (let rodada = 0; rodada < 12; rodada++) {
      const locador = await createLocador();
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        capacidade: 1,
      });
      const veiculoA = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });
      const veiculoB = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });

      const [a, b] = await Promise.all([
        alocar(locador.token, garagem.id, veiculoA.id),
        alocar(locador.token, garagem.id, veiculoB.id),
      ]);

      const sucessos = [a, b].filter((r) => r.status === 204).length;
      expect(sucessos, `rodada ${rodada} status=${a.status}/${b.status}`).toBe(1);

      const garagemFinal = await garagemDb(garagem.id);
      expect(garagemFinal.veiculosAlocados).toBe(1);

      const alocados = await prisma.veiculo.count({
        where: { garagemId: garagem.id },
      });
      expect(alocados).toBe(1);
      expect(garagemFinal.veiculosAlocados).toBeLessThanOrEqual(
        garagemFinal.capacidade,
      );
    }
  });

  it("concorrente via PUT /veiculo (caminho alternativo) respeita a vaga única", async () => {
    for (let rodada = 0; rodada < 6; rodada++) {
      const locador = await createLocador();
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        capacidade: 1,
      });
      const veiculoA = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });
      const veiculoB = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });

      const mover = (id: string) =>
        request(app)
          .put(`/api/veiculo/${id}`)
          .set("Authorization", `Bearer ${locador.token}`)
          .send({ garagemId: garagem.id });

      const [a, b] = await Promise.all([mover(veiculoA.id), mover(veiculoB.id)]);
      const sucessos = [a, b].filter((r) => r.status === 200).length;
      expect(sucessos, `rodada ${rodada} status=${a.status}/${b.status}`).toBe(1);

      const garagemFinal = await garagemDb(garagem.id);
      expect(garagemFinal.veiculosAlocados).toBe(1);
      expect(
        await prisma.veiculo.count({ where: { garagemId: garagem.id } }),
      ).toBe(1);
    }
  });

  it("alocação repetida na mesma garagem é idempotente", async () => {
    const locador = await createLocador();
    const garagem = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 2,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagem.id,
    });

    expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(1);

    const repetida = await alocar(locador.token, garagem.id, veiculo.id);
    expect(repetida.status).toBe(204);
    expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(1);

    const viaPut = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ garagemId: garagem.id });
    expect(viaPut.status).toBe(200);
    expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(1);
  });

  it("reduzir capacidade abaixo dos veículos alocados é recusado", async () => {
    const locador = await createLocador();
    const garagem = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 2,
    });
    await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagem.id,
    });
    await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagem.id,
    });
    expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(2);

    const res = await request(app)
      .put(`/api/garagem/${garagem.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ capacidade: 1 });
    expect(res.status).toBe(409);

    const estado = await garagemDb(garagem.id);
    expect(estado.capacidade).toBe(2);
    expect(estado.veiculosAlocados).toBe(2);
  });

  it("corrida entre alocar e reduzir capacidade nunca viola alocados <= capacidade", async () => {
    for (let rodada = 0; rodada < 10; rodada++) {
      const locador = await createLocador();
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        capacidade: 2,
      });
      await createVeiculo(locador.token, locador.locadorId, {
        garagemId: garagem.id,
      });
      const novo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });

      await Promise.allSettled([
        alocar(locador.token, garagem.id, novo.id),
        request(app)
          .put(`/api/garagem/${garagem.id}`)
          .set("Authorization", `Bearer ${locador.token}`)
          .send({ capacidade: 1 }),
      ]);

      const estado = await garagemDb(garagem.id);
      const alocadosReais = await prisma.veiculo.count({
        where: { garagemId: garagem.id },
      });
      expect(
        estado.veiculosAlocados,
        `rodada ${rodada}: cap=${estado.capacidade} alocados=${estado.veiculosAlocados}`,
      ).toBeLessThanOrEqual(estado.capacidade);
      expect(alocadosReais).toBe(estado.veiculosAlocados);
    }
  });

  it("corrida entre alocar e desativar a garagem mantém estado coerente", async () => {
    for (let rodada = 0; rodada < 8; rodada++) {
      const locador = await createLocador();
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        capacidade: 5,
      });
      const veiculo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });

      const [alocacao] = await Promise.all([
        alocar(locador.token, garagem.id, veiculo.id),
        request(app)
          .put(`/api/garagem/${garagem.id}`)
          .set("Authorization", `Bearer ${locador.token}`)
          .send({ status: "MANUTENCAO" }),
      ]);

      const estado = await garagemDb(garagem.id);
      const alocadosReais = await prisma.veiculo.count({
        where: { garagemId: garagem.id },
      });
      expect(alocadosReais).toBe(estado.veiculosAlocados);
      expect(estado.veiculosAlocados).toBeLessThanOrEqual(estado.capacidade);
      // Se a alocação venceu, o veículo está lá; se perdeu, não está.
      expect(alocadosReais).toBe(alocacao.status === 204 ? 1 : 0);
    }
  });
});

describe("FINAL-H-04 — movimentação", () => {
  it("mover A → B ajusta os dois contadores", async () => {
    const locador = await createLocador();
    const garagemA = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 2,
    });
    const garagemB = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 2,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemA.id,
    });

    const res = await alocar(locador.token, garagemB.id, veiculo.id);
    expect(res.status).toBe(204);

    expect((await veiculoDb(veiculo.id)).garagemId).toBe(garagemB.id);
    expect((await garagemDb(garagemA.id)).veiculosAlocados).toBe(0);
    expect((await garagemDb(garagemB.id)).veiculosAlocados).toBe(1);
  });

  it("mover para garagem cheia falha e preserva os dois contadores", async () => {
    const locador = await createLocador();
    const garagemA = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 2,
    });
    const garagemB = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 1,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemA.id,
    });
    await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemB.id,
    });

    const res = await alocar(locador.token, garagemB.id, veiculo.id);
    expect(res.status).toBe(409);

    expect((await veiculoDb(veiculo.id)).garagemId).toBe(garagemA.id);
    expect((await garagemDb(garagemA.id)).veiculosAlocados).toBe(1);
    expect((await garagemDb(garagemB.id)).veiculosAlocados).toBe(1);
  });

  it("CROSS-04: PUT com modelo + placa + garagem cheia falha por inteiro", async () => {
    const locador = await createLocador();
    const garagemA = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 2,
    });
    const garagemCheia = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 1,
    });
    await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemCheia.id,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemA.id,
      marca: "Chevrolet",
      modelo: "Onix",
      ano: 2020,
    });

    const antesVeiculo = await prisma.veiculo.findUniqueOrThrow({
      where: { id: veiculo.id },
      include: { modeloVeiculo: true },
    });

    const res = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({
        placa: uniquePlaca(),
        garagemId: garagemCheia.id,
        modelo: { valorDiaria: 4321, capacidade: 2 },
      });
    expect(res.status).toBe(409);

    const depoisVeiculo = await prisma.veiculo.findUniqueOrThrow({
      where: { id: veiculo.id },
      include: { modeloVeiculo: true },
    });
    expect(depoisVeiculo.placa).toBe(antesVeiculo.placa);
    expect(depoisVeiculo.garagemId).toBe(garagemA.id);
    expect(Number(depoisVeiculo.modeloVeiculo.valorDiaria)).toBeCloseTo(
      Number(antesVeiculo.modeloVeiculo.valorDiaria),
      2,
    );
    expect(depoisVeiculo.modeloVeiculo.capacidade).toBe(
      antesVeiculo.modeloVeiculo.capacidade,
    );
    expect((await garagemDb(garagemA.id)).veiculosAlocados).toBe(1);
    expect((await garagemDb(garagemCheia.id)).veiculosAlocados).toBe(1);
  });
});

describe("FINAL-H-04 — status da garagem", () => {
  it("nova alocação só em garagem ATIVA (MANUTENCAO e INATIVA recusam)", async () => {
    const locador = await createLocador();

    for (const status of ["MANUTENCAO", "INATIVA"]) {
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        capacidade: 5,
        status,
      });
      const veiculo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: null,
      });

      const viaAlocacao = await alocar(locador.token, garagem.id, veiculo.id);
      expect(viaAlocacao.status, status).toBe(409);

      const viaPut = await request(app)
        .put(`/api/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ garagemId: garagem.id });
      expect(viaPut.status, status).toBe(409);

      const viaCriacao = await request(app)
        .post("/api/veiculo")
        .set("Authorization", `Bearer ${locador.token}`)
        .send({
          idLocador: locador.locadorId,
          garagemId: garagem.id,
          placa: uniquePlaca(),
          marca: "Fiat",
          modelo: "Mobi",
          ano: 2022,
          cambio: "Manual",
          capacidade: 5,
          eletrico: false,
          adaptado: false,
          valorDiaria: 100,
        });
      expect(viaCriacao.status, status).toBe(409);

      expect((await garagemDb(garagem.id)).veiculosAlocados).toBe(0);
      expect((await veiculoDb(veiculo.id)).garagemId).toBeNull();
    }
  });
});

describe("FINAL-H-04 — catálogo reservável", () => {
  it("só aparece veículo DISPONIVEL em garagem ATIVA", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();

    const semGaragem = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: null,
    });

    const garagemManutencao = await createGaragem(
      locador.token,
      locador.locadorId,
      { capacidade: 5 },
    );
    const emManutencao = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemManutencao.id,
    });
    await request(app)
      .put(`/api/garagem/${garagemManutencao.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ status: "MANUTENCAO" });

    const garagemInativa = await createGaragem(
      locador.token,
      locador.locadorId,
      { capacidade: 5 },
    );
    const emInativa = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemInativa.id,
    });
    await request(app)
      .delete(`/api/garagem/${garagemInativa.id}`)
      .set("Authorization", `Bearer ${locador.token}`);

    const garagemAtiva = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 5,
    });
    const reservavel = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemAtiva.id,
    });

    const catalogo = await request(app)
      .get("/api/veiculo?limit=100")
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(catalogo.status).toBe(200);

    const ids = catalogo.body.result.map((v: any) => v.id);
    expect(ids).toContain(reservavel.id);
    expect(ids).not.toContain(semGaragem.id);
    expect(ids).not.toContain(emManutencao.id);
    expect(ids).not.toContain(emInativa.id);
  });
});

describe("FINAL-H-04 — reserva exige ponto operacional", () => {
  const reservar = (token: string, corpo: Record<string, unknown>) =>
    request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${token}`)
      .send(corpo);

  it("veículo sem garagem, em MANUTENCAO ou INATIVA não gera reserva", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();

    const semGaragem = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: null,
    });
    const semRes = await reservar(locatario.token, {
      idVeiculo: semGaragem.id,
      idLocatario: locatario.locatarioId,
      ...futurePeriod(),
    });
    expect(semRes.status).toBe(409);

    for (const status of ["MANUTENCAO", "INATIVA"]) {
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        capacidade: 5,
      });
      const veiculo = await createVeiculo(locador.token, locador.locadorId, {
        garagemId: garagem.id,
      });
      await request(app)
        .put(`/api/garagem/${garagem.id}`)
        .set("Authorization", `Bearer ${locador.token}`)
        .send({ status });

      const res = await reservar(locatario.token, {
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(),
      });
      expect(res.status, status).toBe(409);
    }

    expect(
      await prisma.reserva.count({
        where: { idLocatario: locatario.locatarioId },
      }),
    ).toBe(0);
  });

  it("garagem ATIVA gera reserva com idGaragemRetirada persistido", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const garagem = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 5,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagem.id,
    });

    const res = await reservar(locatario.token, {
      idVeiculo: veiculo.id,
      idLocatario: locatario.locatarioId,
      ...futurePeriod(),
    });
    expect(res.status).toBe(201);

    const reserva = await prisma.reserva.findUniqueOrThrow({
      where: { id: res.body.result.id },
    });
    expect(reserva.idGaragemRetirada).toBe(garagem.id);
    // Contrato atual: devolução é opcional e fica nula quando não informada.
    expect(reserva.idGaragemDevolucao).toBeNull();
  });

  it("retirada informada divergente da garagem atual é recusada", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const garagemReal = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 5,
    });
    const outraGaragem = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 5,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemReal.id,
    });

    const res = await reservar(locatario.token, {
      idVeiculo: veiculo.id,
      idLocatario: locatario.locatarioId,
      idGaragemRetirada: outraGaragem.id,
      ...futurePeriod(),
    });
    expect(res.status).toBe(400);
  });

  it("devolução em garagem de outro locador é recusada", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const locatario = await createLocatario();
    const garagemA = await createGaragem(locadorA.token, locadorA.locadorId, {
      capacidade: 5,
    });
    const garagemB = await createGaragem(locadorB.token, locadorB.locadorId, {
      capacidade: 5,
    });
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId, {
      garagemId: garagemA.id,
    });

    const res = await reservar(locatario.token, {
      idVeiculo: veiculo.id,
      idLocatario: locatario.locatarioId,
      idGaragemDevolucao: garagemB.id,
      ...futurePeriod(),
    });
    expect(res.status).toBe(400);
    expect(
      await prisma.reserva.count({ where: { idVeiculo: veiculo.id } }),
    ).toBe(0);
  });

  it("CROSS-03: reserva pendente fixa a garagem e movimento não reescreve snapshots", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const garagemA = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 5,
    });
    const garagemB = await createGaragem(locador.token, locador.locadorId, {
      capacidade: 5,
    });
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      garagemId: garagemA.id,
    });

    const primeira = await reservar(locatario.token, {
      idVeiculo: veiculo.id,
      idLocatario: locatario.locatarioId,
      ...futurePeriod(1, 2),
    });
    expect(primeira.status).toBe(201);

    const mover = await alocar(locador.token, garagemB.id, veiculo.id);
    expect(mover.status).toBe(409);
    expect(mover.body).toMatchObject({ code: "VEHICLE_HAS_ACTIVE_RESERVATION" });

    const reservaAntiga = await prisma.reserva.findUniqueOrThrow({
      where: { id: primeira.body.result.id },
    });
    expect(reservaAntiga.idGaragemRetirada).toBe(garagemA.id);

    const segunda = await reservar(locatario.token, {
      idVeiculo: veiculo.id,
      idLocatario: locatario.locatarioId,
      ...futurePeriod(20, 2),
    });
    expect(segunda.status).toBe(201);
    const reservaNova = await prisma.reserva.findUniqueOrThrow({
      where: { id: segunda.body.result.id },
    });
    expect(reservaNova.idGaragemRetirada).toBe(garagemA.id);
  });
});
