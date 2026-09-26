import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createLocador,
  createLocatario,
  createReserva,
  createVeiculo,
  futurePeriod,
  uniquePlaca,
} from "../helpers";

// FINAL-H-03 — contrato de edição Veiculo x ModeloVeiculo. O contrato é
// derivado do código atual (updateVeiculoSchema: placa/status/garagemId no
// nível raiz + bloco aninhado `modelo`), não copiado do relatório da Task 04.

async function estadoVeiculo(id: string) {
  const v = await prisma.veiculo.findUniqueOrThrow({
    where: { id },
    include: { modeloVeiculo: true },
  });
  return {
    placa: v.placa,
    status: v.status,
    garagemId: v.garagemId,
    idModeloVeiculo: v.idModeloVeiculo,
    modelo: {
      marca: v.modeloVeiculo.marca,
      modelo: v.modeloVeiculo.modelo,
      ano: v.modeloVeiculo.ano,
      cambio: v.modeloVeiculo.cambio,
      capacidade: v.modeloVeiculo.capacidade,
      eletrico: v.modeloVeiculo.eletrico,
      adaptado: v.modeloVeiculo.adaptado,
      categoria: v.modeloVeiculo.categoria,
      valorDiaria: Number(v.modeloVeiculo.valorDiaria),
    },
  };
}

describe("FINAL-H-03 — payload antigo (campos de modelo no nível raiz)", () => {
  it("é rejeitado com erro explícito, sem falso 200 e sem alterar o banco", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const antes = await estadoVeiculo(veiculo.id);

    const payloadAntigo = {
      marca: "Nova",
      modelo: "Outro",
      ano: 2000,
      cambio: "Automatico",
      capacidade: 9,
      valorDiaria: 1,
      eletrico: true,
      adaptado: true,
      categoria: "SUV",
    };

    const res = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send(payloadAntigo);

    expect(res.status).toBe(400);
    expect(await estadoVeiculo(veiculo.id)).toEqual(antes);
  });

  it("campos de modelo misturados a campos físicos derrubam a operação inteira", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const antes = await estadoVeiculo(veiculo.id);

    const res = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ placa: uniquePlaca(), valorDiaria: 1 });

    expect(res.status).toBe(400);
    expect(await estadoVeiculo(veiculo.id)).toEqual(antes);
  });

  it("chaves desconhecidas (idLocador, idModeloVeiculo) são rejeitadas", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const veiculo = await createVeiculo(locadorA.token, locadorA.locadorId);
    const antes = await estadoVeiculo(veiculo.id);

    for (const corpo of [
      { idLocador: locadorB.locadorId },
      { idModeloVeiculo: "11111111-1111-4111-8111-111111111111" },
      { status: "DISPONIVEL", idLocador: locadorB.locadorId },
    ]) {
      const res = await request(app)
        .put(`/api/veiculo/${veiculo.id}`)
        .set("Authorization", `Bearer ${locadorA.token}`)
        .send(corpo);
      expect(res.status).toBe(400);
    }

    expect(await estadoVeiculo(veiculo.id)).toEqual(antes);
  });
});

