import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn() },
  tx: {
    $executeRaw: vi.fn(),
    veiculo: { findUnique: vi.fn() },
    locatario: { findUnique: vi.fn() },
    reserva: { count: vi.fn(), create: vi.fn() },
  },
  toResponse: vi.fn((value) => value),
}));

vi.mock("../../src/database/prisma.js", () => ({ prisma: mocks.prisma }));
vi.mock("../../src/repositories/mappers/reserva.mapper.js", () => ({
  ReservaMapper: { toResponse: mocks.toResponse },
}));

import { PrismaReservaRepository } from "../../src/repositories/prisma/prisma.reserva.repository.js";

describe("PrismaReservaRepository.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.tx.$executeRaw.mockResolvedValue(undefined);
    mocks.tx.veiculo.findUnique
      .mockResolvedValueOnce({ garagemId: "garagem-1", idLocador: "conta-locador" })
      .mockResolvedValueOnce({ garagemId: "garagem-1" });
    mocks.tx.reserva.count.mockResolvedValue(0);
    mocks.tx.reserva.create.mockResolvedValue({ id: "reserva-1" });
  });

  it("não inicia segunda consulta na mesma transação antes da primeira terminar", async () => {
    let liberarLocatario!: (value: { id: string }) => void;
    let sinalizarLocatario!: () => void;
    const locatarioIniciado = new Promise<void>((resolve) => {
      sinalizarLocatario = resolve;
    });

    mocks.tx.locatario.findUnique.mockImplementation(() => {
      sinalizarLocatario();
      return new Promise((resolve) => {
        liberarLocatario = resolve;
      });
    });

    const repository = new PrismaReservaRepository();
    const criacao = repository.create({
      idVeiculo: "veiculo-1",
      idLocatario: "conta-locatario",
      idGaragemRetirada: "garagem-1",
      dataHoraInicio: new Date("2030-01-01T10:00:00.000Z"),
      dataHoraFim: new Date("2030-01-02T10:00:00.000Z"),
      valorTotal: 100,
    });

    await locatarioIniciado;
    expect(mocks.tx.veiculo.findUnique).toHaveBeenCalledTimes(1);

    liberarLocatario({ id: "conta-locatario" });
    await criacao;
  });
});
