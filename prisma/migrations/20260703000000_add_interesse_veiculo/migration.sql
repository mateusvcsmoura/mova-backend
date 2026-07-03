-- CreateEnum
CREATE TYPE "StatusInteresse" AS ENUM ('ATIVO', 'CANCELADO', 'NOTIFICADO');

-- CreateTable
CREATE TABLE "InteresseVeiculo" (
    "id" UUID NOT NULL,
    "idLocatario" UUID NOT NULL,
    "idVeiculo" UUID NOT NULL,
    "status" "StatusInteresse" NOT NULL DEFAULT 'ATIVO',
    "optInEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladoEm" TIMESTAMP(3),
    "notificadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteresseVeiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacaoInteresse" (
    "id" UUID NOT NULL,
    "idInteresse" UUID NOT NULL,
    "destinatario" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "mensagemErro" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoInteresse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteresseVeiculo_idVeiculo_status_idx" ON "InteresseVeiculo"("idVeiculo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InteresseVeiculo_idLocatario_idVeiculo_key" ON "InteresseVeiculo"("idLocatario", "idVeiculo");

-- CreateIndex
CREATE INDEX "NotificacaoInteresse_idInteresse_idx" ON "NotificacaoInteresse"("idInteresse");

-- AddForeignKey
ALTER TABLE "InteresseVeiculo" ADD CONSTRAINT "InteresseVeiculo_idLocatario_fkey" FOREIGN KEY ("idLocatario") REFERENCES "Locatario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteresseVeiculo" ADD CONSTRAINT "InteresseVeiculo_idVeiculo_fkey" FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoInteresse" ADD CONSTRAINT "NotificacaoInteresse_idInteresse_fkey" FOREIGN KEY ("idInteresse") REFERENCES "InteresseVeiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
