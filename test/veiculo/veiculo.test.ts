import request from "supertest";
import { app } from "../../src/app";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../src/database/prisma";
import {
  createAccount,
  createLocador,
  createLocatario,
  createGaragem,
  createVeiculo,
  futurePeriod,
  uniquePlaca,
  type Account,
  type LocadorContext,
  type LocatarioContext,
} from "../helpers";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const veiculoPayload = (idLocador: string, overrides: Record<string, unknown> = {}) => ({
  idLocador,
  placa: uniquePlaca(),
  marca: "Volkswagen",
  modelo: "Polo",
  ano: 2023,
  cambio: "Automatico",
  valorDiaria: 125.25,
  capacidade: 5,
  eletrico: false,
  adaptado: false,
  ...overrides,
});

describe("Veiculo API", () => {
  let locador: LocadorContext;
  let outroLocador: LocadorContext;
  let locatario: LocatarioContext;
  let admin: Account;
  let veiculoId: string;
  let modeloId: string;
  const placa = uniquePlaca();

  beforeAll(async () => {
    locador = await createLocador();
    outroLocador = await createLocador();
    locatario = await createLocatario();
    admin = await createAccount("ADMIN");
  });

  describe("POST /api/veiculo", () => {
    it("deve criar um veículo (locador dono)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locador.token))
        .send(veiculoPayload(locador.locadorId, { placa }));

      expect(response.status).toBe(201);
      expect(response.body.result).toHaveProperty("id");
      expect(response.body.result.placa).toBe(placa);
      expect(response.body.result.idLocador).toBe(locador.locadorId);
      expect(response.body.result).toHaveProperty("modeloVeiculo");

      veiculoId = response.body.result.id;
      modeloId = response.body.result.idModeloVeiculo;
    });

    it("deve respeitar o status informado na criação", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locador.token))
        .send(veiculoPayload(locador.locadorId, { status: "MANUTENCAO" }));

      expect(response.status).toBe(201);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });

    it("deve recusar veículo com placa duplicada", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locador.token))
        .send(veiculoPayload(locador.locadorId, { placa }));

      expect(response.status).toBe(409);
    });

    it("deve recusar criação sem autenticação (401)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(401);
    });

    it("deve recusar criação por LOCATARIO (403)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(locatario.token))
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(403);
    });

    it("deve recusar locador criar veículo em nome de outro locador (403)", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(outroLocador.token))
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(403);
    });

    it("deve permitir ADMIN criar em nome de qualquer locador", async () => {
      const response = await request(app)
        .post("/api/veiculo")
        .set(auth(admin.token))
        .send(veiculoPayload(locador.locadorId));

      expect(response.status).toBe(201);
    });
  });

  describe("POST /api/veiculo/lote", () => {
    it("deve criar veículos em lote (locador dono)", async () => {
      const placas = [uniquePlaca(), uniquePlaca(), uniquePlaca()];
      const response = await request(app)
        .post("/api/veiculo/lote")
        .set(auth(locador.token))
        .send({
          idLocador: locador.locadorId,
          marca: "Chevrolet",
          modelo: "Onix",
          ano: 2022,
          cambio: "Manual",
          valorDiaria: 125.25,
          capacidade: 5,
          eletrico: false,
          adaptado: false,
          placas,
        });

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBe(placas.length);
    });

    it("deve recusar lote em nome de outro locador (403)", async () => {
      const response = await request(app)
        .post("/api/veiculo/lote")
        .set(auth(outroLocador.token))
        .send({
          idLocador: locador.locadorId,
          marca: "Chevrolet",
          modelo: "Onix",
          ano: 2022,
          cambio: "Manual",
          valorDiaria: 125.25,
          capacidade: 5,
          eletrico: false,
          adaptado: false,
          placas: [uniquePlaca()],
        });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/veiculo", () => {
    it("deve listar os veículos do locador autenticado", async () => {
      const response = await request(app)
        .get("/api/veiculo")
        .set(auth(locador.token));

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(response.body.result.length).toBeGreaterThan(0);
    });

    it("deve recusar listagem sem autenticação", async () => {
      const response = await request(app).get("/api/veiculo");
      expect(response.status).toBe(401);
    });

    it("inclui o nome da garagem efetiva na resposta do catálogo", async () => {
      const garagem = await createGaragem(locador.token, locador.locadorId, {
        nome: "Garagem do catálogo",
      });
      const alocacao = await request(app)
        .post(`/api/garagem/${garagem.id}/veiculos/${veiculoId}`)
        .set(auth(locador.token))
        .send({});
      expect(alocacao.status).toBe(204);

      const response = await request(app)
        .get("/api/veiculo")
        .set(auth(locador.token));

      expect(response.status).toBe(200);
      const veiculo = response.body.result.find((item: any) => item.id === veiculoId);
      expect(veiculo.garagem.status).toBe("ATIVA");
      expect(veiculo).toMatchObject({
        garagemId: garagem.id,
        garagem: { id: garagem.id, nome: "Garagem do catálogo" },
      });
    });
  });

  describe("Veiculo API — status da garagem no contrato", () => {
    it("não apresenta garagem INATIVA ou MANUTENCAO no catálogo reservável", async () => {
      const garagemInativa = await createGaragem(
        locador.token,
        locador.locadorId,
        { nome: "Garagem inativa do catálogo" },
      );
      const garagemManutencao = await createGaragem(
        locador.token,
        locador.locadorId,
        { nome: "Garagem em manutencao do catálogo" },
      );
      const veiculoInativo = await createVeiculo(
        locador.token,
        locador.locadorId,
      );
      const veiculoManutencao = await createVeiculo(
        locador.token,
        locador.locadorId,
      );

      expect(
        (
          await request(app)
            .post(
              `/api/garagem/${garagemInativa.id}/veiculos/${veiculoInativo.id}`,
            )
            .set(auth(locador.token))
            .send({})
        ).status,
      ).toBe(204);
      expect(
        (
          await request(app)
            .post(
              `/api/garagem/${garagemManutencao.id}/veiculos/${veiculoManutencao.id}`,
            )
            .set(auth(locador.token))
            .send({})
        ).status,
      ).toBe(204);
      await prisma.garagem.update({
        where: { id: garagemInativa.id },
        data: { status: "INATIVA" },
      });
      await prisma.garagem.update({
        where: { id: garagemManutencao.id },
        data: { status: "MANUTENCAO" },
      });

      const response = await request(app)
        .get("/api/veiculo")
        .set(auth(locatario.token));

      expect(response.status).toBe(200);
      expect(response.body.result.map((item: any) => item.id)).not.toContain(
        veiculoInativo.id,
      );
      expect(response.body.result.map((item: any) => item.id)).not.toContain(
        veiculoManutencao.id,
      );

      const detalheInativo = await request(app).get(
        `/api/veiculo/${veiculoInativo.id}`,
      );
      const detalheManutencao = await request(app).get(
        `/api/veiculo/${veiculoManutencao.id}`,
      );
      expect(detalheInativo.body.result.garagem.status).toBe("INATIVA");
      expect(detalheManutencao.body.result.garagem.status).toBe("MANUTENCAO");
    });

    it("retorna garagem nula quando veículo não está alocado", async () => {
      const semGaragem = await createVeiculo(locador.token, locador.locadorId);

      const response = await request(app)
        .get("/api/veiculo")
        .set(auth(locador.token));

      expect(response.status).toBe(200);
      expect(
        response.body.result.find((item: any) => item.id === semGaragem.id),
      ).toMatchObject({ id: semGaragem.id, garagemId: null, garagem: null });
    });

    it("preserva paginação na listagem com garagem aninhada", async () => {
      const response = await request(app)
        .get("/api/veiculo?page=1&limit=1")
        .set(auth(locador.token));

      expect(response.status).toBe(200);
      expect(response.body.result).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({ page: 1, limit: 1 });
    });
  });

  describe("GET /api/veiculo/:id (público)", () => {
    it("deve retornar o veículo por id", async () => {
      const response = await request(app).get(`/api/veiculo/${veiculoId}`);

      expect(response.status).toBe(200);
      expect(response.body.result.id).toBe(veiculoId);
      expect(response.body.result.garagem).toMatchObject({ status: "ATIVA" });
    });

    it("não deve expor veículo INATIVO (404)", async () => {
      const inativo = await createVeiculo(locador.token, locador.locadorId, {
        status: "INATIVO",
      });

      const response = await request(app).get(`/api/veiculo/${inativo.id}`);
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/veiculo/locador/:id_locador (público)", () => {
    it("deve retornar os veículos DISPONIVEL de um locador", async () => {
      const response = await request(app).get(
        `/api/veiculo/locador/${locador.locadorId}`,
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.result)).toBe(true);
      expect(
        response.body.result.every((v: any) => v.status === "DISPONIVEL"),
      ).toBe(true);
    });
  });

  describe("PATCH /api/veiculo/modelos/:id_modelo", () => {
    it("deve atualizar o modelo (locador dono)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .set(auth(locador.token))
        .send({ capacidade: 7 });

      expect(response.status).toBe(200);
      expect(response.body.result.capacidade).toBe(7);
    });

    it("deve recusar alteração de modelo por outro locador (403)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .set(auth(outroLocador.token))
        .send({ capacidade: 9 });

      expect(response.status).toBe(403);
    });

    it("deve recusar sem autenticação (401)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/modelos/${modeloId}`)
        .send({ capacidade: 9 });

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /api/veiculo/:id_veiculo/modelo", () => {
    it("deve trocar o modelo de um veículo (locador dono)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/${veiculoId}/modelo`)
        .set(auth(locador.token))
        .send({
          idLocador: locador.locadorId,
          marca: "Toyota",
          modelo: "Corolla",
          ano: 2024,
          cambio: "Automatico",
          valorDiaria: 125.25,
          capacidade: 5,
          eletrico: false,
          adaptado: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.result.modeloVeiculo.marca).toBe("Toyota");
    });

    it("deve recusar troca de modelo em veículo de outro locador (403)", async () => {
      const response = await request(app)
        .patch(`/api/veiculo/${veiculoId}/modelo`)
        .set(auth(outroLocador.token))
        .send({
          idLocador: outroLocador.locadorId,
          marca: "Toyota",
          modelo: "Corolla",
          ano: 2024,
          cambio: "Automatico",
          valorDiaria: 125.25,
          capacidade: 5,
          eletrico: false,
          adaptado: false,
        });

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /api/veiculo/:id", () => {
    it("deve atualizar o status (locador dono)", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .set(auth(locador.token))
        .send({ status: "MANUTENCAO" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("MANUTENCAO");
    });

    it("deve reativar veículo em manutenção para DISPONIVEL", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .set(auth(locador.token))
        .send({ status: "DISPONIVEL" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("DISPONIVEL");
    });

    it("deve recusar edição de veículo de outro locador (403)", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .set(auth(outroLocador.token))
        .send({ status: "INATIVO" });

      expect(response.status).toBe(403);
    });

    it("deve recusar edição sem autenticação (401)", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .send({ status: "INATIVO" });

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/veiculo/:id", () => {
    it("deve recusar exclusão de veículo de outro locador (403)", async () => {
      const response = await request(app)
        .delete(`/api/veiculo/${veiculoId}`)
        .set(auth(outroLocador.token));

      expect(response.status).toBe(403);
    });

    it("deve recusar exclusão sem autenticação (401)", async () => {
      const response = await request(app).delete(`/api/veiculo/${veiculoId}`);
      expect(response.status).toBe(401);
    });

    it("deve fazer soft delete do veículo (locador dono): INATIVO, ainda existente", async () => {
      const response = await request(app)
        .delete(`/api/veiculo/${veiculoId}`)
        .set(auth(locador.token));

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      // RN08: soft delete — o veículo continua existindo, marcado INATIVO.
      const persistido = await prisma.veiculo.findUnique({
        where: { id: veiculoId },
      });
      expect(persistido).not.toBeNull();
      expect(persistido!.status).toBe("INATIVO");

      // Detalhe público trata INATIVO como inexistente (fora do catálogo).
      const publico = await request(app).get(`/api/veiculo/${veiculoId}`);
      expect(publico.status).toBe(404);
    });

    it("deve reativar veículo INATIVO para DISPONIVEL", async () => {
      const response = await request(app)
        .put(`/api/veiculo/${veiculoId}`)
        .set(auth(locador.token))
        .send({ status: "DISPONIVEL" });

      expect(response.status).toBe(200);
      expect(response.body.result.status).toBe("DISPONIVEL");
    });

    it("veículo INATIVO (soft-deleted) não é reservável (409)", async () => {
      // Veículo próprio, desativado por soft delete.
      const veiculo = await createVeiculo(locador.token, locador.locadorId);
      const del = await request(app)
        .delete(`/api/veiculo/${veiculo.id}`)
        .set(auth(locador.token));
      expect(del.status).toBe(204);

      const reserva = await request(app)
        .post("/api/reserva")
        .set(auth(locatario.token))
        .send({
          idVeiculo: veiculo.id,
          idLocatario: locatario.locatarioId,
          valorTotal: 150,
          ...futurePeriod(600, 1),
        });

      expect(reserva.status).toBe(409);
    });
  });
});

describe("Veículo em MANUTENCAO não entra em novas reservas", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  it("rejeita reserva direta enquanto o veículo está em manutenção", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      status: "MANUTENCAO",
    });

    const response = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        valorTotal: 250,
        ...futurePeriod(800, 2),
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/não está disponível/i);
  });

  it("preserva reserva existente ao colocar o veículo em manutenção", async () => {
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const criada = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        valorTotal: 250,
        ...futurePeriod(810, 2),
      });

    expect(criada.status).toBe(201);

    const alterado = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set(auth(locador.token))
      .send({ status: "MANUTENCAO" });
    expect(alterado.status).toBe(200);

    const consulta = await request(app)
      .get(`/api/reserva/${criada.body.result.id}`)
      .set(auth(locatario.token));
    expect(consulta.status).toBe(200);
    expect(consulta.body.result.idVeiculo).toBe(veiculo.id);
  });
});

