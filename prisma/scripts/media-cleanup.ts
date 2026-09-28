import { prisma } from "../../src/database/prisma.js";
import { env } from "../../src/config/env.js";
import { S3StorageProvider } from "../../src/infra/media/storage-provider.js";
import { selecionarOrfaos } from "../../src/infra/media/media-cleanup.js";
import { StatusGaragem, StatusVeiculo } from "@prisma/client";

const apply = process.argv.includes("--apply");
const storage = new S3StorageProvider();

try {
  const [referenciadas, privadas, publicas] = await Promise.all([
    prisma.veiculoImagem.findMany({
      select: {
        objectKey: true,
        veiculo: { select: { id: true, status: true, garagem: { select: { status: true } } } },
      },
    }),
    storage.listObjects({ bucket: env.MEDIA_PRIVATE_BUCKET }),
    storage.listObjects({ bucket: env.MEDIA_PUBLIC_BUCKET }),
  ]);
  const keys = new Set(referenciadas.map((imagem) => imagem.objectKey));
  const minAgeMs = env.MEDIA_CLEANUP_MIN_AGE_MINUTES * 60 * 1000;
  const orphanCandidates = selecionarOrfaos({
    referencedKeys: keys,
    objects: [
      ...privadas.map((objeto) => ({ ...objeto, bucket: env.MEDIA_PRIVATE_BUCKET })),
      ...publicas.map((objeto) => ({ ...objeto, bucket: env.MEDIA_PUBLIC_BUCKET })),
    ],
    now: new Date(),
    minAgeMs,
  });
  const visibilityByKey = new Map(referenciadas.map((imagem) => [imagem.objectKey, imagem.veiculo]));
  const ineligiblePublic = publicas
    .filter((objeto) => {
      const veiculo = visibilityByKey.get(objeto.key);
      return veiculo && (veiculo.status !== StatusVeiculo.DISPONIVEL || veiculo.garagem?.status !== StatusGaragem.ATIVA);
    })
    .map((objeto) => ({ ...objeto, bucket: env.MEDIA_PUBLIC_BUCKET }))
    .filter((objeto) => objeto.lastModified && new Date().getTime() - objeto.lastModified.getTime() >= minAgeMs);
  const orfas = [
    ...orphanCandidates,
    ...ineligiblePublic.filter((objeto) => !orphanCandidates.some((candidate) => candidate.bucket === objeto.bucket && candidate.key === objeto.key)),
  ];

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", orphanCount: orfas.length, ineligiblePublicCount: ineligiblePublic.length, minAgeMinutes: env.MEDIA_CLEANUP_MIN_AGE_MINUTES }));
  if (apply) {
    const referencedAgain = await prisma.veiculoImagem.findMany({
      where: { objectKey: { in: orfas.map((objeto) => objeto.key) } },
      select: { objectKey: true, veiculo: { select: { id: true, status: true, garagem: { select: { status: true } } } } },
    });
    const currentByKey = new Map(referencedAgain.map((imagem) => [imagem.objectKey, imagem.veiculo]));
    for (const objeto of orfas) {
      const veiculo = currentByKey.get(objeto.key);
      if (veiculo && objeto.bucket === env.MEDIA_PUBLIC_BUCKET && veiculo.status === StatusVeiculo.DISPONIVEL && veiculo.garagem?.status === StatusGaragem.ATIVA) continue;
      if (veiculo && objeto.bucket === env.MEDIA_PRIVATE_BUCKET) continue;
      if (veiculo?.id) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${veiculo.id}, 0))`;
          const atual = await tx.veiculoImagem.findUnique({
            where: { objectKey: objeto.key },
            select: { veiculo: { select: { status: true, garagem: { select: { status: true } } } } },
          });
          if (!atual || (objeto.bucket === env.MEDIA_PUBLIC_BUCKET && atual.veiculo.status === StatusVeiculo.DISPONIVEL && atual.veiculo.garagem?.status === StatusGaragem.ATIVA)) return;
          await storage.deleteObject(objeto);
        });
      } else {
        await storage.deleteObject(objeto);
      }
    }
    console.log(JSON.stringify({ deletedCount: orfas.length }));
  }
} finally {
  await prisma.$disconnect();
}
