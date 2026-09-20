import request from "supertest";
import { StatusReserva } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function cenário() {
  const locador = await createLocador();
  const locatarioA = await createLocatario();
  const locatarioB = await createLocatario();
  const retirada = await createGaragem(locador.token, locador.locadorId, {
    nome: "Garagem de retirada pública",
    endereco: "Rua da Viagem, 10",
  });
  const devolucao = await createGaragem(locador.token, locador.locadorId, {
    nome: "Garagem de devolução pública",
    endereco: "Rua da Viagem, 20",
  });
  const veiculo = await createVeiculo(locador.token, locador.locadorId, {
    marca: "MOVA",
    modelo: "Tour",
  });
  await prisma.veiculo.update({
    where: { id: veiculo.id },
    data: { garagemId: retirada.id },
  });
  const reserva = await createReserva(
    locatarioA.token,
    veiculo.id,
    locatarioA.locatarioId,
    { idGaragemRetirada: retirada.id, idGaragemDevolucao: devolucao.id },
  );
  const reservaDeB = await createReserva(
    locatarioB.token,
    (await createVeiculo(locador.token, locador.locadorId)).id,
    locatarioB.locatarioId,
  );
  return { locador, locatarioA, locatarioB, retirada, devolucao, veiculo, reserva, reservaDeB };
}

describe("RF13-B — compartilhamento da reserva", () => {
  it("exige JWT e ownership de Locatário para criar o link", async () => {
    const { locador, locatarioA, reserva, reservaDeB } = await cenário();

    expect((await request(app).post(`/api/reserva/${reserva.id}/compartilhamento`)).status).toBe(401);
    expect((await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locador.token))).status).toBe(403);
    expect((await request(app)
      .post(`/api/reserva/${reservaDeB.id}/compartilhamento`)
      .set(auth(locatarioA.token))).status).toBe(403);
  });

  it("persiste token aleatório e torna chamadas repetidas idempotentes", async () => {
    const { locatarioA, reserva } = await cenário();

    const primeira = await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token));
    const segunda = await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token));

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(primeira.body.result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(primeira.body.result.token).not.toBe(reserva.id);
    expect(segunda.body.result.token).toBe(primeira.body.result.token);
    expect(await prisma.compartilhamentoReserva.count({ where: { idReserva: reserva.id } })).toBe(1);
    expect((await prisma.compartilhamentoReserva.findUnique({ where: { idReserva: reserva.id } }))?.token)
      .toBe(primeira.body.result.token);
  });

  it("não cria múltiplos compartilhamentos em criação concorrente", async () => {
    const { locatarioA, reserva } = await cenário();

    const respostas = await Promise.all([
      request(app).post(`/api/reserva/${reserva.id}/compartilhamento`).set(auth(locatarioA.token)),
      request(app).post(`/api/reserva/${reserva.id}/compartilhamento`).set(auth(locatarioA.token)),
    ]);

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 201]);
    expect(respostas[0].body.result.token).toBe(respostas[1].body.result.token);
    expect(await prisma.compartilhamentoReserva.count({ where: { idReserva: reserva.id } })).toBe(1);
  });

  it.each([
    StatusReserva.AGUARDANDO_PAGAMENTO,
    StatusReserva.CONFIRMADA,
    StatusReserva.EM_ANDAMENTO,
    StatusReserva.REALIZADA,
    StatusReserva.CANCELADA,
  ])("resolve somente dados públicos no status %s", async (status) => {
    const { locatarioA, reserva, retirada, devolucao } = await cenário();
    await prisma.reserva.update({ where: { id: reserva.id }, data: { status } });
    const criado = await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token));

    const público = await request(app).get(`/api/compartilhamento/${criado.body.result.token}`);

    expect(público.status).toBe(200);
    expect(público.body.result).toMatchObject({
      viagem: {
        status,
        dataHoraInicio: new Date(reserva.dataHoraInicio).toISOString(),
        dataHoraFim: new Date(reserva.dataHoraFim).toISOString(),
      },
      veiculo: { marca: "MOVA", modelo: "Tour" },
      retirada: { nome: retirada.nome, endereco: retirada.endereco },
      devolucao: { nome: devolucao.nome, endereco: devolucao.endereco },
    });
    const serializado = JSON.stringify(público.body.result).toLowerCase();
    for (const proibido of [
      "idlocatario", "cpf", "rg", "cnh", "email", "telefone", "valortotal",
      "statuspagamento", "cobranca", "latitude", "longitude", "codigo desbloqueio",
      "codigodesbloqueio", "jwt", "senha",
    ]) {
      expect(serializado).not.toContain(proibido);
    }
    expect(público.body.result.id).toBeUndefined();
  });

  it("não exige autenticação para resolver e retorna 404 uniforme para token inválido", async () => {
    const { locatarioA, reserva } = await cenário();
    const criado = await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token));

    expect((await request(app).get(`/api/compartilhamento/${criado.body.result.token}`)).status).toBe(200);
    expect((await request(app).get("/api/compartilhamento/token-inexistente")).status).toBe(404);
  });

  it("revoga token e permite novo token persistente", async () => {
    const { locatarioA, locatarioB, reserva } = await cenário();
    const criado = await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token));
    const tokenAntigo = criado.body.result.token;

    expect((await request(app)
      .delete(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioB.token))).status).toBe(403);

    expect((await request(app)
      .delete(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token))).status).toBe(204);
    expect((await request(app).get(`/api/compartilhamento/${tokenAntigo}`)).status).toBe(404);

    const novo = await request(app)
      .post(`/api/reserva/${reserva.id}/compartilhamento`)
      .set(auth(locatarioA.token));
    expect(novo.status).toBe(201);
    expect(novo.body.result.token).not.toBe(tokenAntigo);
    expect((await request(app).get(`/api/compartilhamento/${novo.body.result.token}`)).status).toBe(200);
  });
});
