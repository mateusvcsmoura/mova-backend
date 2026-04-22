/*
  Warnings:

  - Made the column `cargo` on table `Conta` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Conta" ALTER COLUMN "cargo" SET NOT NULL;
