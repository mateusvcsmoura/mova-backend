// Acrescenta a frota extra de demonstração (demo-frota.ts) a um mova_dev já populado, SEM apagar nada:
// cria as garagens e os veículos que faltam e envia fotos só aos veículos que ainda não têm imagem.
// Idempotente: rodar de novo não duplica nada. Uso: npm run db:seed:demo:frota
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FOTOS_DIR, FOTOS_POR_PLACA, GARAGENS_EXTRA, VEICULOS_EXTRA, mimeDaFoto } from "./demo-frota.js";
import { carregarCredenciaisMinio } from "./minio-credenciais.js";

if (process.env.NODE_ENV !== "development") {
  console.error(`Bloqueado: NODE_ENV=${process.env.NODE_ENV ?? "(vazio)"} (esperado development).`);
  process.exit(1);
}
carregarCredenciaisMinio();

const { Cargo, CategoriaVeiculo, StatusGaragem } = await import("@prisma/client");
const { prisma } = await import("../../src/database/prisma.js");
const { env } = await import("../../src/config/env.js");
const { VeiculoImagemService } = await import("../../src/services/veiculo-imagem.js");
const { S3StorageProvider } = await import("../../src/infra/media/storage-provider.js");

async function falhar(msg: string): Promise<never> {
  console.error(msg);
  await prisma.$disconnect();
  process.exit(1);
}
const [{ current_database: banco }] = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
if (banco !== "mova_dev") await falhar(`Bloqueado: conexão em ${banco} (esperado mova_dev).`);
if (!env.MEDIA_S3_ACCESS_KEY_ID || !env.MEDIA_S3_SECRET_ACCESS_KEY) await falhar("Credenciais do MinIO indisponíveis: suba o container do MinIO.");

const conta = async (email: string) =>
  (await prisma.conta.findUnique({ where: { email } }))?.id ?? falhar(`Conta ${email} não encontrada: rode antes o seed de demonstração.`);
const donos = { locador: await conta("locadora.demo@mova.local"), parceiro: await conta("locadora.parceira@mova.local") };
const criadas = { garagens: 0, veiculos: 0, fotos: 0 };

// Garagens
for (const g of GARAGENS_EXTRA) {
  if (await prisma.garagem.findFirst({ where: { nome: g.nome, idLocador: donos[g.dono] } })) continue;
  await prisma.garagem.create({ data: { idLocador: donos[g.dono], nome: g.nome, endereco: g.endereco, capacidade: g.capacidade, veiculosAlocados: 0, acessibilidade: g.acessibilidade, status: StatusGaragem.ATIVA } });
  criadas.garagens++;
}

// Veículos (modelo próprio, histórico de status e ocupação da garagem, como no seed)
for (const v of VEICULOS_EXTRA) {
  if (await prisma.veiculo.findUnique({ where: { placa: v.placa } })) continue;
  const idLocador = donos[v.dono];
  const garagem = (await prisma.garagem.findFirst({ where: { nome: v.garagem, idLocador } })) ?? (await falhar(`Garagem ${v.garagem} não encontrada para ${v.placa}.`));
  if (garagem.veiculosAlocados >= garagem.capacidade) await falhar(`Garagem ${v.garagem} sem vaga para ${v.placa}.`);
  await prisma.$transaction(async (tx) => {
    const modelo = await tx.modeloVeiculo.create({
      data: { idLocador, marca: v.marca, modelo: v.modelo, ano: v.ano, cambio: v.cambio, capacidade: v.capacidade, eletrico: v.eletrico ?? false, adaptado: v.adaptado ?? false, categoria: CategoriaVeiculo[v.categoria], valorDiaria: v.valorDiaria },
    });
    const veiculo = await tx.veiculo.create({ data: { idLocador, idModeloVeiculo: modelo.id, garagemId: garagem.id, placa: v.placa } });
    await tx.veiculoStatusHistorico.create({ data: { idVeiculo: veiculo.id, status: veiculo.status } });
    await tx.garagem.update({ where: { id: garagem.id }, data: { veiculosAlocados: { increment: 1 } } });
  });
  criadas.veiculos++;
}

// Fotos: só para quem ainda não tem imagem, enviadas pelo serviço real (validação e MinIO)
const service = new VeiculoImagemService(new S3StorageProvider());
const fotos = { ...FOTOS_POR_PLACA, ...Object.fromEntries(VEICULOS_EXTRA.map((v) => [v.placa, v.foto])) };
for (const [placa, foto] of Object.entries(fotos)) {
  const veiculo = await prisma.veiculo.findUnique({ where: { placa }, select: { id: true, idLocador: true, _count: { select: { imagens: true } } } });
  if (!veiculo || veiculo._count.imagens > 0) continue;
  await service.criar(veiculo.id, readFileSync(resolve(FOTOS_DIR, foto.arquivo)), mimeDaFoto(foto.arquivo), foto.alt, { id: veiculo.idLocador, cargo: Cargo.LOCADOR });
  criadas.fotos++;
}

console.log(`Frota de demonstração: ${criadas.garagens} garagens, ${criadas.veiculos} veículos e ${criadas.fotos} fotos acrescentados (nada apagado).`);
await prisma.$disconnect();
