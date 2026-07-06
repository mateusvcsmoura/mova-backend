-- Hardening: teto de tentativas de envio dos alertas (dead-letter). Idempotente.
ALTER TABLE "AlertaVeiculo" ADD COLUMN IF NOT EXISTS "tentativas" INTEGER NOT NULL DEFAULT 0;
