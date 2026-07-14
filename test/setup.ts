import { beforeAll, afterAll } from "vitest";
import { prisma } from "../src/database/prisma";

// Limpa todas as tabelas respeitando as foreign keys do schema.prisma.
// Roda uma vez antes de cada arquivo de teste, garantindo isolamento.
async function resetDatabase() {
  // Favorito não é limpo explicitamente: cascade de Veiculo/Locatario cobre.
  await prisma.avaliacao.deleteMany();
  await prisma.localizacao.deleteMany();
  await prisma.reservaServico.deleteMany();
  await prisma.cobrancaReserva.deleteMany();
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

// Fecha o pool de conexões (adapter PrismaPg/node-postgres) ao fim de cada
// arquivo. Sem isso o vitest mata o worker com sockets ainda abertos, o que no
// Windows + pool de forks gera "Worker exited unexpectedly" de forma
// intermitente. ponytail: teardown por arquivo, não por teste.
afterAll(async () => {
  await prisma.$disconnect();
});
