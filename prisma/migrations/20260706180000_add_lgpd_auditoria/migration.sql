-- LGPD: anonimização (direito ao esquecimento) + trilha de auditoria de acesso
-- a dados pessoais. Idempotente.

ALTER TABLE "Conta" ADD COLUMN IF NOT EXISTS "anonimizadoEm" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "AcaoLgpd" AS ENUM ('EXPORTAR', 'ANONIMIZAR', 'CONSULTAR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AcessoDadoPessoal" (
  "id" UUID NOT NULL,
  "idTitular" UUID NOT NULL,
  "idAutor" UUID NOT NULL,
  "acao" "AcaoLgpd" NOT NULL,
  "detalhe" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcessoDadoPessoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AcessoDadoPessoal_idTitular_idx" ON "AcessoDadoPessoal"("idTitular");

DO $$ BEGIN
  ALTER TABLE "AcessoDadoPessoal"
    ADD CONSTRAINT "AcessoDadoPessoal_idTitular_fkey"
    FOREIGN KEY ("idTitular") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AcessoDadoPessoal"
    ADD CONSTRAINT "AcessoDadoPessoal_idAutor_fkey"
    FOREIGN KEY ("idAutor") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
