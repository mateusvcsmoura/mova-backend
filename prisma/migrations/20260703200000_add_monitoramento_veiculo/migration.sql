-- CreateEnum
CREATE TYPE "TipoAlertaVeiculo" AS ENUM ('INATIVIDADE', 'BAIXA_AVALIACAO');

-- CreateTable
CREATE TABLE "VeiculoStatusHistorico" (
    "id" UUID NOT NULL,
    "idVeiculo" UUID NOT NULL,
    "status" "StatusVeiculo" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VeiculoStatusHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaVeiculo" (
    "id" UUID NOT NULL,
    "tipo" "TipoAlertaVeiculo" NOT NULL,
    "idVeiculo" UUID NOT NULL,
    "idLocador" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "mensagemErro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaVeiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VeiculoStatusHistorico_idVeiculo_criadoEm_idx" ON "VeiculoStatusHistorico"("idVeiculo", "criadoEm");

-- CreateIndex
CREATE INDEX "AlertaVeiculo_idVeiculo_tipo_resolvidoEm_idx" ON "AlertaVeiculo"("idVeiculo", "tipo", "resolvidoEm");

-- CreateIndex
CREATE INDEX "AlertaVeiculo_idLocador_criadoEm_idx" ON "AlertaVeiculo"("idLocador", "criadoEm");

-- AddForeignKey
ALTER TABLE "VeiculoStatusHistorico" ADD CONSTRAINT "VeiculoStatusHistorico_idVeiculo_fkey" FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaVeiculo" ADD CONSTRAINT "AlertaVeiculo_idVeiculo_fkey" FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaVeiculo" ADD CONSTRAINT "AlertaVeiculo_idLocador_fkey" FOREIGN KEY ("idLocador") REFERENCES "Locador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: registra o status atual de toda a frota como ponto de partida do
-- histórico. Usa "atualizadoEm" como melhor estimativa de quando o veículo
-- entrou no status atual (transições anteriores à feature não foram rastreadas).
INSERT INTO "VeiculoStatusHistorico" ("id", "idVeiculo", "status", "criadoEm")
SELECT gen_random_uuid(), v."id", v."status", v."atualizadoEm"
  FROM "Veiculo" v;
