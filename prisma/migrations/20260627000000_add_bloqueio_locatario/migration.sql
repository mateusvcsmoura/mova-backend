-- CreateEnum
CREATE TYPE "MotivoBloqueio" AS ENUM ('INADIMPLENCIA', 'FRAUDE', 'DOCUMENTACAO', 'MULTA', 'ADMINISTRATIVO', 'OUTRO');

-- CreateTable
CREATE TABLE "BloqueioLocatario" (
    "id" UUID NOT NULL,
    "idLocatario" UUID NOT NULL,
    "motivo" "MotivoBloqueio" NOT NULL,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),
    "criadoPor" UUID,
    "revogadoPor" UUID,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloqueioLocatario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloqueioLocatario_idLocatario_revogadoEm_expiraEm_idx" ON "BloqueioLocatario"("idLocatario", "revogadoEm", "expiraEm");

-- AddForeignKey
ALTER TABLE "BloqueioLocatario" ADD CONSTRAINT "BloqueioLocatario_idLocatario_fkey" FOREIGN KEY ("idLocatario") REFERENCES "Locatario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
