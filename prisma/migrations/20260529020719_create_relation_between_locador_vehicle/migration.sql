/*
  Warnings:

  - A unique constraint covering the columns `[idLocador,marca,modelo,ano]` on the table `ModeloVeiculo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idLocador` to the `ModeloVeiculo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ModeloVeiculo" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "idLocador" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ModeloVeiculo_idLocador_marca_modelo_ano_key" ON "ModeloVeiculo"("idLocador", "marca", "modelo", "ano");

-- AddForeignKey
ALTER TABLE "ModeloVeiculo" ADD CONSTRAINT "ModeloVeiculo_idLocador_fkey" FOREIGN KEY ("idLocador") REFERENCES "Locador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
