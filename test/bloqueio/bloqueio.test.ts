import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createAccount,
  createBloqueio,
  createLocador,
  createLocatario,
  createVeiculo,
  futurePeriod,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Tenta criar uma reserva e retorna a resposta crua (sem desempacotar).
async function tentarReserva(
  token: string,
  idVeiculo: string,
  idLocatario: string,
  overrides: Record<string, unknown> = {},
) {
  return request(app)
    .post("/api/reserva")
    .set("Authorization", `Bearer ${token}`)
    .send({
      idVeiculo,
      idLocatario,
      valorTotal: 200,
      ...futurePeriod(),
      ...overrides,
    });
}

describe("Bloqueio de locatário — gestão administrativa", () => {
  let admin: Account;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    admin = await createAccount("ADMIN");
    locatario = await createLocatario();
  });

  it("ADMIN cria um bloqueio com motivo e descrição", async () => {
    const response = await request(app)
      .post("/api/admin/bloqueio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        idLocatario: locatario.locatarioId,
        motivo: "INADIMPLENCIA",
        descricao: "Fatura em atraso",
      });

    expect(response.status).toBe(201);
    expect(response.body.result).toHaveProperty("id");
    expect(response.body.result.idLocatario).toBe(locatario.locatarioId);
    expect(response.body.result.motivo).toBe("INADIMPLENCIA");
    expect(response.body.result.ativo).toBe(true);
    expect(response.body.result.revogadoEm).toBeNull();
    expect(response.body.result.criadoPor).toBe(admin.conta.id);
  });

  it("recusa criação de bloqueio por usuário não-admin", async () => {
    const response = await request(app)
      .post("/api/admin/bloqueio")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ idLocatario: locatario.locatarioId, motivo: "FRAUDE" });

    expect(response.status).toBe(403);
  });

  it("recusa criação de bloqueio para locatário inexistente", async () => {
    const response = await request(app)
      .post("/api/admin/bloqueio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        idLocatario: "00000000-0000-0000-0000-000000000000",
        motivo: "OUTRO",
      });

    expect(response.status).toBe(404);
  });

  it("recusa motivo inválido", async () => {
    const response = await request(app)
      .post("/api/admin/bloqueio")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ idLocatario: locatario.locatarioId, motivo: "NAO_EXISTE" });

    expect(response.status).toBe(400);
  });
});

