import { describe, it, expect } from "vitest";

import { ReservaReportService } from "../../src/services/reserva-report";
import { renderReservaReport } from "../../src/templates/reserva-report.template";
import type { ReservaResponse } from "../../src/repositories/contracts/reserva.contract";
import type { IVeiculoRepository } from "../../src/repositories/veiculo.repository";
import type { IContaRepository } from "../../src/repositories/conta.repository";
import type { ILocadorRepository } from "../../src/repositories/locador.repository";
import type { IGaragemRepository } from "../../src/repositories/garagem.repository";

// ---- Fakes mínimos dos repositórios (apenas o que o builder consome) --------

const veiculoRepo = {
  findById: async (id: string) => ({
    id,
    idLocador: "loc-1",
    idModeloVeiculo: "mod-1",
    modeloVeiculo: {
      id: "mod-1",
      idLocador: "loc-1",
      marca: "Fiat",
      modelo: "Argo",
      ano: 2022,
      cambio: "Manual",
      capacidade: 5,
      eletrico: false,
      adaptado: false,
      categoria: "ECONOMICO",
      criadoEm: new Date(),
    },
    garagemId: "gar-1",
    placa: "ABC1234",
    status: "RESERVADO",
    criadoEm: new Date(),
  }),
} as unknown as IVeiculoRepository;

const contaRepo = {
  findById: async (id: string) => ({
    id,
    nome: "João Locatário",
    email: "joao@test.local",
    telefone: null,
    criadaEm: new Date(),
    cep: "12345-678",
    endereco: "Rua Teste, 1",
    cargo: "LOCATARIO",
  }),
} as unknown as IContaRepository;

const locadorRepo = {
  findById: async (id: string) => ({
    id,
    empresa: "Locadora Mova Ltda",
    cnpj: "12345678000199",
  }),
} as unknown as ILocadorRepository;

const garagemRepo = {
  findById: async (id: string) => ({
    id,
    idLocador: "loc-1",
    nome: id === "gar-1" ? "Garagem Centro" : "Garagem Aeroporto",
    endereco:
      id === "gar-1" ? "Av. Central, 100" : "Rod. do Aeroporto, 5000",
    capacidade: 10,
    veiculosAlocados: 1,
    acessibilidade: true,
    criadaEm: new Date(),
    atualizadoEm: new Date(),
    locador: { id: "loc-1", empresa: "Locadora Mova Ltda", cnpj: "x" },
    veiculos: [],
  }),
} as unknown as IGaragemRepository;

function makeReserva(overrides: Partial<ReservaResponse> = {}): ReservaResponse {
  const inicio = new Date("2026-08-01T10:00:00.000Z");
  const fim = new Date("2026-08-04T10:00:00.000Z"); // 3 dias
  return {
    id: "11111111-2222-3333-4444-555555555555",
    idVeiculo: "veic-1",
    idLocatario: "locatario-1",
    idGaragemRetirada: "gar-1",
    idGaragemDevolucao: "gar-2",
    dataHoraInicio: inicio,
    dataHoraFim: fim,
    criadaEm: new Date("2026-07-01T09:00:00.000Z"),
    valorTotal: 350,
    status: "CONFIRMADA",
    statusPagamento: "SUCESSO",
    metodoPagamento: "PIX",
    codigoDesbloqueio: "ABCD-2345",
    codigoGeradoEm: new Date(),
    codigoUsadoEm: null,
    servicos: [
      { idServico: "s1", nome: "Seguro adicional", descricao: "Cobertura total", valor: 80 },
      { idServico: "s2", nome: "Tanque cheio", descricao: "Combustível", valor: 20 },
    ],
    atualizadoEm: new Date(),
    ...overrides,
  };
}

const service = new ReservaReportService(
  veiculoRepo,
  contaRepo,
  locadorRepo,
  garagemRepo,
);

