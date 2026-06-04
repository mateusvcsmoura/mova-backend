import { prisma } from "../../src/database/prisma.js";

function assertSafeToReset() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Reset bloqueado: NODE_ENV=production.");
  }
}

async function main() {
  assertSafeToReset();

  console.log("Iniciando reset total do banco...\n");

  const [
    avaliacoes,
    localizacoes,
    reservas,
    veiculos,
    garagens,
    locatarios,
    locadores,
    deficiencias,
    contas,
  ] = await prisma.$transaction([
    prisma.avaliacao.deleteMany(),
    prisma.localizacao.deleteMany(),
    prisma.reserva.deleteMany(),
    prisma.veiculo.deleteMany(),
    prisma.garagem.deleteMany(),
    prisma.locatario.deleteMany(),
    prisma.locador.deleteMany(),
    prisma.deficiencia.deleteMany(),
    prisma.conta.deleteMany(),
  ]);

  console.log("Reset concluido com sucesso.\n");
  console.log("Resumo de registros removidos:");
  console.log(`- Avaliacoes: ${avaliacoes.count}`);
  console.log(`- Localizacoes: ${localizacoes.count}`);
  console.log(`- Reservas: ${reservas.count}`);
  console.log(`- Veiculos: ${veiculos.count}`);
  console.log(`- Garagens: ${garagens.count}`);
  console.log(`- Locatarios: ${locatarios.count}`);
  console.log(`- Locadores: ${locadores.count}`);
  console.log(`- Deficiencias: ${deficiencias.count}`);
  console.log(`- Contas: ${contas.count}`);
}

main()
  .catch((e) => {
    console.error("Erro ao executar reset:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
