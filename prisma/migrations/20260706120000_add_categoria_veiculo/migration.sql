-- RF07/RF16: categoria comercial do veículo no ModeloVeiculo. Idempotente.
DO $$ BEGIN
  CREATE TYPE "CategoriaVeiculo" AS ENUM ('ECONOMICO', 'ESPACOSO', 'EXECUTIVO', 'PCD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "ModeloVeiculo" ADD COLUMN IF NOT EXISTS "categoria" "CategoriaVeiculo";
