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

  it("inclui os dados do veículo", async () => {
    const payload = await service.buildPayload(makeReserva());
    expect(payload.veiculo).toEqual({
      marca: "Fiat",
      modelo: "Argo",
      ano: 2022,
      placa: "ABC1234",
    });
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
  it("gera HTML e texto contendo as principais informações", async () => {
    const payload = await service.buildPayload(makeReserva());
    const { subject, html, text } = renderReservaReport(payload);

    expect(subject).toContain("Relatório da sua reserva");

    // Veículo
    expect(html).toContain("Fiat");
    expect(html).toContain("Argo");
    expect(html).toContain("ABC1234");
    // Locador
    expect(html).toContain("Locadora Mova Ltda");
    // Locatário
    expect(html).toContain("João Locatário");
    expect(html).toContain("joao@test.local");
    // Serviços adicionais
    expect(html).toContain("Seguro adicional");
    expect(html).toContain("Tanque cheio");
    // Retirada e devolução
    expect(html).toContain("Garagem Centro");
    expect(html).toContain("Garagem Aeroporto");
    // Código de desbloqueio
    expect(html).toContain("ABCD-2345");

    // Versão texto também presente
    expect(text).toContain("VEÍCULO");
    expect(text).toContain("Fiat Argo");
    expect(text).toContain("Seguro adicional");
  });

  it("mostra mensagem quando não há serviços adicionais", async () => {
    const payload = await service.buildPayload(makeReserva({ servicos: [] }));
    const { html } = renderReservaReport(payload);
    expect(html).toContain("Nenhum serviço adicional contratado");
  });

  it("escapa HTML de campos de texto (evita injeção)", async () => {
    const payload = await service.buildPayload(makeReserva());
    payload.locatario.nome = "<script>alert(1)</script>";
    const { html } = renderReservaReport(payload);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
