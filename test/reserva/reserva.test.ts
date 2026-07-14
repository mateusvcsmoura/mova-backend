import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/database/prisma";
import {
  createAccount,
  createDeficiencia,
  createGaragem,
  createLocador,
  createLocatario,
  createReserva,
  createServico,
  createVeiculo,
  confirmarPagamentoWebhook,
  futurePeriod,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

// Aloca um veículo numa garagem (define veiculo.garagemId).
async function alocarVeiculo(
  token: string,
  garagemId: string,
  veiculoId: string,
) {
  return request(app)
    .post(`/api/garagem/${garagemId}/veiculos/${veiculoId}`)
    .set("Authorization", `Bearer ${token}`);
}

const CODIGO_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

describe("Reserva API", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let outroLocatario: LocatarioContext;
  let veiculoId: string;
  let reservaId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    outroLocatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
  });

  describe("POST /api/reserva", () => {
    it("deve criar uma reserva (LOCATARIO dono)", async () => {
      const periodo = futurePeriod(1, 2);
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 350.75,
          ...periodo,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.idVeiculo).toBe(veiculoId);
      expect(response.body.result.idLocatario).toBe(locatario.locatarioId);
      expect(response.body.result.valorTotal).toBe(350.75);
      expect(response.body.result.status).toBe("AGUARDANDO_PAGAMENTO");
      expect(response.body.result.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");

      reservaId = response.body.result.id;
    });

    it("deve recusar criação sem autenticação", async () => {
      const response = await request(app)
        .post("/api/reserva")
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          ...futurePeriod(10, 1),
        });

      expect(response.status).toBe(401);
    });

    it("deve recusar locatário reservando em nome de outro", async () => {
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: outroLocatario.locatarioId,
          valorTotal: 100,
          ...futurePeriod(20, 1),
        });

      expect(response.status).toBe(403);
    });

    it("deve recusar período com fim antes do início", async () => {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() + 5);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() - 1);

      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          dataHoraInicio: inicio.toISOString(),
          dataHoraFim: fim.toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it("deve recusar reserva com período no passado", async () => {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 5);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);

      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          dataHoraInicio: inicio.toISOString(),
          dataHoraFim: fim.toISOString(),
        });

      expect(response.status).toBe(400);
    });

    it("deve recusar reserva com período sobreposto no mesmo veículo", async () => {
      // mesmo período da primeira reserva criada (1..3 dias)
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${outroLocatario.token}`)
        .send({
          idVeiculo: veiculoId,
          idLocatario: outroLocatario.locatarioId,
          valorTotal: 200,
          ...futurePeriod(1, 2),
        });

      expect(response.status).toBe(409);
    });

    it("deve recusar reserva para veículo inexistente", async () => {
      const response = await request(app)
        .post("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({
          idVeiculo: "00000000-0000-0000-0000-000000000000",
          idLocatario: locatario.locatarioId,
          valorTotal: 100,
          ...futurePeriod(30, 1),
        });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/reserva", () => {
    it("deve listar as reservas do locatário autenticado", async () => {
      const response = await request(app)
        .get("/api/reserva")
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
      expect(
        response.body.result.every(
          (r: any) => r.idLocatario === locatario.locatarioId,
        ),
      ).toBe(true);
    });

    it("deve listar as reservas dos veículos do locador", async () => {
      const response = await request(app)
        .get("/api/reserva")
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });

    it("deve recusar listagem sem autenticação", async () => {
      const response = await request(app).get("/api/reserva");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/reserva/:id", () => {
    it("deve retornar a reserva por id (dono)", async () => {
      const response = await request(app)
        .get(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(reservaId);
    });

    it("deve recusar acesso de locatário que não é dono", async () => {
      const response = await request(app)
        .get(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${outroLocatario.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/reserva/locatario/:id_locatario", () => {
    it("deve retornar as reservas de um locatário", async () => {
      const response = await request(app)
        .get(`/api/reserva/locatario/${locatario.locatarioId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/reserva/veiculo/:id_veiculo", () => {
    it("deve retornar as reservas de um veículo (LOCADOR)", async () => {
      const response = await request(app)
        .get(`/api/reserva/veiculo/${veiculoId}`)
        .set("Authorization", `Bearer ${locador.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /api/reserva/:id", () => {
    it("deve atualizar o status da reserva", async () => {
      const response = await request(app)
        .put(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ status: "CONFIRMADA" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("CONFIRMADA");
    });

    it("ignora statusPagamento enviado pelo cliente (só muda via webhook)", async () => {
      const response = await request(app)
        .put(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ status: "CONFIRMADA", statusPagamento: "SUCESSO" });

      expect(response.status).toBe(200);
      // Campo é retirado do schema: o pagamento permanece aguardando.
      expect(response.body.result.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    });

    it("deve recusar atualização sem nenhum campo", async () => {
      const response = await request(app)
        .put(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/reserva/:id", () => {
    it("deve remover a reserva", async () => {
      const response = await request(app)
        .delete(`/api/reserva/${reservaId}`)
        .set("Authorization", `Bearer ${locatario.token}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });
  });
});

