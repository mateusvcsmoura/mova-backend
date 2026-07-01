import { beforeAll } from "vitest";
import { prisma } from "../src/database/prisma";

// Limpa todas as tabelas respeitando as foreign keys do schema.prisma.
// Roda uma vez antes de cada arquivo de teste, garantindo isolamento.
async function resetDatabase() {
  await prisma.avaliacao.deleteMany();
  await prisma.localizacao.deleteMany();
  await prisma.reservaServico.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.servicoOpcional.deleteMany();
  await prisma.veiculo.deleteMany();
  await prisma.modeloVeiculo.deleteMany();
  await prisma.garagem.deleteMany();
  await prisma.bloqueioLocatario.deleteMany();
  await prisma.locatario.deleteMany();
  await prisma.locador.deleteMany();
  await prisma.deficiencia.deleteMany();
  await prisma.conta.deleteMany();
}

beforeAll(async () => {
  await resetDatabase();
});
