-- Preferências de notificação (canal x tipo, opt-in/opt-out). Idempotente.

DO $$ BEGIN
  CREATE TYPE "CanalNotificacao" AS ENUM ('EMAIL', 'PUSH', 'SMS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoNotificacao" AS ENUM ('RESERVA', 'ALERTA_VEICULO', 'VEICULO_DISPONIVEL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "PreferenciaNotificacao" (
  "id" UUID NOT NULL,
  "idConta" UUID NOT NULL,
  "canal" "CanalNotificacao" NOT NULL,
  "tipo" "TipoNotificacao" NOT NULL,
  "habilitado" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreferenciaNotificacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PreferenciaNotificacao_idConta_canal_tipo_key"
  ON "PreferenciaNotificacao"("idConta", "canal", "tipo");

DO $$ BEGIN
  ALTER TABLE "PreferenciaNotificacao"
    ADD CONSTRAINT "PreferenciaNotificacao_idConta_fkey"
    FOREIGN KEY ("idConta") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
