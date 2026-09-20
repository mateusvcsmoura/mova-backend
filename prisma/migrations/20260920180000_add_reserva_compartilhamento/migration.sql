-- RF13-B: token público persistente, revogável e separado do ID da reserva.
CREATE TABLE "CompartilhamentoReserva" (
  "id" UUID NOT NULL,
  "idReserva" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revogadoEm" TIMESTAMP(3),
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompartilhamentoReserva_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompartilhamentoReserva_idReserva_key"
  ON "CompartilhamentoReserva"("idReserva");
CREATE UNIQUE INDEX "CompartilhamentoReserva_token_key"
  ON "CompartilhamentoReserva"("token");

ALTER TABLE "CompartilhamentoReserva"
  ADD CONSTRAINT "CompartilhamentoReserva_idReserva_fkey"
  FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