describe("Reserva — código de desbloqueio", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoId: string;
  let reservaId: string;
  let codigo: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;

    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(50, 3),
    );
    reservaId = reserva.id;
  });

  it("não deve ter código antes do pagamento", async () => {
    const response = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.codigoDesbloqueio).toBeNull();
  });

  it("deve recusar desbloqueio antes de gerar o código", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo: "ABCD-2345" });

    expect(response.status).toBe(409);
  });

  it("deve gerar código no formato XXXX-XXXX ao confirmar pagamento", async () => {
    const webhook = await confirmarPagamentoWebhook(reservaId);
    expect(webhook.status).toBe(200);

    const response = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.statusPagamento).toBe("SUCESSO");
    expect(response.body.result.codigoDesbloqueio).toMatch(CODIGO_REGEX);
    expect(response.body.result.codigoGeradoEm).not.toBeNull();
    expect(response.body.result.codigoUsadoEm).toBeNull();

    codigo = response.body.result.codigoDesbloqueio;
  });

  it("não deve regerar o código se o pagamento já estava confirmado", async () => {
    const webhook = await confirmarPagamentoWebhook(reservaId);
    expect(webhook.status).toBe(200);

    const response = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.codigoDesbloqueio).toBe(codigo);
  });

  it("deve recusar uso do código antes da data de início", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(response.status).toBe(409);
  });

  it("deve recusar código inválido", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo: "ZZZZ-9999" });

    expect(response.status).toBe(400);
  });

  it("deve desbloquear dentro da janela válida", async () => {
    // backdate: início ontem, fim amanhã -> dentro da janela de uso
    await prisma.reserva.update({
      where: { id: reservaId },
      data: {
        dataHoraInicio: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dataHoraFim: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(response.status).toBe(200);
    expect(response.body.result.codigoUsadoEm).not.toBeNull();
  });

  it("deve recusar reuso de um código já utilizado", async () => {
    const response = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(response.status).toBe(409);
  });

  it("deve expirar o código após o fim da reserva", async () => {
    // cria nova reserva, confirma pagamento, depois move a janela toda p/ o passado
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(80, 2),
    );

    await confirmarPagamentoWebhook(reserva.id);

    const detalhe = await prisma.reserva.findUnique({
      where: { id: reserva.id },
    });

    await prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        dataHoraInicio: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        dataHoraFim: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .post(`/api/reserva/${reserva.id}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo: detalhe!.codigoDesbloqueio! });

    expect(response.status).toBe(409);
  });
});

describe("Reserva — locais de retirada e devolução", () => {
  let locador: LocadorContext;
  let outroLocador: LocadorContext;
  let locatario: LocatarioContext;
  let garagemRetirada: any;
  let garagemDevolucao: any; // outra garagem do mesmo locador
  let garagemOutroLocador: any;
  let veiculoId: string;
  let reservaId: string;

  beforeAll(async () => {
    locador = await createLocador();
    outroLocador = await createLocador();
    locatario = await createLocatario();

    garagemRetirada = await createGaragem(locador.token, locador.locadorId);
    garagemDevolucao = await createGaragem(locador.token, locador.locadorId);
    garagemOutroLocador = await createGaragem(
      outroLocador.token,
      outroLocador.locadorId,
    );

    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;

    // Hospeda o veículo na garagem de retirada (define veiculo.garagemId).
    await alocarVeiculo(locador.token, garagemRetirada.id, veiculoId);
  });

  it("deve criar reserva com retirada (garagem atual) e devolução válidas", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 400,
        idGaragemDevolucao: garagemDevolucao.id,
        ...futurePeriod(100, 2),
      });

    expect(response.status).toBe(201);
    expect(response.body.result.idGaragemRetirada).toBe(garagemRetirada.id);
    expect(response.body.result.idGaragemDevolucao).toBe(garagemDevolucao.id);

    reservaId = response.body.result.id;
  });

  it("deve retornar os novos campos na consulta por id", async () => {
    const response = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.idGaragemRetirada).toBe(garagemRetirada.id);
    expect(response.body.result.idGaragemDevolucao).toBe(garagemDevolucao.id);
  });

  it("deve recusar devolução em garagem de outro locador", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 400,
        idGaragemDevolucao: garagemOutroLocador.id,
        ...futurePeriod(200, 2),
      });

    expect(response.status).toBe(400);
  });

  it("deve recusar retirada divergente da garagem atual do veículo", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 400,
        idGaragemRetirada: garagemDevolucao.id, // não é a garagem onde está alocado
        ...futurePeriod(300, 2),
      });

    expect(response.status).toBe(400);
  });

  it("deve recusar devolução em garagem inexistente", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 400,
        idGaragemDevolucao: "00000000-0000-0000-0000-000000000000",
        ...futurePeriod(400, 2),
      });

    expect(response.status).toBe(404);
  });

  it("deve atualizar o local de devolução para outra garagem do mesmo locador", async () => {
    const response = await request(app)
      .put(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ idGaragemDevolucao: garagemRetirada.id });

    expect(response.status).toBe(200);
    expect(response.body.result.idGaragemDevolucao).toBe(garagemRetirada.id);
  });

  it("deve recusar atualização do local de devolução para garagem de outro locador", async () => {
    const response = await request(app)
      .put(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ idGaragemDevolucao: garagemOutroLocador.id });

    expect(response.status).toBe(400);
  });
});

describe("Reserva — forma de pagamento (RF11)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
  });

  it("deve criar reserva com forma de pagamento (PIX)", async () => {
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      { metodoPagamento: "PIX", ...futurePeriod(500, 2) },
    );

    expect(reserva.metodoPagamento).toBe("PIX");
  });

  it("deve deixar a forma de pagamento nula quando omitida", async () => {
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(510, 2),
    );

    expect(reserva.metodoPagamento).toBeNull();
  });

  it("deve atualizar a forma de pagamento (CARTAO_CREDITO)", async () => {
    const reserva = await createReserva(
      locatario.token,
      veiculoId,
      locatario.locatarioId,
      futurePeriod(520, 2),
    );

    const response = await request(app)
      .put(`/api/reserva/${reserva.id}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "CARTAO_CREDITO" });

    expect(response.status).toBe(200);
    expect(response.body.result.metodoPagamento).toBe("CARTAO_CREDITO");
  });

  it("deve recusar forma de pagamento inválida (400)", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 300,
        metodoPagamento: "BOLETO",
        ...futurePeriod(530, 2),
      });

    expect(response.status).toBe(400);
  });
});

