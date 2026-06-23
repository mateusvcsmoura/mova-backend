-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "codigoDesbloqueio" TEXT,
ADD COLUMN     "codigoGeradoEm" TIMESTAMP(3),
ADD COLUMN     "codigoUsadoEm" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_codigoDesbloqueio_key" ON "Reserva"("codigoDesbloqueio");
