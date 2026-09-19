import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createVeiculo,
  createReserva,
  uniqueCnh,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("Condutores adicionais (RF12)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outro: LocatarioContext;
  let veiculoId: string;
  let reservaId: string;
  const cnh = uniqueCnh();

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outro = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
    );
    reservaId = reserva.id;
  });

  it("deve adicionar um condutor adicional à reserva", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "João Condutor", cnh });

    expect(response.status).toBe(201);
    expect(response.body.result).toHaveProperty("id");
    expect(response.body.result.nome).toBe("João Condutor");
    expect(response.body.result.cnh).toBe(cnh);
  });

  it("deve listar os condutores da reserva", async () => {
    const response = await request(app)
      .get(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
    expect(response.body.result.length).toBe(1);
    expect(response.body.result[0].cnh).toBe(cnh);
  });

  it("deve recusar condutor duplicado (mesma CNH)", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "Duplicado", cnh });

    expect(response.status).toBe(409);
  });

  it("deve recusar CNH inválida (400)", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "CNH Ruim", cnh: "123" });

    expect(response.status).toBe(400);
  });

  it("deve recusar CPF inválido (400)", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "CPF Ruim", cpf: "11111111111", cnh: uniqueCnh() });

    expect(response.status).toBe(400);
  });

  it("deve recusar gestão de condutores por outro locatário (403)", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(outro.token))
      .send({ nome: "Intruso", cnh: uniqueCnh() });

    expect(response.status).toBe(403);
  });

  it("deve recusar sem autenticação (401)", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .send({ nome: "Sem token", cnh: uniqueCnh() });

    expect(response.status).toBe(401);
  });

  it("deve remover um condutor adicional", async () => {
    const criar = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "Removível", cnh: uniqueCnh() });

    const del = await request(app)
      .delete(`/api/reserva/${reservaId}/condutores/${criar.body.result.id}`)
      .set(auth(locatario.token));

    expect(del.status).toBe(204);

    const lista = await request(app)
      .get(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token));
    expect(lista.body.result.some((c: any) => c.id === criar.body.result.id)).toBe(
      false,
    );
  });

  it("deve impedir alterações após o início da reserva (409)", async () => {
    // Backdate: início no passado -> reserva já iniciada.
    await prisma.reserva.update({
      where: { id: reservaId },
      data: {
        dataHoraInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dataHoraFim: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const add = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "Tardio", cnh: uniqueCnh() });
    expect(add.status).toBe(409);

    // Remoção também bloqueada após o início.
    const condutor = await prisma.condutorAdicional.findFirst({
      where: { idReserva: reservaId },
    });
    const del = await request(app)
      .delete(`/api/reserva/${reservaId}/condutores/${condutor!.id}`)
      .set(auth(locatario.token));
    expect(del.status).toBe(409);
  });
});

describe("Condutores adicionais — limite de 3 (RN02)", () => {
  let locatario: LocatarioContext;
  let reservaId: string;

  const addCondutor = (nome: string) =>
    request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome, cnh: uniqueCnh() });

  beforeAll(async () => {
    const locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
    );
    reservaId = reserva.id;
  });

  it("aceita exatamente 3 condutores adicionais", async () => {
    expect((await addCondutor("Condutor 1")).status).toBe(201);
    expect((await addCondutor("Condutor 2")).status).toBe(201);
    expect((await addCondutor("Condutor 3")).status).toBe(201);
  });

  it("recusa o 4º condutor adicional (409)", async () => {
    const response = await addCondutor("Condutor 4");
    expect(response.status).toBe(409);
  });

  it("permite adicionar novo condutor após remover um (contagem reflete remoções)", async () => {
    const primeiro = await prisma.condutorAdicional.findFirst({
      where: { idReserva: reservaId },
      orderBy: { criadoEm: "asc" },
    });
    const del = await request(app)
      .delete(`/api/reserva/${reservaId}/condutores/${primeiro!.id}`)
      .set(auth(locatario.token));
    expect(del.status).toBe(204);

    const response = await addCondutor("Condutor 5");
    expect(response.status).toBe(201);
  });
});

describe("Condutores adicionais — concorrência RN02", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  const addCondutor = (reservaId: string, nome: string, cnh = uniqueCnh()) =>
    request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set(auth(locatario.token))
      .send({ nome, cnh });

  async function criarReservaComDoisCondutores() {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
    );

    expect((await addCondutor(reserva.id, "Condutor base 1")).status).toBe(201);
    expect((await addCondutor(reserva.id, "Condutor base 2")).status).toBe(201);

    return reserva.id;
  }

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  it("serializa inclusões concorrentes e mantém exatamente três condutores", async () => {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const reservaId = await criarReservaComDoisCondutores();

      const [primeira, segunda] = await Promise.all([
        addCondutor(reservaId, `Concorrente A ${tentativa}`),
        addCondutor(reservaId, `Concorrente B ${tentativa}`),
      ]);

      expect([primeira.status, segunda.status].sort()).toEqual([201, 409]);

      const condutores = await prisma.condutorAdicional.findMany({
        where: { idReserva: reservaId },
      });
      expect(condutores).toHaveLength(3);
    }
  });

  it("aceita no máximo uma inclusão concorrente da mesma CNH", async () => {
    const reservaId = await criarReservaComDoisCondutores();
    const cnh = uniqueCnh();

    const [primeira, segunda] = await Promise.all([
      addCondutor(reservaId, "Mesma CNH A", cnh),
      addCondutor(reservaId, "Mesma CNH B", cnh),
    ]);

    expect([primeira.status, segunda.status].sort()).toEqual([201, 409]);

    const condutores = await prisma.condutorAdicional.findMany({
      where: { idReserva: reservaId },
    });
    expect(condutores).toHaveLength(3);
    expect(condutores.filter((condutor) => condutor.cnh === cnh)).toHaveLength(1);
  });

  it("não bloqueia inclusões de reservas diferentes", async () => {
    const primeiraReserva = await criarReservaComDoisCondutores();
    const segundaReserva = await criarReservaComDoisCondutores();

    const [primeira, segunda] = await Promise.all([
      addCondutor(primeiraReserva, "Reserva independente A"),
      addCondutor(segundaReserva, "Reserva independente B"),
    ]);

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(201);
  });

  it("recusa reserva inexistente sem criar condutor", async () => {
    const response = await addCondutor(
      "00000000-0000-4000-8000-000000000007",
      "Reserva inexistente",
    );

    expect(response.status).toBe(404);
  });

  it("recusa inclusão em reserva cancelada", async () => {
    const reservaId = await criarReservaComDoisCondutores();
    await prisma.reserva.update({
      where: { id: reservaId },
      data: { status: "CANCELADA" },
    });

    const response = await addCondutor(reservaId, "Reserva cancelada");

    expect(response.status).toBe(409);
  });
});
