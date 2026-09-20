-- RF10: expose simulated insurance coverage and preserve the contracted text.
ALTER TABLE "ServicoOpcional"
  ADD COLUMN "detalhesCobertura" TEXT;

ALTER TABLE "ReservaServico"
  ADD COLUMN "nome" TEXT,
  ADD COLUMN "descricao" TEXT,
  ADD COLUMN "detalhesCobertura" TEXT;
