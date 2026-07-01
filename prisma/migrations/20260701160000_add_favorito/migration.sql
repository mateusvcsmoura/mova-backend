-- CreateTable
CREATE TABLE "Favorito" (
    "id" UUID NOT NULL,
    "idLocatario" UUID NOT NULL,
    "idVeiculo" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favorito_idVeiculo_idx" ON "Favorito"("idVeiculo");

-- CreateIndex
CREATE UNIQUE INDEX "Favorito_idLocatario_idVeiculo_key" ON "Favorito"("idLocatario", "idVeiculo");

-- AddForeignKey
ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_idLocatario_fkey" FOREIGN KEY ("idLocatario") REFERENCES "Locatario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorito" ADD CONSTRAINT "Favorito_idVeiculo_fkey" FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
