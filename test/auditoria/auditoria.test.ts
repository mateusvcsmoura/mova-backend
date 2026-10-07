import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { PrismaVeiculoRepository } from "../../src/repositories/prisma/prisma.veiculo.repository";
import {
  createAdminAccount,
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const registros = (idEntidade: string) =>
  prisma.registroAuditoria.findMany({ where: { idEntidade }, orderBy: { criadoEm: "asc" } });

// Campos que nunca podem aparecer num snapshot de auditoria.
const PROIBIDOS = /"(senha\w*|\w*hash|\w*token|cpf|cnh|rg|email|telefone|endereco|cartao|cvv|codigoDesbloqueio|idLocatario)"/i;
const semDadosSensiveis = (valor: unknown) => expect(JSON.stringify(valor ?? {})).not.toMatch(PROIBIDOS);

describe("RN09 — auditoria de veículos", () => {
  let locador: LocadorContext;
  let outro: LocadorContext;

  beforeAll(async () => {
    locador = await createLocador();
    outro = await createLocador();
  });

  it("criação registra ator do JWT, entidade, id, ação, data e estado criado", async () => {
    const antes = new Date(Date.now() - 1000);
    const veiculo = await createVeiculo(locador.token, locador.locadorId, { status: "DISPONIVEL" });

    const [registro] = await registros(veiculo.id);
    expect(registro).toMatchObject({
      idAtor: locador.conta.id,
      cargoAtor: "LOCADOR",
      idLocador: locador.locadorId,
      entidade: "VEICULO",
      idEntidade: veiculo.id,
      acao: "CRIACAO",
      antes: null,
    });
    expect(registro.criadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    expect(registro.depois).toMatchObject({ placa: veiculo.placa, status: "DISPONIVEL", marca: "Fiat" });
    semDadosSensiveis(registro.depois);
  });

  it("edição registra só os campos alterados (antes/depois)", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const res = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locador.token))
      .send({ modelo: { valorDiaria: 199.9, capacidade: 7 } });
    expect(res.status).toBe(200);

    const ultimo = (await registros(veiculo.id)).at(-1)!;
    expect(ultimo.acao).toBe("ALTERACAO");
    expect(ultimo.antes).toEqual({ capacidade: 5, valorDiaria: 125.25 });
    expect(ultimo.depois).toEqual({ capacidade: 7, valorDiaria: 199.9 });
  });

  it("mudança de status vira ALTERACAO_STATUS e exclusão vira EXCLUSAO", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    await request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(locador.token)).send({ status: "MANUTENCAO" });
    await request(app).delete(`/api/veiculo/${veiculo.id}`).set(auth(locador.token));

    const acoes = (await registros(veiculo.id)).map((r) => [r.acao, r.antes, r.depois]);
    expect(acoes).toEqual([
      ["CRIACAO", null, expect.any(Object)],
      ["ALTERACAO_STATUS", { status: "DISPONIVEL" }, { status: "MANUTENCAO" }],
      ["EXCLUSAO", { status: "MANUTENCAO" }, { status: "INATIVO" }],
    ]);
  });

  it("mudança de garagem (PUT e alocação) vira MUDANCA_GARAGEM", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const nova = await createGaragem(locador.token, locador.locadorId);
    const outra = await createGaragem(locador.token, locador.locadorId);

    expect((await request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(locador.token)).send({ garagemId: nova.id })).status).toBe(200);
    expect((await request(app).post(`/api/garagem/${outra.id}/veiculos/${veiculo.id}`).set(auth(locador.token)).send({})).status).toBeLessThan(300);

    const garagem = (await registros(veiculo.id)).filter((r) => r.acao === "MUDANCA_GARAGEM");
    expect(garagem).toHaveLength(2);
    expect(garagem[0].antes).toEqual({ garagemId: veiculo.garagemId });
    expect(garagem[0].depois).toEqual({ garagemId: nova.id });
    expect(garagem[1].depois).toEqual({ garagemId: outra.id });
  });

  it("ADMIN é registrado como ADMIN, não como o locador dono", async () => {
    const admin = await createAdminAccount();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    await request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(admin.token)).send({ status: "MANUTENCAO" });

    const ultimo = (await registros(veiculo.id)).at(-1)!;
    expect(ultimo).toMatchObject({ idAtor: admin.conta.id, cargoAtor: "ADMIN", idLocador: locador.locadorId });
  });

  it("autoria vem do JWT: outro locador não altera nem gera registro em nome do dono", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const res = await request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(outro.token)).send({ status: "MANUTENCAO" });
    expect(res.status).toBe(403);
    // Tentar "assinar" pelo dono via body é recusado pelo schema estrito.
    const forjado = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(outro.token))
      .send({ status: "MANUTENCAO", idLocador: locador.locadorId });
    expect(forjado.status).toBe(400);
    expect((await registros(veiculo.id)).map((r) => r.acao)).toEqual(["CRIACAO"]);
  });

  it("rollback: se a alteração falha, nenhum registro de auditoria persiste", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const outroVeiculo = await createVeiculo(locador.token, locador.locadorId);
    // Placa duplicada estoura o @unique dentro da transação, depois do snapshot.
    const res = await request(app).put(`/api/veiculo/${veiculo.id}`).set(auth(locador.token)).send({ placa: outroVeiculo.placa });
    expect(res.status).toBe(409);
    expect((await registros(veiculo.id)).map((r) => r.acao)).toEqual(["CRIACAO"]);
  });

  it("falha na gravação da auditoria desfaz a alteração do veículo", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    // Ator com id inválido faz o INSERT da auditoria falhar dentro da transação.
    await expect(
      new PrismaVeiculoRepository().update(veiculo.id, { status: "MANUTENCAO" } as never, { id: "nao-e-uuid", cargo: "LOCADOR" } as never),
    ).rejects.toThrow();
    const atual = await prisma.veiculo.findUniqueOrThrow({ where: { id: veiculo.id } });
    expect(atual.status).toBe("DISPONIVEL");
  });
});

