import { beforeAll } from "vitest";
import { prisma } from "../src/database/prisma";
import { assertSafeTestEnvironment, TEST_DATABASE_NAME } from "../src/config/test-environment";

async function assertAmbienteDeTeste() {
  assertSafeTestEnvironment();
  const [conexao] = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  if (conexao?.current_database !== TEST_DATABASE_NAME) {
    throw new Error(`Reset bloqueado: conexão efetiva está em ${conexao?.current_database ?? "(desconhecido)"}.`);
  }
}

async function resetDatabase() {
  // Favorito não é limpo explicitamente: cascade de Veiculo/Locatario cobre.
  await prisma.avaliacao.deleteMany();
  await prisma.localizacao.deleteMany();
  await prisma.reservaServico.deleteMany();
  await prisma.cobrancaReserva.deleteMany();
  await prisma.eventoFinanceiroSandbox.deleteMany();
  await prisma.recuperacaoSenha.deleteMany();
  await prisma.notificacaoReserva.deleteMany();
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
  await assertAmbienteDeTeste();
  await resetDatabase();
});
