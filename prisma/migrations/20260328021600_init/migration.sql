-- CreateEnum
CREATE TYPE "StatusVeiculo" AS ENUM ('DISPONIVEL', 'RESERVADO', 'MANUTENCAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM ('AGUARDANDO_PAGAMENTO', 'CONFIRMADA', 'EM_ANDAMENTO', 'REALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('AGUARDANDO_PAGAMENTO', 'PROCESSANDO', 'SUCESSO', 'FALHA');

-- CreateTable
CREATE TABLE "Conta" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senhaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deficiencia" (
    "id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Deficiencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locatario" (
    "id" UUID NOT NULL,
    "cpf" TEXT NOT NULL,
    "cnh" TEXT NOT NULL,
    "deficienciaId" UUID,

    CONSTRAINT "Locatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locador" (
    "id" UUID NOT NULL,
    "empresa" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,

    CONSTRAINT "Locador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" UUID NOT NULL,
    "idLocador" UUID NOT NULL,
    "garagemId" UUID,
    "placa" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "cambio" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "status" "StatusVeiculo" NOT NULL DEFAULT 'DISPONIVEL',
    "eletrico" BOOLEAN NOT NULL,
    "adaptado" BOOLEAN NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garagem" (
    "id" UUID NOT NULL,
    "idLocador" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "veiculosAlocados" INTEGER NOT NULL,
    "acessibilidade" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Garagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" UUID NOT NULL,
    "idVeiculo" UUID NOT NULL,
    "idLocatario" UUID NOT NULL,
    "dataHoraInicio" TIMESTAMP(3) NOT NULL,
    "dataHoraFim" TIMESTAMP(3) NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "status" "StatusReserva" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Localizacao" (
    "id" UUID NOT NULL,
    "idVeiculo" UUID NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(10,8) NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Localizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" UUID NOT NULL,
    "idReserva" UUID NOT NULL,
    "comentario" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" DECIMAL(2,1) NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conta_email_key" ON "Conta"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Locatario_cpf_key" ON "Locatario"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Locatario_cnh_key" ON "Locatario"("cnh");

-- CreateIndex
CREATE UNIQUE INDEX "Locador_cnpj_key" ON "Locador"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_placa_key" ON "Veiculo"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_idReserva_key" ON "Avaliacao"("idReserva");

-- AddForeignKey
ALTER TABLE "Locatario" ADD CONSTRAINT "Locatario_id_fkey" FOREIGN KEY ("id") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locatario" ADD CONSTRAINT "Locatario_deficienciaId_fkey" FOREIGN KEY ("deficienciaId") REFERENCES "Deficiencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locador" ADD CONSTRAINT "Locador_id_fkey" FOREIGN KEY ("id") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_idLocador_fkey" FOREIGN KEY ("idLocador") REFERENCES "Locador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_garagemId_fkey" FOREIGN KEY ("garagemId") REFERENCES "Garagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garagem" ADD CONSTRAINT "Garagem_idLocador_fkey" FOREIGN KEY ("idLocador") REFERENCES "Locador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_idVeiculo_fkey" FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_idLocatario_fkey" FOREIGN KEY ("idLocatario") REFERENCES "Locatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Localizacao" ADD CONSTRAINT "Localizacao_idVeiculo_fkey" FOREIGN KEY ("idVeiculo") REFERENCES "Veiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_idReserva_fkey" FOREIGN KEY ("idReserva") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
