-- RN09: trilha de auditoria persistente (append-only) de veículos e reservas.
CREATE TYPE "EntidadeAuditada" AS ENUM ('VEICULO', 'RESERVA');
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'ALTERACAO', 'ALTERACAO_STATUS', 'MUDANCA_GARAGEM', 'EXCLUSAO', 'CANCELAMENTO', 'DEVOLUCAO');

CREATE TABLE "RegistroAuditoria" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idAtor" UUID NOT NULL,
  "cargoAtor" "Cargo" NOT NULL,
  "idLocador" UUID NOT NULL,
  "entidade" "EntidadeAuditada" NOT NULL,
  "idEntidade" UUID NOT NULL,
  "acao" "AcaoAuditoria" NOT NULL,
  "antes" JSONB,
  "depois" JSONB,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistroAuditoria_entidade_idEntidade_criadoEm_idx" ON "RegistroAuditoria"("entidade", "idEntidade", "criadoEm");
CREATE INDEX "RegistroAuditoria_idLocador_criadoEm_idx" ON "RegistroAuditoria"("idLocador", "criadoEm");

-- Append-only também no banco: UPDATE e DELETE de linha são recusados.
-- (TRUNCATE, usado só por manutenção/seed local, não dispara gatilho de linha.)
CREATE FUNCTION "registro_auditoria_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegistroAuditoria é append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "registro_auditoria_sem_update_delete"
BEFORE UPDATE OR DELETE ON "RegistroAuditoria"
FOR EACH ROW EXECUTE FUNCTION "registro_auditoria_append_only"();
