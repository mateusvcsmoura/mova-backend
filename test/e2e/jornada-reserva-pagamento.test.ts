import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  createGaragem,
  createLocador,
  createLocatario,
  createVeiculo,
  createServico,
  uniqueCnh,
  LocadorContext,
  LocatarioContext,
} from "../helpers";

// TASK 04 — jornada completa, na ordem em que o usuário a percorre:
// login -> veículo -> garagem -> data/hora -> reserva -> pagamento sandbox ->
// webhook assinado -> reserva confirmada + código de desbloqueio.
//
// Cada passo usa a API real; nada é escrito direto no banco para "ajudar" o
// fluxo. Ver auditoria/PAGAMENTO.md.

const VALOR_DIARIA = 180.5;
const DIARIAS = 3;

describe("E2E — jornada da reserva até o pagamento confirmado", () => {
  let locador: LocadorContext;
  let locatario: LocatarioContext;

  beforeAll(async () => {
    locador = await createLocador();
    locatario = await createLocatario();
  });

  it("percorre a jornada inteira e confirma a reserva pelo webhook do gateway", async () => {
    // 1. Login — createLocatario já autentica; aqui se confirma que o token vale.
    const perfil = await request(app)
      .get("/api/conta/auth/me")
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(perfil.status).toBe(200);

    // 2. Garagem do locador.
    const garagem = await createGaragem(locador.token, locador.locadorId);
    expect(garagem.id).toBeTruthy();

    // 3. Veículo, com a diária que define o preço.
    const veiculo = await createVeiculo(locador.token, locador.locadorId, {
      modelo: "Argo-E2E",
      valorDiaria: VALOR_DIARIA,
    });
    const servico = await createServico({
      nome: "Proteção E2E",
      descricao: "Cobertura adicional da jornada",
      valor: 35.5,
    });

    const alocacao = await request(app)
      .post(`/api/garagem/${garagem.id}/veiculos/${veiculo.id}`)
      .set("Authorization", `Bearer ${locador.token}`);
    // A alocação responde 204 (sem corpo).
    expect(alocacao.status).toBe(204);

    // 4. O locatário escolhe o veículo e então vê a garagem dele.
    const listagem = await request(app)
      .get("/api/veiculo")
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(listagem.status).toBe(200);

    const garagemDoVeiculo = await request(app)
      .get(`/api/garagem/${garagem.id}`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(garagemDoVeiculo.status).toBe(200);
    expect(garagemDoVeiculo.body.result.status).toBe("ATIVA");

    // 5. Data/hora (RN05: instantes em UTC).
    const dataHoraInicio = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dataHoraFim = new Date(
      dataHoraInicio.getTime() + DIARIAS * 24 * 60 * 60 * 1000,
    );

    // 6. Reserva — o cliente NÃO envia valor.
    const criada = await request(app)
      .post("/api/reserva")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        idVeiculo: veiculo.id,
        idLocatario: locatario.locatarioId,
        dataHoraInicio: dataHoraInicio.toISOString(),
        dataHoraFim: dataHoraFim.toISOString(),
        idGaragemRetirada: garagem.id,
        idGaragemDevolucao: garagem.id,
        servicosIds: [servico.id],
      });

    expect(criada.status).toBe(201);
    const reservaId = criada.body.result.id as string;

    // O backend calculou o valor: diária × diárias.
    expect(criada.body.result.valorTotal).toBe(VALOR_DIARIA * DIARIAS + servico.valor);
    expect(criada.body.result.servicos).toEqual([
      expect.objectContaining({ idServico: servico.id, valor: servico.valor }),
    ]);
    expect(criada.body.result.status).toBe("AGUARDANDO_PAGAMENTO");
    expect(criada.body.result.statusPagamento).toBe("AGUARDANDO_PAGAMENTO");
    expect(criada.body.result.codigoDesbloqueio).toBeFalsy();

    // 7. Condutor adicional — reserva já existe, mas ainda não iniciou.
    const condutor = await request(app)
      .post(`/api/reserva/${reservaId}/condutores`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ nome: "Condutor E2E", cnh: uniqueCnh() });
    expect(condutor.status).toBe(201);

    const condutores = await request(app)
      .get(`/api/reserva/${reservaId}/condutores`)
      .set("Authorization", `Bearer ${locatario.token}`);
    expect(condutores.body.result).toHaveLength(1);

    // 8. Pagamento em sandbox — só o método e os dados de teste. O desfecho é
    // do backend; o webhook assinado do gateway simulado é quem confirma.
    const pagamento = await request(app)
      .post(`/api/reserva/${reservaId}/pagamento`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({
        metodoPagamento: "CARTAO_CREDITO",
        cartao: {
          numero: "4111111111111234",
          nome: "FULANO DE TAL",
          validade: "12/30",
          cvv: "123",
        },
      });

    expect(pagamento.status).toBe(202);
    expect(pagamento.body.result.valorCobrado).toBe(VALOR_DIARIA * DIARIAS + servico.valor);

    // 9. Confirmação.
    const consulta = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(consulta.status).toBe(200);
    expect(consulta.body.result.statusPagamento).toBe("SUCESSO");
    expect(consulta.body.result.status).toBe("CONFIRMADA");
    expect(consulta.body.result.codigoDesbloqueio).toMatch(
      /^[A-Z0-9]{4}-[A-Z0-9]{4}$/,
    );

    // A cobrança do pagamento ficou registrada com o valor do domínio.
    const cobranca = await prisma.cobrancaReserva.findFirstOrThrow({
      where: { idReserva: reservaId, tipo: "PAGAMENTO_RESERVA" },
    });
    expect(Number(cobranca.valor)).toBe(VALOR_DIARIA * DIARIAS + servico.valor);

    // 9. Desbloqueio (TASK 05). O cliente recupera o código pela própria API —
    // nada de estado local — e só então desbloqueia. Antes disso, a janela de
    // uso é aberta (arranjo de cenário: a retirada seria daqui a alguns dias).
    const codigo: string = consulta.body.result.codigoDesbloqueio;

    await prisma.reserva.update({
      where: { id: reservaId },
      data: {
        dataHoraInicio: new Date(Date.now() - 60 * 60 * 1000),
        dataHoraFim: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const desbloqueio = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(desbloqueio.status).toBe(200);
    expect(desbloqueio.body.result.codigoUsadoEm).not.toBeNull();
    expect(desbloqueio.body.result.status).toBe("EM_ANDAMENTO");

    // 10. Uso único: repetir o mesmo código não reabre o veículo, e a consulta
    // seguinte (fonte de verdade da tela) segue EM_ANDAMENTO.
    const repetido = await request(app)
      .post(`/api/reserva/${reservaId}/desbloqueio`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ codigo });

    expect(repetido.status).toBe(409);

    const aposDesbloqueio = await request(app)
      .get(`/api/reserva/${reservaId}`)
      .set("Authorization", `Bearer ${locatario.token}`);

    expect(aposDesbloqueio.body.result.status).toBe("EM_ANDAMENTO");
    expect(aposDesbloqueio.body.result.codigoUsadoEm).not.toBeNull();
  });
});
