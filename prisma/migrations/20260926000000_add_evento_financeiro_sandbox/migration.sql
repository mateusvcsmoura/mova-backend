-- Trilha financeira append-only exclusiva do sandbox. Não registra nem executa
-- transferências reais; a unicidade da chave torna a reentrega idempotente.
CREATE TYPE "TipoEventoFinanceiroSandbox" AS ENUM (
  'PAGAMENTO_RECEBIDO',
  'ESTORNO_SOLICITADO',
  'ESTORNO_CONCLUIDO',
  'ESTORNO_FALHOU'
);

CREATE TABLE "EventoFinanceiroSandbox" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idReserva" UUID NOT NULL,
  "tipo" "TipoEventoFinanceiroSandbox" NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoFinanceiroSandbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoFinanceiroSandbox_chaveIdempotencia_key"
  ON "EventoFinanceiroSandbox"("chaveIdempotencia");
CREATE INDEX "EventoFinanceiroSandbox_idReserva_criadoEm_idx"
  ON "EventoFinanceiroSandbox"("idReserva", "criadoEm");
ALTER TABLE "EventoFinanceiroSandbox"
  ADD CONSTRAINT "EventoFinanceiroSandbox_idReserva_fkey"
  FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