describe("ReservaReportService.buildPayload", () => {
  it("gera o payload com valores calculados corretamente", async () => {
    const payload = await service.buildPayload(makeReserva());

    expect(payload.reserva.id).toBe("11111111-2222-3333-4444-555555555555");
    expect(payload.reserva.dias).toBe(3);
    // valorTotal 350, serviços 100 -> base 250
    expect(payload.reserva.valorServicos).toBe(100);
    expect(payload.reserva.valorBase).toBe(250);
    expect(payload.reserva.valorTotal).toBe(350);
    expect(payload.reserva.status).toBe("CONFIRMADA");
    expect(payload.reserva.codigoDesbloqueio).toBe("ABCD-2345");
  });

  it("inclui os dados do veículo (com atributos do modelo)", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.veiculo).toEqual({
      marca: "Fiat",
      modelo: "Argo",
      ano: 2022,
      placa: "ABC1234",
      categoria: "ECONOMICO",
      cambio: "Manual",
      capacidade: 5,
      eletrico: false,
      adaptado: false,
    });
  });

  it("inclui o método de pagamento no payload", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.reserva.metodoPagamento).toBe("PIX");
  });

  it("inclui os dados do locador (empresa)", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.locador.empresa).toBe("Locadora Mova Ltda");
  });

  it("inclui nome e e-mail do locatário", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.locatario).toEqual({
      nome: "João Locatário",
      email: "joao@test.local",
    });
  });

  it("inclui os pontos de retirada e devolução", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.retirada).toEqual({
      garagem: "Garagem Centro",
      endereco: "Av. Central, 100",
    });
    expect(payload.devolucao).toEqual({
      garagem: "Garagem Aeroporto",
      endereco: "Rod. do Aeroporto, 5000",
    });
  });

  it("inclui os serviços adicionais contratados", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.servicos).toHaveLength(2);
    expect(payload.servicos[0].nome).toBe("Seguro adicional");
  });

  it("lida com reserva sem serviços adicionais (base = total)", async () => {
    const payload = await service.buildPayload(
      makeReserva({ servicos: [], valorTotal: 200 }),
    );
    expect(payload.reserva.valorServicos).toBe(0);
    expect(payload.reserva.valorBase).toBe(200);
    expect(payload.servicos).toHaveLength(0);
  });

  it("lida com garagens ausentes", async () => {
    const payload = await service.buildPayload(
      makeReserva({ idGaragemRetirada: null, idGaragemDevolucao: null }),
    );
    expect(payload.retirada).toBeNull();
    expect(payload.devolucao).toBeNull();
  });
});

