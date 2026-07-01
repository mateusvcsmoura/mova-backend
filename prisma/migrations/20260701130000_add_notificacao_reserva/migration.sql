-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHA');

-- CreateTable
CREATE TABLE "NotificacaoReserva" (
    "id" UUID NOT NULL,
    "idReserva" UUID NOT NULL,
    "destinatario" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "mensagemErro" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificacaoReserva_idReserva_idx" ON "NotificacaoReserva"("idReserva");

-- AddForeignKey
ALTER TABLE "NotificacaoReserva" ADD CONSTRAINT "NotificacaoReserva_idReserva_fkey" FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
