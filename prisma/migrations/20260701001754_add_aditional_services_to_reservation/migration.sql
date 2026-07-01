-- AlterTable
ALTER TABLE "Localizacao" ALTER COLUMN "longitude" SET DATA TYPE DECIMAL(11,8);

-- CreateTable
CREATE TABLE "ServicoOpcional" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicoOpcional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaServico" (
    "idReserva" UUID NOT NULL,
    "idServico" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservaServico_pkey" PRIMARY KEY ("idReserva","idServico")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServicoOpcional_nome_key" ON "ServicoOpcional"("nome");

-- CreateIndex
CREATE INDEX "ServicoOpcional_ativo_idx" ON "ServicoOpcional"("ativo");

-- CreateIndex
CREATE INDEX "ReservaServico_idServico_idx" ON "ReservaServico"("idServico");

-- CreateIndex
CREATE INDEX "Localizacao_idVeiculo_dataHora_idx" ON "Localizacao"("idVeiculo", "dataHora");

-- AddForeignKey
ALTER TABLE "ReservaServico" ADD CONSTRAINT "ReservaServico_idReserva_fkey" FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaServico" ADD CONSTRAINT "ReservaServico_idServico_fkey" FOREIGN KEY ("idServico") REFERENCES "ServicoOpcional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
