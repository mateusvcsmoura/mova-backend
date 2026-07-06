-- RF01: adiciona RG e data de nascimento ao Locatário.
--
-- Colunas NOT NULL adicionadas com DEFAULT temporário para backfill de linhas
-- existentes; o DEFAULT é removido em seguida para que a aplicação passe a
-- exigir os valores explicitamente (validados no schema Zod). Ajuste/limpe os
-- valores retroativos conforme necessário antes de expor o dado.
--
-- Idempotente (IF NOT EXISTS / DROP DEFAULT) para permitir reprocessamento
-- seguro caso uma tentativa anterior tenha aplicado parcialmente a migration.
ALTER TABLE "Locatario" ADD COLUMN IF NOT EXISTS "rg" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Locatario" ADD COLUMN IF NOT EXISTS "dataNascimento" DATE NOT NULL DEFAULT '1900-01-01';

ALTER TABLE "Locatario" ALTER COLUMN "rg" DROP DEFAULT;
ALTER TABLE "Locatario" ALTER COLUMN "dataNascimento" DROP DEFAULT;
