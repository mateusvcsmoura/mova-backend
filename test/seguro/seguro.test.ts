import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createServico,
  createReserva,
  createVeiculo,
  futurePeriod,
  VALOR_DIARIA_PADRAO,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("RF10 — seguro adicional e cobertura", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let seguro: Awaited<ReturnType<typeof createServico>>;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    seguro = await createServico({
      nome: `Seguro RF10 ${Date.now()}`,
      descricao: "Proteção adicional opcional para a reserva.",
      detalhesCobertura:
        "Cobertura simulada: danos ao veículo, furto/roubo e assistência prevista no produto.",
      valor: 49.9,
    });
  });

  it("lista seguro com nome, resumo, preço e detalhes de cobertura", async () => {
    const response = await request(app)
      .get("/api/servico")
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    const encontrado = response.body.result.find(
      (item: { id: string }) => item.id === seguro.id,
    );
    expect(encontrado).toMatchObject({
      id: seguro.id,
      nome: seguro.nome,
      descricao: seguro.descricao,
      valor: 49.9,
      detalhesCobertura: seguro.detalhesCobertura,
    });
  });

  it("permite reserva sem seguro e sem associação de serviço", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Argo-sem-seguro-${Date.now()}`,
    });
    const response = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(700, 2),
      });

    expect(response.status).toBe(201);
    expect(response.body.result.servicos).toEqual([]);
    expect(response.body.result.valorTotal).toBe(VALOR_DIARIA_PADRAO * 2);
  });

  it("persiste seguro, cobertura e preço real na reserva", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Argo-com-seguro-${Date.now()}`,
    });
    const criada = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      { servicosIds: [seguro.id], ...futurePeriod(710, 2) },
    );

    expect(criada.valorTotal).toBe(VALOR_DIARIA_PADRAO * 2 + seguro.valor);
    expect(criada.servicos).toEqual([
      expect.objectContaining({
        idServico: seguro.id,
        nome: seguro.nome,
        descricao: seguro.descricao,
        detalhesCobertura: seguro.detalhesCobertura,
        valor: seguro.valor,
      }),
    ]);

    const consulta = await request(app)
      .get(`/api/reserva/${criada.id}`)
      .set(auth(locatario.token));
    expect(consulta.status).toBe(200);
    expect(consulta.body.result.servicos[0]).toMatchObject({
      nome: seguro.nome,
      valor: seguro.valor,
      detalhesCobertura: seguro.detalhesCobertura,
    });
  });

  it("rejeita seguro inexistente ou inativo", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Argo-seguro-invalido-${Date.now()}`,
    });
    const inexistente = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        servicosIds: ["00000000-0000-0000-0000-000000000000"],
        ...futurePeriod(720, 2),
      });
    expect(inexistente.status).toBe(400);

    const inativo = await createServico({
      nome: `Seguro inativo RF10 ${Date.now()}`,
      descricao: "Seguro indisponível",
      detalhesCobertura: "Não contratável",
      valor: 10,
      ativo: false,
    });
    const inativoResponse = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        servicosIds: [inativo.id],
        ...futurePeriod(730, 2),
      });
    expect(inativoResponse.status).toBe(400);
  });

  it("mantém pagamento sandbox funcionando com seguro contratado", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Argo-pagamento-seguro-${Date.now()}`,
    });
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      { servicosIds: [seguro.id], ...futurePeriod(740, 2) },
    );

    const pagamento = await request(app)
      .post(`/api/reserva/${reserva.id}/pagamento`)
      .set(auth(locatario.token))
      .send({ metodoPagamento: "PIX" });

    expect(pagamento.status).toBe(202);
    expect(pagamento.body.result.valorCobrado).toBe(reserva.valorTotal);
  });

  it("guarda cobertura contratada como snapshot quando catálogo muda", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: `Argo-snapshot-seguro-${Date.now()}`,
    });
    const reserva = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      { servicosIds: [seguro.id], ...futurePeriod(750, 2) },
    );

    await prisma.servicoOpcional.update({
      where: { id: seguro.id },
      data: {
        descricao: "Resumo alterado depois",
        detalhesCobertura: "Cobertura alterada depois",
        valor: 999,
      },
    });

    const consulta = await request(app)
      .get(`/api/reserva/${reserva.id}`)
      .set(auth(locatario.token));
    expect(consulta.body.result.servicos[0]).toMatchObject({
      descricao: seguro.descricao,
      detalhesCobertura: seguro.detalhesCobertura,
      valor: seguro.valor,
    });
  });
});
