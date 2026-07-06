-- RF12: condutores adicionais de uma reserva. Idempotente.
CREATE TABLE IF NOT EXISTS "CondutorAdicional" (
  "id" UUID NOT NULL,
  "idReserva" UUID NOT NULL,
  "nome" TEXT NOT NULL,
  "cpf" TEXT,
  "cnh" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CondutorAdicional_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CondutorAdicional_idReserva_cnh_key"
  ON "CondutorAdicional"("idReserva", "cnh");

CREATE INDEX IF NOT EXISTS "CondutorAdicional_idReserva_idx"
  ON "CondutorAdicional"("idReserva");

DO $$ BEGIN
  ALTER TABLE "CondutorAdicional"
    ADD CONSTRAINT "CondutorAdicional_idReserva_fkey"
    FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