describe("Reserva — garagem inativa não entra em novas reservas (RF19)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let garagemRetirada: any;
  let garagemDevolucao: any;
  let veiculoId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    garagemRetirada = await createGaragem(locador.token, locador.locadorId);
    garagemDevolucao = await createGaragem(locador.token, locador.locadorId);
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
    await alocarVeiculo(locador.token, garagemRetirada.id, veiculoId);
  });

  it("deve recusar reserva quando a garagem de devolução está INATIVA (409)", async () => {
    await request(app)
      .put(`/api/garagem/${garagemDevolucao.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ status: "INATIVA" });

    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 400,
        idGaragemDevolucao: garagemDevolucao.id,
        ...futurePeriod(600, 2),
      });

    expect(response.status).toBe(409);
  });

  it("deve recusar reserva quando a garagem de retirada está INATIVA (409)", async () => {
    // Soft delete da garagem onde o veículo está alocado.
    await request(app)
      .delete(`/api/garagem/${garagemRetirada.id}`)
      .set("Authorization", `Bearer ${locador.token}`);

    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 400,
        ...futurePeriod(610, 2),
      });

    expect(response.status).toBe(409);
  });
});

describe("Reserva — veículos adaptados (PCD)", () => {
  let locador: LocadorContext;
  let comDeficiencia: LocatarioContext;
  let semDeficiencia: LocatarioContext;
  let outroSemDeficiencia: LocatarioContext;
  let deficienciaId: string;
  let veiculoComumId: string;
  let veiculoAdaptadoId: string;

  beforeAll(async () => {
    const admin = await createAccount("ADMIN");
    const deficiencia = await createDeficiencia(admin.token);
    deficienciaId = deficiencia.id;

    locador = await createLocador();
    comDeficiencia = await createLocatario(deficienciaId);
    semDeficiencia = await createLocatario();
    outroSemDeficiencia = await createLocatario();

    const comum = await createVeiculo(locador.token, locador.locadorId, { adaptado: false });
    veiculoComumId = comum.id;

    const adaptado = await createVeiculo(locador.token, locador.locadorId, {
      adaptado: true,
      marca: "Volkswagen",
      modelo: "Adaptado",
      ano: 2023,
    });
    veiculoAdaptadoId = adaptado.id;
  });

  it("permite reservar veículo comum sem deficiência cadastrada", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${semDeficiencia.token}`)
      .send({
        idVeiculo: veiculoComumId,
        idLocatario: semDeficiencia.locatarioId,
        valorTotal: 150,
        ...futurePeriod(500, 1),
      });

    expect(response.status).toBe(201);
  });

  it("permite reservar veículo comum com deficiência cadastrada", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${comDeficiencia.token}`)
      .send({
        idVeiculo: veiculoComumId,
        idLocatario: comDeficiencia.locatarioId,
        valorTotal: 150,
        ...futurePeriod(510, 1),
      });

    expect(response.status).toBe(201);
  });

  it("permite reservar veículo adaptado por locatário com deficiência cadastrada", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${comDeficiencia.token}`)
      .send({
        idVeiculo: veiculoAdaptadoId,
        idLocatario: comDeficiencia.locatarioId,
        valorTotal: 200,
        ...futurePeriod(520, 1),
      });

    expect(response.status).toBe(201);
  });

  it("bloqueia veículo adaptado para locatário sem deficiência", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${semDeficiencia.token}`)
      .send({
        idVeiculo: veiculoAdaptadoId,
        idLocatario: semDeficiencia.locatarioId,
        valorTotal: 200,
        ...futurePeriod(530, 1),
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/necessidade especial/i);
  });

  it("recusa deficiência inexistente informada no fluxo da reserva", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${semDeficiencia.token}`)
      .send({
        idVeiculo: veiculoAdaptadoId,
        idLocatario: semDeficiencia.locatarioId,
        valorTotal: 200,
        deficienciaId: "00000000-0000-0000-0000-000000000000",
        ...futurePeriod(540, 1),
      });

    expect(response.status).toBe(404);
  });

  it("permite reservar veículo adaptado informando a deficiência no fluxo da reserva", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${outroSemDeficiencia.token}`)
      .send({
        idVeiculo: veiculoAdaptadoId,
        idLocatario: outroSemDeficiencia.locatarioId,
        valorTotal: 200,
        deficienciaId,
        ...futurePeriod(550, 1),
      });

    expect(response.status).toBe(201);

    // A deficiência informada deve ter sido associada ao locatário.
    const locatario = await request(app).get(
      `/api/locatario/${outroSemDeficiencia.locatarioId}`,
    );
    expect(locatario.body.result.deficienciaId).toBe(deficienciaId);
  });
});

describe("Reserva — serviços opcionais", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoId: string;
  let seguro: Awaited<ReturnType<typeof createServico>>;
  let tanque: Awaited<ReturnType<typeof createServico>>;

  const VALOR_BASE = 300;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;

    seguro = await createServico({
      nome: "Seguro adicional",
      descricao: "Cobertura adicional",
      valor: 49.9,
    });
    tanque = await createServico({
      nome: "Tanque cheio",
      descricao: "Devolucao com tanque cheio",
      valor: 250,
    });
  });

  it("cria reserva sem serviços opcionais (valor base inalterado)", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: VALOR_BASE,
        ...futurePeriod(600, 1),
      });

    expect(response.status).toBe(201);
    expect(response.body.result.valorTotal).toBe(VALOR_BASE);
    expect(response.body.result.servicos).toEqual([]);
  });

  it("cria reserva com Seguro adicional e soma ao valor total", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: VALOR_BASE,
        servicosIds: [seguro.id],
        ...futurePeriod(610, 1),
      });

    expect(response.status).toBe(201);
    expect(response.body.result.valorTotal).toBe(VALOR_BASE + seguro.valor);
    expect(response.body.result.servicos).toHaveLength(1);
    expect(response.body.result.servicos[0].idServico).toBe(seguro.id);
    expect(response.body.result.servicos[0].nome).toBe(seguro.nome);
    expect(response.body.result.servicos[0].valor).toBe(seguro.valor);
  });

  it("cria reserva com Tanque cheio e soma ao valor total", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: VALOR_BASE,
        servicosIds: [tanque.id],
        ...futurePeriod(620, 1),
      });

    expect(response.status).toBe(201);
    expect(response.body.result.valorTotal).toBe(VALOR_BASE + tanque.valor);
    expect(response.body.result.servicos).toHaveLength(1);
    expect(response.body.result.servicos[0].idServico).toBe(tanque.id);
  });

  it("cria reserva com ambos os serviços e soma corretamente", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: VALOR_BASE,
        servicosIds: [seguro.id, tanque.id],
        ...futurePeriod(630, 1),
      });

    expect(response.status).toBe(201);
    expect(response.body.result.valorTotal).toBe(
      VALOR_BASE + seguro.valor + tanque.valor,
    );
    expect(response.body.result.servicos).toHaveLength(2);
  });

  it("retorna os serviços contratados ao consultar a reserva por id", async () => {
    const criacao = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: VALOR_BASE,
        servicosIds: [seguro.id, tanque.id],
        ...futurePeriod(640, 1),
      });

    const reservaId = criacao.body.result.id;

    const response = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(response.status).toBe(200);
    expect(response.body.result.servicos).toHaveLength(2);
    const nomes = response.body.result.servicos.map((s: any) => s.nome);
    expect(nomes).toContain(seguro.nome);
    expect(nomes).toContain(tanque.nome);
  });

  it("recusa reserva com serviço inexistente", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: VALOR_BASE,
        servicosIds: ["00000000-0000-0000-0000-000000000000"],
        ...futurePeriod(650, 1),
      });

    expect(response.status).toBe(400);
  });
});

describe("Reserva — duração (RN05)", () => {
  let locatario: LocatarioContext;
  let veiculoId: string;

  const UMA_HORA_MS = 60 * 60 * 1000;
  const UM_DIA_MS = 24 * 60 * 60 * 1000;

  // Período com controle de milissegundos (futurePeriod só dá granularidade de
  // dias). startInDays evita sobreposição entre os cenários no mesmo veículo.
  const periodo = (startInDays: number, duracaoMs: number) => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + startInDays);
    const fim = new Date(inicio.getTime() + duracaoMs);
    return {
      dataHoraInicio: inicio.toISOString(),
      dataHoraFim: fim.toISOString(),
    };
  };

  beforeAll(async () => {
    const locador = await createLocador();
    locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    veiculoId = veiculo.id;
  });

  const criar = (corpo: Record<string, unknown>) =>
    request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculoId,
        idLocatario: locatario.locatarioId,
        valorTotal: 100,
        ...corpo,
      });

  it("recusa duração inferior a 1 hora (30 min) → 400", async () => {
    const response = await criar(periodo(10, 30 * 60 * 1000));
    expect(response.status).toBe(400);
  });

  it("recusa duração superior a 30 dias (31 dias) → 400", async () => {
    const response = await criar(periodo(300, 31 * UM_DIA_MS));
    expect(response.status).toBe(400);
  });

  it("aceita duração de exatamente 1 hora (borda) → 201", async () => {
    const response = await criar(periodo(100, UMA_HORA_MS));
    expect(response.status).toBe(201);
  });

  it("aceita duração de exatamente 30 dias (borda) → 201", async () => {
    const response = await criar(periodo(200, 30 * UM_DIA_MS));
    expect(response.status).toBe(201);
  });

  it("recusa update que estende a reserva para além de 30 dias → 400", async () => {
    const criacao = await criar(periodo(400, 2 * UM_DIA_MS));
    expect(criacao.status).toBe(201);
    const reservaId = criacao.body.result.id;

    const inicio = new Date(criacao.body.result.dataHoraInicio);
    const fimExcessivo = new Date(inicio.getTime() + 31 * UM_DIA_MS);

    const response = await request(app)
      .put(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ dataHoraFim: fimExcessivo.toISOString() });

    expect(response.status).toBe(400);
  });
});