describe("Veiculo — categorias (RF07/RF16)", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let veiculoExecutivoId: string;
  let modeloExecutivoId: string;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  it("locador cadastra veículo com categoria (RF16)", async () => {
    const response = await request(app)
      .post("/api/veiculo")
      .set(auth(locador.token))
      .send(veiculoPayload(locador.locadorId, { categoria: "EXECUTIVO" }));

    expect(response.status).toBe(201);
    expect(response.body.result.modeloVeiculo.categoria).toBe("EXECUTIVO");

    veiculoExecutivoId = response.body.result.id;
    modeloExecutivoId = response.body.result.idModeloVeiculo;
  });

  it("recusa categoria inválida no cadastro (400)", async () => {
    const response = await request(app)
      .post("/api/veiculo")
      .set(auth(locador.token))
      .send(veiculoPayload(locador.locadorId, { categoria: "LUXO" }));

    expect(response.status).toBe(400);
  });

  it("locatário filtra veículos por categoria (RF07)", async () => {
    const response = await request(app)
      .get("/api/veiculo")
      .query({ categoria: "EXECUTIVO" })
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    expect(response.body.result.length).toBeGreaterThan(0);
    expect(
      response.body.result.every(
        (v: any) => v.modeloVeiculo.categoria === "EXECUTIVO",
      ),
    ).toBe(true);
    expect(
      response.body.result.some((v: any) => v.id === veiculoExecutivoId),
    ).toBe(true);
  });

  it("filtro por outra categoria não retorna o veículo EXECUTIVO", async () => {
    const response = await request(app)
      .get("/api/veiculo")
      .query({ categoria: "ECONOMICO" })
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    expect(
      response.body.result.some((v: any) => v.id === veiculoExecutivoId),
    ).toBe(false);
  });

  it("locador reclassifica a categoria do modelo (RF16)", async () => {
    const response = await request(app)
      .patch(`/api/veiculo/modelos/${modeloExecutivoId}`)
      .set(auth(locador.token))
      .send({ categoria: "ECONOMICO" });

    expect(response.status).toBe(200);
    expect(response.body.result.categoria).toBe("ECONOMICO");
  });
});

