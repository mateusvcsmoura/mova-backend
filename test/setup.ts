import { beforeAll, afterAll } from "vitest";
import { prisma } from "../src/database/prisma";

// Trava de segurança: a suíte TRUNCA todas as tabelas. Só pode rodar quando o
// processo está explicitamente em modo de teste, porque é NODE_ENV=test que faz
// src/database/prisma.ts escolher DATABASE_URL_TEST. Sem esta checagem, rodar o
// arquivo por outro caminho (script, tsx, dev server) apagaria o banco de
// desenvolvimento/produção silenciosamente.
function assertAmbienteDeTeste() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `Reset de banco bloqueado: NODE_ENV="${process.env.NODE_ENV ?? "(vazio)"}". ` +
        "A suíte só pode rodar com NODE_ENV=test (o vitest define isso sozinho). " +
        "Ver auditoria/AMBIENTES.md.",
    );
  }

  if (!process.env.DATABASE_URL_TEST) {
    throw new Error(
      "Reset de banco bloqueado: DATABASE_URL_TEST não está definida. " +
        "Ver auditoria/AMBIENTES.md.",
    );
  }

  // Aviso explícito quando teste e desenvolvimento compartilham a mesma
  // instância: é a configuração atual e foi uma decisão consciente, mas nunca
  // deve acontecer por engano. Rode `npm run db:seed` depois da suíte.
  if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) {
    console.warn(
      "[setup] ATENÇÃO: DATABASE_URL_TEST == DATABASE_URL. A suíte vai apagar " +
        "o banco compartilhado com dev/Render. Rode `npm run db:seed` ao final " +
        "(o script posttest já faz isso). Ver auditoria/AMBIENTES.md.",
    );
  }
}

// Limpa todas as tabelas respeitando as foreign keys do schema.prisma.
// Roda uma vez antes de cada arquivo de teste, garantindo isolamento.
async function resetDatabase() {
  // Favorito não é limpo explicitamente: cascade de Veiculo/Locatario cobre.
  await prisma.avaliacao.deleteMany();
  await prisma.localizacao.deleteMany();
  await prisma.reservaServico.deleteMany();
  await prisma.cobrancaReserva.deleteMany();
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
  assertAmbienteDeTeste();
  await resetDatabase();
});

// Fecha o pool de conexões (adapter PrismaPg/node-postgres) ao fim de cada
// arquivo. Sem isso o vitest mata o worker com sockets ainda abertos, o que no
// Windows + pool de forks gera "Worker exited unexpectedly" de forma
// intermitente. ponytail: teardown por arquivo, não por teste.
afterAll(async () => {
  await prisma.$disconnect();
});
