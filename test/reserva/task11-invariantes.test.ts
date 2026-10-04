import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createAccount,
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  uniqueCnh,
  uniqueCpf,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Task 11 — invariantes fechadas na auditoria final (achados P3).
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Task 11 — invariantes da auditoria final", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  const pagar = (id: string, token = locatario.token) =>
    request(app).post(`/api/reserva/${id}/pagamento`).set(auth(token)).send({ metodoPagamento: "PIX" });

  async function reservaPaga(quem: LocatarioContext = locatario) {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(quem.token, veiculo.id, quem.locatarioId, futurePeriod(6, 1));
    expect(reserva?.id).toBeTruthy();
    expect((await pagar(reserva.id, quem.token)).body.result.reserva.status).toBe("CONFIRMADA");
    return { veiculo, reserva };
  }

  it("T11-P3: reserva REALIZADA não aceita mais alteração (PUT → 409)", async () => {
    const { reserva } = await reservaPaga();
    const outraGaragem = await createGaragem(locador.token, locador.locadorId);
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { status: "REALIZADA", codigoUsadoEm: new Date(), devolvidoEm: new Date() },
    });
    const res = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set(auth(locatario.token))
      .send({ idGaragemDevolucao: outraGaragem.id });
    expect(res.status).toBe(409);
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(r.idGaragemDevolucao).not.toBe(outraGaragem.id);
  });

  it("T11-P3: consulta de pagamento materializa a expiração da reserva (15 min)", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId, futurePeriod(7, 1));
    await prisma.reserva.update({ where: { id: reserva.id }, data: { criadaEm: new Date(Date.now() - 16 * 60 * 1000) } });
    const res = await request(app).get(`/api/reserva/${reserva.id}/pagamento`).set(auth(locatario.token));
    expect(res.status).toBe(200);
    expect(res.body.result.statusReserva).toBe("CANCELADA");
    expect((await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } })).expiradaEm).toBeTruthy();
  });

  it("T11-P3 (RN09): exclusão lógica repetida do veículo não duplica o registro EXCLUSAO", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    expect((await request(app).delete(`/api/veiculo/${veiculo.id}`).set(auth(locador.token))).status).toBe(204);
    expect((await request(app).delete(`/api/veiculo/${veiculo.id}`).set(auth(locador.token))).status).toBe(204);
    const registros = await prisma.registroAuditoria.findMany({ where: { entidade: "VEICULO", idEntidade: veiculo.id, acao: "EXCLUSAO" } });
    expect(registros).toHaveLength(1);
  });

  it("T11-P3: DELETE /api/reserva/:id sem token responde 401 (como as demais rotas)", async () => {
    const res = await request(app).delete(`/api/reserva/00000000-0000-4000-8000-000000000000`);
    expect(res.status).toBe(401);
  });

  it("T11-P3: favoritar veículo fora do catálogo (INATIVO, MANUTENCAO ou garagem INATIVA) → 404", async () => {
    const inativo = await createVeiculo(locador.token, locador.locadorId, { status: "INATIVO" });
    const manutencao = await createVeiculo(locador.token, locador.locadorId, { status: "MANUTENCAO" });
    // Garagem só pode ficar INATIVA depois de o veículo estar nela (alocação exige ATIVA).
    const garagemInativa = await createGaragem(locador.token, locador.locadorId);
    const emGaragemInativa = await createVeiculo(locador.token, locador.locadorId, { garagemId: garagemInativa.id });
    expect((await request(app).put(`/api/garagem/${garagemInativa.id}`).set(auth(locador.token)).send({ status: "INATIVA" })).status).toBe(200);
    for (const veiculo of [inativo, manutencao, emGaragemInativa]) {
      const res = await request(app).post("/api/favorito").set(auth(locatario.token)).send({ idVeiculo: veiculo.id });
      expect(res.status).toBe(404);
    }
    const disponivel = await createVeiculo(locador.token, locador.locadorId);
    expect((await request(app).post("/api/favorito").set(auth(locatario.token)).send({ idVeiculo: disponivel.id })).status).toBe(201);
  });

  it("T11-P3 (RNF05): Locador vê condutores com nome e CNH, sem CPF; o locatário vê o CPF", async () => {
    const { reserva } = await reservaPaga();
    const cpf = uniqueCpf();
    const criar = await request(app)
      .post(`/api/reserva/${reserva.id}/condutores`)
      .set(auth(locatario.token))
      .send({ nome: "Condutor Teste", cpf, cnh: uniqueCnh() });
    expect(criar.status).toBe(201);

    const doLocatario = await request(app).get(`/api/reserva/${reserva.id}/condutores`).set(auth(locatario.token));
    expect(doLocatario.body.result[0].cpf).toBe(cpf);

    const doLocador = await request(app).get(`/api/reserva/${reserva.id}/condutores`).set(auth(locador.token));
    expect(doLocador.status).toBe(200);
    expect(doLocador.body.result[0]).toMatchObject({ nome: "Condutor Teste", cpf: null });
    expect(doLocador.body.result[0].cnh).toBeTruthy();
    expect(JSON.stringify(doLocador.body)).not.toContain(cpf);
  });

  it("T11-P3 (RN03): o token do QR expira no fim da janela de desbloqueio", async () => {
    const { reserva } = await reservaPaga();
    const res = await request(app).get(`/api/reserva/${reserva.id}/desbloqueio/qr`).set(auth(locatario.token));
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.result.qr) as { exp?: number; idReserva?: string };
    expect(payload.idReserva).toBe(reserva.id);
    expect(payload.exp).toBeTypeOf("number");
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    const janela = Math.min(r.dataHoraInicio.getTime() + 2 * 24 * 60 * 60 * 1000, r.dataHoraFim.getTime());
    expect(payload.exp! * 1000).toBeLessThanOrEqual(janela);
    expect(payload.exp! * 1000).toBeGreaterThan(Date.now());
  });

  it("T11-P3 (RNF05): anonimização também apaga resíduos — destinatários de notificação e condutores", async () => {
    const titular = await createLocatario();
    const { reserva } = await reservaPaga(titular);
    await request(app)
      .post(`/api/reserva/${reserva.id}/condutores`)
      .set(auth(titular.token))
      .send({ nome: "Terceiro", cpf: uniqueCpf(), cnh: uniqueCnh() });
    const { reserva: emCurso } = await reservaPaga(titular);
    await request(app)
      .post(`/api/reserva/${emCurso.id}/condutores`)
      .set(auth(titular.token))
      .send({ nome: "Condutor em curso", cnh: uniqueCnh() });
    // A primeira reserva é encerrada (REALIZADA); a segunda continua CONFIRMADA.
    await prisma.reserva.update({ where: { id: reserva.id }, data: { status: "REALIZADA", codigoUsadoEm: new Date(), devolvidoEm: new Date() } });
    await prisma.notificacaoReserva.create({
      data: { idReserva: reserva.id, destinatario: titular.email, assunto: "Relatório", status: "ENVIADA" },
    });

    const res = await request(app).post("/api/lgpd/anonimizar").set(auth(titular.token)).send({});
    expect(res.status).toBe(200);

    const notificacoes = await prisma.notificacaoReserva.findMany({ where: { idReserva: reserva.id } });
    expect(notificacoes.length).toBeGreaterThan(0);
    expect(notificacoes.every((n) => n.destinatario !== titular.email && n.destinatario.endsWith("@anonimizado.local"))).toBe(true);
    expect(await prisma.condutorAdicional.count({ where: { idReserva: reserva.id } })).toBe(0);
    // Reserva confirmada em curso mantém o condutor (quem pode dirigir o veículo).
    expect(await prisma.condutorAdicional.count({ where: { idReserva: emCurso.id } })).toBe(1);
    // Histórico da reserva preservado.
    expect(await prisma.reserva.count({ where: { id: reserva.id } })).toBe(1);
  });

  it("T11-P3: LOCADOR anonimizado tem o destinatário dos alertas da frota anonimizado", async () => {
    const dono = await createLocador();
    const veiculo = await createVeiculo(dono.token, dono.locadorId);
    await prisma.alertaVeiculo.create({
      data: { tipo: "INATIVIDADE", idVeiculo: veiculo.id, idLocador: dono.locadorId, descricao: "teste", destinatario: dono.email, assunto: "Alerta", status: "ENVIADA" },
    });
    const admin = await createAccount("ADMIN");
    const res = await request(app).post(`/api/lgpd/${dono.locadorId}/anonimizar`).set(auth(admin.token)).send({});
    expect(res.status).toBe(200);
    const alertas = await prisma.alertaVeiculo.findMany({ where: { idLocador: dono.locadorId } });
    expect(alertas.every((a) => a.destinatario !== dono.email)).toBe(true);
  });
});
