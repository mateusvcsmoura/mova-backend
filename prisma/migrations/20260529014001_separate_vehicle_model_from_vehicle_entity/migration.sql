/*
  Warnings:

  - You are about to drop the column `adaptado` on the `Veiculo` table. All the data in the column will be lost.
  - You are about to drop the column `ano` on the `Veiculo` table. All the data in the column will be lost.
  - You are about to drop the column `cambio` on the `Veiculo` table. All the data in the column will be lost.
  - You are about to drop the column `capacidade` on the `Veiculo` table. All the data in the column will be lost.
  - You are about to drop the column `eletrico` on the `Veiculo` table. All the data in the column will be lost.
  - You are about to drop the column `marca` on the `Veiculo` table. All the data in the column will be lost.
  - You are about to drop the column `modelo` on the `Veiculo` table. All the data in the column will be lost.
  - Added the required column `idModeloVeiculo` to the `Veiculo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Veiculo" DROP COLUMN "adaptado",
DROP COLUMN "ano",
DROP COLUMN "cambio",
DROP COLUMN "capacidade",
DROP COLUMN "eletrico",
DROP COLUMN "marca",
DROP COLUMN "modelo",
ADD COLUMN     "idModeloVeiculo" UUID NOT NULL;

-- CreateTable
CREATE TABLE "ModeloVeiculo" (
    "id" UUID NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cambio" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "eletrico" BOOLEAN NOT NULL,
    "adaptado" BOOLEAN NOT NULL,

    CONSTRAINT "ModeloVeiculo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_idModeloVeiculo_fkey" FOREIGN KEY ("idModeloVeiculo") REFERENCES "ModeloVeiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