describe("RN09 — auditoria de reservas e consulta", () => {
  let locador: LocadorContext;
  let outro: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    outro = await createLocador();
    locatario = await createLocatario();
  });

  it("cancelamento pelo locador é auditado sem dados do locatário", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId);
    const res = await request(app).post(`/api/reserva/${reserva.id}/cancelar`).set(auth(locador.token));
    expect(res.status).toBe(200);

    const [registro] = await registros(reserva.id);
    expect(registro).toMatchObject({
      idAtor: locador.conta.id,
      cargoAtor: "LOCADOR",
      idLocador: locador.locadorId,
      entidade: "RESERVA",
      acao: "CANCELAMENTO",
      antes: { status: "AGUARDANDO_PAGAMENTO" },
      depois: { status: "CANCELADA" },
    });
    semDadosSensiveis([registro.antes, registro.depois]);
    expect(JSON.stringify(registro)).not.toContain(locatario.locatarioId);
  });

  it("alteração da reserva pelo locador é auditada; a do próprio locatário não gera trilha de locador", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const garagem = await createGaragem(locador.token, locador.locadorId);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId);

    await request(app).put(`/api/reserva/${reserva.id}`).set(auth(locatario.token)).send({ metodoPagamento: "PIX" });
    expect(await registros(reserva.id)).toHaveLength(0);

    const res = await request(app).put(`/api/reserva/${reserva.id}`).set(auth(locador.token)).send({ idGaragemDevolucao: garagem.id });
    expect(res.status).toBe(200);
    const [registro] = await registros(reserva.id);
    expect(registro).toMatchObject({ acao: "ALTERACAO", depois: { idGaragemDevolucao: garagem.id } });
  });

  it("GET /api/auditoria: locador vê só os próprios registros; locatário é recusado", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const proprio = await request(app).get(`/api/auditoria?entidade=VEICULO&idEntidade=${veiculo.id}`).set(auth(locador.token));
    expect(proprio.status).toBe(200);
    expect(proprio.body.result).toHaveLength(1);
    expect(proprio.body.result[0]).toMatchObject({ acao: "CRIACAO", idEntidade: veiculo.id });

    const alheio = await request(app).get(`/api/auditoria?idEntidade=${veiculo.id}`).set(auth(outro.token));
    expect(alheio.status).toBe(200);
    expect(alheio.body.result).toHaveLength(0);

    expect((await request(app).get("/api/auditoria").set(auth(locatario.token))).status).toBe(403);
    expect((await request(app).get("/api/auditoria")).status).toBe(401);
  });

  it("append-only: não há rota de edição/exclusão e o banco recusa UPDATE/DELETE", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const [registro] = await registros(veiculo.id);

    for (const metodo of ["put", "patch", "delete"] as const) {
      const res = await request(app)[metodo](`/api/auditoria/${registro.id}`).set(auth(locador.token)).send({ acao: "EXCLUSAO" });
      expect(res.status).toBe(404);
    }
    await expect(prisma.registroAuditoria.update({ where: { id: registro.id }, data: { acao: "EXCLUSAO" } })).rejects.toThrow();
    await expect(prisma.registroAuditoria.delete({ where: { id: registro.id } })).rejects.toThrow();
    expect((await registros(veiculo.id))[0].acao).toBe("CRIACAO");
  });
});