describe("FINAL-H-03 — contrato atual persiste de verdade", () => {
  it("altera placa, status e todos os atributos do modelo", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const novaPlaca = uniquePlaca();

    const res = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({
        placa: novaPlaca,
        status: "MANUTENCAO",
        modelo: {
          marca: "Renault",
          modelo: "Kwid",
          ano: 2021,
          cambio: "Automatico",
          capacidade: 4,
          eletrico: true,
          adaptado: true,
          categoria: "EXECUTIVO",
          valorDiaria: 199.9,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.placa).toBe(novaPlaca);
    expect(res.body.result.modeloVeiculo.valorDiaria).toBeCloseTo(199.9, 2);

    // 1) banco
    const persistido = await estadoVeiculo(veiculo.id);
    expect(persistido.placa).toBe(novaPlaca);
    expect(persistido.status).toBe("MANUTENCAO");
    expect(persistido.modelo).toEqual({
      marca: "Renault",
      modelo: "Kwid",
      ano: 2021,
      cambio: "Automatico",
      capacidade: 4,
      eletrico: true,
      adaptado: true,
      categoria: "EXECUTIVO",
      valorDiaria: 199.9,
    });

    // 2) refetch pela API
    const refetch = await request(app)
      .get(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`);
    expect(refetch.body.result.modeloVeiculo.marca).toBe("Renault");
    expect(refetch.body.result.modeloVeiculo.capacidade).toBe(4);
  });

  it("PATCH /veiculo/modelos/:id continua editando atributos não identitários", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const res = await request(app)
      .patch(`/api/veiculo/modelos/${veiculo.modeloVeiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ valorDiaria: 77.5, capacidade: 7, categoria: "ESPACOSO" });

    expect(res.status).toBe(200);
    const estado = await estadoVeiculo(veiculo.id);
    expect(estado.modelo.valorDiaria).toBeCloseTo(77.5, 2);
    expect(estado.modelo.capacidade).toBe(7);
    expect(estado.modelo.categoria).toBe("ESPACOSO");
  });
});

describe("FINAL-H-03 — atomicidade", () => {
  it("placa duplicada aborta também a alteração do modelo", async () => {
    const locador = await createLocador();
    const ocupante = await createVeiculo(locador.token, locador.locadorId);
    const alvo = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Honda",
      modelo: "Fit",
      ano: 2019,
    });
    const antes = await estadoVeiculo(alvo.id);

    const res = await request(app)
      .put(`/api/veiculo/${alvo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({
        placa: ocupante.placa,
        modelo: { valorDiaria: 1234.56, capacidade: 2 },
      });

    expect(res.status).toBe(409);
    expect(await estadoVeiculo(alvo.id)).toEqual(antes);
  });
});

describe("FINAL-H-03 — modelo compartilhado e identidade", () => {
  it("atributo não identitário alterado por A é observado por B (modelo compartilhado)", async () => {
    const locador = await createLocador();
    const veiculoA = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Fiat",
      modelo: "Uno",
      ano: 2018,
    });
    const veiculoB = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Fiat",
      modelo: "Uno",
      ano: 2018,
    });

    expect(veiculoA.modeloVeiculo.id).toBe(veiculoB.modeloVeiculo.id);

    const res = await request(app)
      .put(`/api/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ modelo: { valorDiaria: 321.5 } });
    expect(res.status).toBe(200);

    const estadoA = await estadoVeiculo(veiculoA.id);
    const estadoB = await estadoVeiculo(veiculoB.id);
    expect(estadoA.modelo.valorDiaria).toBeCloseTo(321.5, 2);
    expect(estadoB.modelo.valorDiaria).toBeCloseTo(321.5, 2);
    expect(estadoA.idModeloVeiculo).toBe(estadoB.idModeloVeiculo);
  });

  it("mudar a identidade reassocia SOMENTE o veículo editado", async () => {
    const locador = await createLocador();
    const veiculoA = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Ford",
      modelo: "Ka",
      ano: 2017,
    });
    const veiculoB = await createVeiculo(locador.token, locador.locadorId, {
      marca: "Ford",
      modelo: "Ka",
      ano: 2017,
    });
    const modeloOriginal = veiculoA.modeloVeiculo.id;
    expect(veiculoB.modeloVeiculo.id).toBe(modeloOriginal);

    const res = await request(app)
      .put(`/api/veiculo/${veiculoA.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ modelo: { marca: "Ford", modelo: "Ka Sedan", ano: 2017 } });
    expect(res.status).toBe(200);

    const estadoA = await estadoVeiculo(veiculoA.id);
    const estadoB = await estadoVeiculo(veiculoB.id);
    expect(estadoA.idModeloVeiculo).not.toBe(modeloOriginal);
    expect(estadoA.modelo.modelo).toBe("Ka Sedan");
    expect(estadoB.idModeloVeiculo).toBe(modeloOriginal);
    expect(estadoB.modelo.modelo).toBe("Ka");
  });
});

describe("FINAL-H-03 — cross-tenant", () => {
  it("LOCADOR A não edita veículo nem modelo do LOCADOR B", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId);
    const antes = await estadoVeiculo(veiculoB.id);

    const putVeiculo = await request(app)
      .put(`/api/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({ modelo: { valorDiaria: 1 } });
    expect(putVeiculo.status).toBe(403);

    const patchModelo = await request(app)
      .patch(`/api/veiculo/modelos/${veiculoB.modeloVeiculo.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({ valorDiaria: 1 });
    expect(patchModelo.status).toBe(403);

    const deletar = await request(app)
      .delete(`/api/veiculo/${veiculoB.id}`)
      .set("Authorization", `Bearer ${locadorA.token}`);
    expect(deletar.status).toBe(403);

    expect(await estadoVeiculo(veiculoB.id)).toEqual(antes);
  });

  it("não é possível reapontar um veículo para o modelo de outro locador", async () => {
    const locadorA = await createLocador();
    const locadorB = await createLocador();
    const veiculoA = await createVeiculo(locadorA.token, locadorA.locadorId, {
      marca: "Toyota",
      modelo: "Etios",
      ano: 2016,
    });
    const veiculoB = await createVeiculo(locadorB.token, locadorB.locadorId, {
      marca: "Toyota",
      modelo: "Corolla",
      ano: 2016,
    });
    const antes = await estadoVeiculo(veiculoA.id);

    const res = await request(app)
      .patch(`/api/veiculo/${veiculoA.id}/modelo`)
      .set("Authorization", `Bearer ${locadorA.token}`)
      .send({
        idLocador: locadorB.locadorId,
        marca: "Toyota",
        modelo: "Corolla",
        ano: 2016,
        cambio: "Automatico",
        capacidade: 5,
        eletrico: false,
        adaptado: false,
        valorDiaria: 10,
      });
    expect(res.status).toBe(403);

    const depois = await estadoVeiculo(veiculoA.id);
    expect(depois.idModeloVeiculo).toBe(antes.idModeloVeiculo);
    expect(depois.idModeloVeiculo).not.toBe(veiculoB.modeloVeiculo.id);
  });
});

describe("FINAL-H-03 — CROSS-02: catálogo x finanças", () => {
  it("reserva antiga mantém o valor contratado; nova reserva usa a nova diária", async () => {
    const locador = await createLocador();
    const locatario = await createLocatario();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const antiga = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
    );
    const valorContratado = Number(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: antiga.id } }))
        .valorTotal,
    );

    const reajuste = await request(app)
      .put(`/api/veiculo/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ modelo: { valorDiaria: 500 } });
    expect(reajuste.status).toBe(200);

    expect(
      Number(
        (await prisma.reserva.findUniqueOrThrow({ where: { id: antiga.id } }))
          .valorTotal,
      ),
    ).toBeCloseTo(valorContratado, 2);

    const nova = await createReserva(
      locatario.token,
      veiculo.id,
      locatario.locatarioId,
      futurePeriod(15, 1),
    );
    const valorNova = Number(
      (await prisma.reserva.findUniqueOrThrow({ where: { id: nova.id } }))
        .valorTotal,
    );
    expect(valorNova).toBeCloseTo(500, 2);

    // Pagar a antiga cobra exatamente o valor contratado antigo.
    const pagamento = await request(app)
      .post(`/api/reserva/${antiga.id}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ metodoPagamento: "PIX" });
    expect(pagamento.status).toBe(202);
    expect(pagamento.body.result.valorCobrado).toBeCloseTo(valorContratado, 2);

    const cobranca = await prisma.cobrancaReserva.findFirstOrThrow({
      where: { idReserva: antiga.id, tipo: "PAGAMENTO_RESERVA" },
    });
    expect(Number(cobranca.valor)).toBeCloseTo(valorContratado, 2);
  });
});
