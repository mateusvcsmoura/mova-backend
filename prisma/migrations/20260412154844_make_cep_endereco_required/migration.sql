/*
  Warnings:

  - Made the column `cep` on table `Conta` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endereco` on table `Conta` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Conta" ALTER COLUMN "cep" SET NOT NULL,
ALTER COLUMN "endereco" SET NOT NULL;