describe("Veiculo — catálogo RF07 completo", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;
  let economico: any;
  let espacoso: any;
  let executivo: any;
  let adaptado: any;
  let manutencao: any;
  let inativo: any;
  let garagemInativa: any;
  let garagemInativaVehicle: any;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();

    economico = await createVeiculo(locador.token, locador.locadorId, {
      categoria: "ECONOMICO",
      marca: "Fiat",
      modelo: "Economico RF07",
    });
    espacoso = await createVeiculo(locador.token, locador.locadorId, {
      categoria: "ESPACOSO",
      capacidade: 7,
      marca: "Fiat",
      modelo: "Espacoso RF07",
    });
    executivo = await createVeiculo(locador.token, locador.locadorId, {
      categoria: "EXECUTIVO",
      cambio: "Automatico",
      eletrico: true,
      marca: "Tesla",
      modelo: "Executivo RF07",
    });
    adaptado = await createVeiculo(locador.token, locador.locadorId, {
      adaptado: true,
      marca: "Volkswagen",
      modelo: "Adaptado RF07",
    });
    manutencao = await createVeiculo(locador.token, locador.locadorId, {
      categoria: "ESPACOSO",
      status: "MANUTENCAO",
    });
    inativo = await createVeiculo(locador.token, locador.locadorId, {
      categoria: "ECONOMICO",
      status: "INATIVO",
    });

    garagemInativa = await createGaragem(locador.token, locador.locadorId, {
      status: "INATIVA",
    });
    garagemInativaVehicle = await createVeiculo(
      locador.token,
      locador.locadorId,
      { categoria: "EXECUTIVO" },
    );
    await request(app)
      .post(`/api/garagem/${garagemInativa.id}/veiculos/${garagemInativaVehicle.id}`)
      .set(auth(locador.token));
  }, 60_000);

  it.each([
    ["ECONOMICO", () => economico.id],
    ["ESPACOSO", () => espacoso.id],
    ["EXECUTIVO", () => executivo.id],
  ])("filtra categoria %s pela consulta real", async (categoria, idEsperado) => {
    const response = await request(app)
      .get("/api/veiculo")
      .query({ categoria })
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    expect(response.body.result.length).toBeGreaterThan(0);
    expect(response.body.result.every((v: any) => v.modeloVeiculo.categoria === categoria)).toBe(true);
    expect(response.body.result.some((v: any) => v.id === idEsperado())).toBe(true);
  });

  it("filtra adaptados PCD por adaptado=true", async () => {
    const response = await request(app)
      .get("/api/veiculo")
      .query({ adaptado: "true" })
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    expect(response.body.result.some((v: any) => v.id === adaptado.id)).toBe(true);
    expect(response.body.result.every((v: any) => v.modeloVeiculo.adaptado === true)).toBe(true);
  });

  it("combina categoria com câmbio, elétrico e capacidade por interseção", async () => {
    const response = await request(app)
      .get("/api/veiculo")
      .query({ categoria: "EXECUTIVO", cambio: "Automatico", eletrico: "true", capacidade: 5 })
      .set(auth(locatario.token));

    expect(response.status).toBe(200);
    expect(response.body.result.some((v: any) => v.id === executivo.id)).toBe(true);
    expect(response.body.result.every((v: any) => (
      v.modeloVeiculo.categoria === "EXECUTIVO" &&
      v.modeloVeiculo.cambio === "Automatico" &&
      v.modeloVeiculo.eletrico === true &&
      v.modeloVeiculo.capacidade === 5
    ))).toBe(true);
  });

  it("mantém disponibilidade: manutenção, inativo e garagem inativa ficam fora", async () => {
    const response = await request(app)
      .get("/api/veiculo")
      .set(auth(locatario.token));
    const ids = response.body.result.map((v: any) => v.id);

    expect(response.status).toBe(200);
    expect(ids).not.toContain(manutencao.id);
    expect(ids).not.toContain(inativo.id);
    expect(ids).not.toContain(garagemInativaVehicle.id);
  });

  it("mantém paginação e aceita categoria inválida com o comportamento definido", async () => {
    const paginado = await request(app)
      .get("/api/veiculo")
      .query({ categoria: "ECONOMICO", page: 1, limit: 1 })
      .set(auth(locatario.token));
    expect(paginado.status).toBe(200);
    expect(paginado.body.result).toHaveLength(1);
    expect(paginado.body.pagination).toMatchObject({ page: 1, limit: 1 });

    const invalido = await request(app)
      .get("/api/veiculo")
      .query({ categoria: "LUXO" })
      .set(auth(locatario.token));
    expect(invalido.status).toBe(200);
  });

  it("não permite contornar RN01 usando o filtro PCD", async () => {
    const response = await request(app)
      .post("/api/reserva")
      .set(auth(locatario.token))
      .send({
        idVeiculo: adaptado.id,
        idLocatario: locatario.locatarioId,
        ...futurePeriod(740, 1),
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/necessidade especial/i);
  });
});
