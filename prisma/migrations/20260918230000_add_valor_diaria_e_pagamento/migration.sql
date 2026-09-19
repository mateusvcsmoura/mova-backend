-- Preço da diária por modelo de veículo. Fonte de verdade do valor da reserva.
-- Linhas existentes recebem um valor de partida; o DEFAULT é removido em
-- seguida para que novos modelos sejam obrigados a informar o preço.
ALTER TABLE "ModeloVeiculo"
  ADD COLUMN "valorDiaria" DECIMAL(10,2) NOT NULL DEFAULT 150.00;

ALTER TABLE "ModeloVeiculo"
  ALTER COLUMN "valorDiaria" DROP DEFAULT;

-- Cobrança principal da reserva, registrada ao iniciar o pagamento.
ALTER TYPE "TipoCobranca" ADD VALUE IF NOT EXISTS 'PAGAMENTO_RESERVA';
