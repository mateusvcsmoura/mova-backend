-- Estado financeiro por cobrança. Reutiliza StatusPagamento para que a
-- pendência e sua quitação sejam consultadas na mesma fonte de verdade.
ALTER TABLE "CobrancaReserva"
  ADD COLUMN "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
  ADD COLUMN "metodoPagamento" "MetodoPagamento",
  ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Cobranças históricas já registradas eram apenas trilha: não podem passar a
-- bloquear reservas ao receber estado novo. Multas positivas permanecem
-- explicitamente pendentes para regularização.
UPDATE "CobrancaReserva"
SET "statusPagamento" = CASE
  WHEN "valor" > 0
    AND "tipo" IN ('CANCELAMENTO', 'ATRASO_DEVOLUCAO') THEN 'AGUARDANDO_PAGAMENTO'::"StatusPagamento"
  ELSE 'SUCESSO'::"StatusPagamento"
END;

CREATE INDEX "CobrancaReserva_statusPagamento_idx"
  ON "CobrancaReserva"("statusPagamento");