describe("renderReservaReport (template)", () => {
  it("gera assunto de confirmação com id curto", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { subject } = renderReservaReport(payload);
    expect(subject).toContain("Reserva confirmada");
    expect(subject).toContain("Mova");
    // Id curto (primeiro bloco do UUID), não o UUID completo.
    expect(subject).toContain("11111111");
    expect(subject).not.toContain("11111111-2222");
  });

  it("HTML contém identidade visual e confirmação", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    expect(html).toContain("MOVA");
    expect(html).toContain("Mobilidade que acompanha você");
    expect(html).toContain("Reserva confirmada");
    // Saudação personalizada com o nome.
    expect(html).toContain("Olá, João Locatário");
  });

  it("HTML contém as datas de retirada e devolução", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    // 01 AGO 2026 / 04 AGO 2026 (mês abreviado em caixa alta).
    expect(html).toContain("01 AGO 2026");
    expect(html).toContain("04 AGO 2026");
    expect(html).toContain("3 dias de reserva");
  });

  it("HTML contém o veículo e seus atributos", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    expect(html).toContain("Fiat Argo");
    expect(html).toContain("2022");
    expect(html).toContain("ABC1234");
    expect(html).toContain("Manual");
    expect(html).toContain("Econômico");
  });

  it("HTML mostra badges de elétrico/adaptado apenas quando aplicável", async () => {
    const base = await service.buildPayload(makeReserva());
    expect(renderReservaReport(base).html).not.toContain("Elétrico");

    const payload = await service.buildPayload(makeReserva());
    payload.veiculo.eletrico = true;
    payload.veiculo.adaptado = true;
    const { html } = renderReservaReport(payload);
    expect(html).toContain("Elétrico");
    expect(html).toContain("Adaptado");
  });

  it("HTML contém as garagens de retirada e devolução com endereço", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    expect(html).toContain("Garagem Centro");
    expect(html).toContain("Av. Central, 100");
    expect(html).toContain("Garagem Aeroporto");
    expect(html).toContain("Rod. do Aeroporto, 5000");
  });

  it("HTML destaca o código de desbloqueio e explica o uso", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    expect(html).toContain("ABCD-2345");
    expect(html).toContain("Código de desbloqueio");
    expect(html).toContain("desbloquear o veículo");
  });

  it("HTML mostra mensagem quando não há código de desbloqueio", async () => {
    const payload = await service.buildPayload(
      makeReserva({ codigoDesbloqueio: null }),
    );
    const { html, text } = renderReservaReport(payload);
    expect(html).toContain("disponibilizado em breve");
    expect(text).toContain("disponibilizado em breve");
  });

  it("HTML contém o resumo financeiro com total e método", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    expect(html).toContain("Resumo do pagamento");
    expect(html).toContain("R$");
    expect(html).toContain("Total");
    // Método de pagamento formatado.
    expect(html).toContain("PIX");
  });

  it("HTML mantém o UUID completo na área de detalhes", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { html } = renderReservaReport(payload);
    expect(html).toContain("11111111-2222-3333-4444-555555555555");
  });

  it("versão texto contém as mesmas informações-chave", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { text } = renderReservaReport(payload);
    expect(text).toContain("RESERVA CONFIRMADA");
    expect(text).toContain("Olá, João Locatário");
    expect(text).toContain("Fiat Argo");
    expect(text).toContain("ABC1234");
    expect(text).toContain("Garagem Centro");
    expect(text).toContain("Garagem Aeroporto");
    expect(text).toContain("ABCD-2345");
    expect(text).toContain("Seguro adicional");
    expect(text).toContain("01 AGO 2026");
    expect(text).toContain("PIX");
    expect(text).toContain("Total");
  });

  it("oculta a seção de serviços quando não há adicionais (sem tabela vazia)", async () => {
    const semServicos = await service.buildPayload(
      makeReserva({ servicos: [] }),
    );
    const comServicos = await service.buildPayload(makeReserva());

    const count = (s: string, sub: string) => s.split(sub).length - 1;

    // "Serviços adicionais" aparece no resumo financeiro sempre; a SEÇÃO de
    // serviços (mesmo rótulo) só quando há itens -> 1 ocorrência a menos.
    expect(count(renderReservaReport(comServicos).html, "Serviços adicionais")).toBe(
      count(renderReservaReport(semServicos).html, "Serviços adicionais") + 1,
    );
    // Sem itens, nenhuma linha de serviço vaza.
    expect(renderReservaReport(semServicos).html).not.toContain("Seguro adicional");
    // No texto há uma mensagem curta em vez de lista vazia.
    expect(renderReservaReport(semServicos).text).toContain(
      "Nenhum serviço adicional",
    );
  });

  it("não vaza 'undefined' nem 'null' para o usuário", async () => {
    const payload = await service.buildPayload(
      makeReserva({
        idGaragemRetirada: null,
        idGaragemDevolucao: null,
        metodoPagamento: null,
      }),
    );
    const { html, text } = renderReservaReport(payload);
    expect(html).not.toContain("undefined");
    expect(html.toLowerCase()).not.toContain(">null<");
    expect(text).not.toContain("undefined");
    // Sem garagem -> "Não informado", nunca null cru.
    expect(html).toContain("Não informado");
  });

  it("preserva acentuação e caracteres especiais", async () => {
    const payload = await service.buildPayload(makeReserva());
    payload.locatario.nome = "Ção Açaí São Paulo";
    payload.locador.empresa = "Móvel & Cia";
    const { html, text } = renderReservaReport(payload);
    expect(text).toContain("Ção Açaí São Paulo");
    expect(text).toContain("Móvel & Cia");
    // No HTML o & vira entidade, mas os acentos permanecem legíveis.
    expect(html).toContain("Ção Açaí São Paulo");
    expect(html).toContain("Móvel &amp; Cia");
  });

  it("escapa HTML de campos de texto (evita injeção)", async () => {
    const payload = await service.buildPayload(makeReserva());
    payload.locatario.nome = "<script>alert(1)</script>";
    const { html } = renderReservaReport(payload);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("suporta locale en/es sem quebrar (i18n do texto ao usuário)", async () => {
    const payload = await service.buildPayload(makeReserva());
    const en = renderReservaReport(payload, "en");
    expect(en.subject).toContain("Booking confirmed");
    expect(en.html).toContain("Your vehicle");
    const es = renderReservaReport(payload, "es");
    expect(es.html).toContain("Resumen del viaje");
  });
});
