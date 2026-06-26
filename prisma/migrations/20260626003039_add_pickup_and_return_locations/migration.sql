-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "idGaragemDevolucao" UUID,
ADD COLUMN     "idGaragemRetirada" UUID;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_idGaragemRetirada_fkey" FOREIGN KEY ("idGaragemRetirada") REFERENCES "Garagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_idGaragemDevolucao_fkey" FOREIGN KEY ("idGaragemDevolucao") REFERENCES "Garagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
