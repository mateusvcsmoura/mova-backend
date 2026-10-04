-- Task 10 (BUG-05): marca a expiração automática da reserva não paga.
-- Aditiva e não destrutiva: coluna anulável, sem backfill.
ALTER TABLE "Reserva" ADD COLUMN "expiradaEm" TIMESTAMP(3);
