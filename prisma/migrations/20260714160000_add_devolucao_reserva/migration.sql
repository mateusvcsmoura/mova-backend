-- RN06: devolução da reserva e multa por atraso. Aditivo, idempotente.

ALTER TYPE "TipoCobranca" ADD VALUE IF NOT EXISTS 'ATRASO_DEVOLUCAO';

ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "devolvidoEm" TIMESTAMP(3);
