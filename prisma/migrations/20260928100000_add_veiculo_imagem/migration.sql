CREATE TYPE "StatusVeiculoImagem" AS ENUM ('PENDING', 'READY', 'DELETING');

CREATE TABLE "VeiculoImagem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idVeiculo" UUID NOT NULL,
  "objectKey" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL,
  "altText" TEXT,
  "mimeType" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "largura" INTEGER NOT NULL,
  "altura" INTEGER NOT NULL,
  "status" "StatusVeiculoImagem" NOT NULL DEFAULT 'PENDING',
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VeiculoImagem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VeiculoImagem_objectKey_key" ON "VeiculoImagem"("objectKey");
CREATE UNIQUE INDEX "VeiculoImagem_idVeiculo_ordem_key" ON "VeiculoImagem"("idVeiculo", "ordem");
CREATE INDEX "VeiculoImagem_idVeiculo_status_ordem_idx" ON "VeiculoImagem"("idVeiculo", "status", "ordem");

ALTER TABLE "VeiculoImagem"
  ADD CONSTRAINT "VeiculoImagem_idVeiculo_fkey"
  FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
