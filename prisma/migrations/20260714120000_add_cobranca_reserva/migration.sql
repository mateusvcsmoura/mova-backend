-- RN04: cobrança avulsa de reserva (multa de cancelamento). Aditivo, idempotente.

DO $$ BEGIN
  CREATE TYPE "TipoCobranca" AS ENUM ('CANCELAMENTO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "CobrancaReserva" (
  "id" UUID NOT NULL,
  "idReserva" UUID NOT NULL,
  "tipo" "TipoCobranca" NOT NULL,
  "valor" DECIMAL(10,2) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CobrancaReserva_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CobrancaReserva_idReserva_idx"
  ON "CobrancaReserva"("idReserva");

DO $$ BEGIN
  ALTER TABLE "CobrancaReserva"
    ADD CONSTRAINT "CobrancaReserva_idReserva_fkey"
    FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
