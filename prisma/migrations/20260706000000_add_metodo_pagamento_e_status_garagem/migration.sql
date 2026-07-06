-- RF11: forma de pagamento na Reserva. RF19: status operacional da Garagem
-- (soft delete). Idempotente para reprocessamento seguro.

DO $$ BEGIN
  CREATE TYPE "MetodoPagamento" AS ENUM ('CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'CARTEIRA_DIGITAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusGaragem" AS ENUM ('ATIVA', 'INATIVA', 'MANUTENCAO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "metodoPagamento" "MetodoPagamento";
ALTER TABLE "Garagem" ADD COLUMN IF NOT EXISTS "status" "StatusGaragem" NOT NULL DEFAULT 'ATIVA';
