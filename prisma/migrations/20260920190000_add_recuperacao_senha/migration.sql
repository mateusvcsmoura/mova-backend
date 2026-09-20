-- PRE-UI TASK-11: token temporário de recuperação de senha.
CREATE TABLE "RecuperacaoSenha" (
  "id" UUID NOT NULL,
  "idConta" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "usadoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecuperacaoSenha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecuperacaoSenha_tokenHash_key"
  ON "RecuperacaoSenha"("tokenHash");
CREATE INDEX "RecuperacaoSenha_idConta_idx"
  ON "RecuperacaoSenha"("idConta");

ALTER TABLE "RecuperacaoSenha"
  ADD CONSTRAINT "RecuperacaoSenha_idConta_fkey"
  FOREIGN KEY ("idConta") REFERENCES "Conta"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