describe("Bloqueio de locatário — impacto na reserva", () => {
  let admin: Account;
  let locador: LocadorContext;
  let elegivel: LocatarioContext;
  let bloqueado: LocatarioContext;
  let veiculoId: string;

  beforeAll(async () => {
    admin = await createAccount("ADMIN");
    locador = await createLocador();
    elegivel = await createLocatario();
    bloqueado = await createLocatario();
    const veiculo = await createVeiculo(locador.locadorId);
    veiculoId = veiculo.id;
  });

  it("locatário sem bloqueio consegue criar reserva (regressão)", async () => {
    const response = await tentarReserva(
      elegivel.token,
      veiculoId,
      elegivel.locatarioId,
      futurePeriod(1, 1),
    );

    expect(response.status).toBe(201);
  });

  it("locatário com bloqueio ativo NÃO consegue criar reserva", async () => {
    await createBloqueio(admin.token, bloqueado.locatarioId);

    const response = await tentarReserva(
      bloqueado.token,
      veiculoId,
      bloqueado.locatarioId,
      futurePeriod(10, 1),
    );

    expect(response.status).toBe(403);
  });

  it("retorna o erro de negócio correto (pendências financeiras)", async () => {
    const response = await tentarReserva(
      bloqueado.token,
      veiculoId,
      bloqueado.locatarioId,
      futurePeriod(20, 1),
    );

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/pend[êe]ncias financeiras/i);
  });

  it("não impede a reserva de outro locatário elegível", async () => {
    const response = await tentarReserva(
      elegivel.token,
      veiculoId,
      elegivel.locatarioId,
      futurePeriod(30, 1),
    );

    expect(response.status).toBe(201);
  });

  it("bloqueio expirado não impede a reserva", async () => {
    const locatario = await createLocatario();
    const bloqueio = await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "MULTA",
      expiraEm: futurePeriod(2, 1).dataHoraInicio,
    });

    // Move a expiração para o passado -> bloqueio deixa de ser impeditivo.
    await prisma.bloqueioLocatario.update({
      where: { id: bloqueio.id },
      data: { expiraEm: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const response = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(40, 1),
    );

    expect(response.status).toBe(201);
  });

  it("bloqueio revogado não impede a reserva", async () => {
    const locatario = await createLocatario();
    const bloqueio = await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "FRAUDE",
    });

    // Antes de revogar: bloqueado.
    const bloqueada = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(50, 1),
    );
    expect(bloqueada.status).toBe(403);

    const revogacao = await request(app)
      .post(`/api/admin/bloqueio/${bloqueio.id}/revogar`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(revogacao.status).toBe(200);
    expect(revogacao.body.result.ativo).toBe(false);
    expect(revogacao.body.result.revogadoEm).not.toBeNull();

    // Depois de revogar: liberado.
    const liberada = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(60, 1),
    );
    expect(liberada.status).toBe(201);
  });

  it("múltiplos bloqueios: só libera quando todos são revogados", async () => {
    const locatario = await createLocatario();
    const b1 = await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "INADIMPLENCIA",
    });
    const b2 = await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "DOCUMENTACAO",
    });

    // Dois ativos -> bloqueado.
    let response = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(70, 1),
    );
    expect(response.status).toBe(403);

    // Revoga um -> ainda bloqueado pelo outro.
    await request(app)
      .post(`/api/admin/bloqueio/${b1.id}/revogar`)
      .set("Authorization", `Bearer ${admin.token}`);

    response = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(80, 1),
    );
    expect(response.status).toBe(403);

    // Revoga o segundo -> liberado.
    await request(app)
      .post(`/api/admin/bloqueio/${b2.id}/revogar`)
      .set("Authorization", `Bearer ${admin.token}`);

    response = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(90, 1),
    );
    expect(response.status).toBe(201);
  });

  it("confirmar reserva exige locatário liberado", async () => {
    const locatario = await createLocatario();

    // Cria a reserva enquanto liberado.
    const criada = await tentarReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(100, 1),
    );
    expect(criada.status).toBe(201);

    // Bloqueia depois.
    await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "ADMINISTRATIVO",
    });

    const response = await request(app)
      .put(`/api/reserva/${criada.body.result.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ status: "CONFIRMADA" });

    expect(response.status).toBe(403);
  });
});

describe("Bloqueio de locatário — consulta de ativos e histórico", () => {
  let admin: Account;
  let locatario: LocatarioContext;
  let bloqueioRevogadoId: string;

  beforeAll(async () => {
    admin = await createAccount("ADMIN");
    locatario = await createLocatario();

    // Um ativo + um revogado (preserva histórico).
    await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "INADIMPLENCIA",
    });
    const revogar = await createBloqueio(admin.token, locatario.locatarioId, {
      motivo: "MULTA",
    });
    bloqueioRevogadoId = revogar.id;

    await request(app)
      .post(`/api/admin/bloqueio/${bloqueioRevogadoId}/revogar`)
      .set("Authorization", `Bearer ${admin.token}`);
  });

  it("lista apenas os bloqueios ativos com ?ativos=true", async () => {
    const response = await request(app)
      .get(`/api/admin/bloqueio/locatario/${locatario.locatarioId}?ativos=true`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.result)).toBe(true);
    expect(response.body.result.length).toBe(1);
    expect(response.body.result[0].motivo).toBe("INADIMPLENCIA");
    expect(response.body.result[0].ativo).toBe(true);
  });

  it("histórico preserva os bloqueios revogados", async () => {
    const response = await request(app)
      .get(`/api/admin/bloqueio/locatario/${locatario.locatarioId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.length).toBe(2);
    expect(response.body.pagination.total).toBe(2);

    const revogado = response.body.result.find(
      (b: any) => b.id === bloqueioRevogadoId,
    );
    expect(revogado).toBeDefined();
    expect(revogado.ativo).toBe(false);
    expect(revogado.revogadoEm).not.toBeNull();
  });

  it("recusa consulta de histórico por usuário não-admin", async () => {
    const response = await request(app)
      .get(`/api/admin/bloqueio/locatario/${locatario.locatarioId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(403);
  });

  it("revogar um bloqueio já revogado retorna conflito", async () => {
    const response = await request(app)
      .post(`/api/admin/bloqueio/${bloqueioRevogadoId}/revogar`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(409);
  });
});
