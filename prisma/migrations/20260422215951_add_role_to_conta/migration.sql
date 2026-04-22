-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('LOCATARIO', 'LOCADOR', 'ADMIN');

-- AlterTable
ALTER TABLE "Conta" ADD COLUMN     "cargo" "Cargo" DEFAULT 'LOCATARIO';
