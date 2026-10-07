import { Prisma, StatusGaragem, StatusPagamento, StatusReserva, StatusVeiculo } from "@prisma/client";

import { HttpError } from "../../errors/HttpError.js";
import { ErrorCode } from "../../i18n/index.js";
import { prazoPagamentoVencido } from "../../shared/prazo-pagamento.js";

type Transaction = Prisma.TransactionClient;

interface LockedGarage {
  id: string;
  idLocador: string;
  capacidade: number;
  veiculosAlocados: number;
  status: StatusGaragem;
}

interface LockedVehicle {
  id: string;
  idLocador: string;
  garagemId: string | null;
}

interface LockedReservation {
  id: string;
  status: StatusReserva;
  statusPagamento: StatusPagamento;
  criadaEm: Date;
}

const RESERVAS_QUE_FIXAM_GARAGEM: StatusReserva[] = [
  StatusReserva.AGUARDANDO_PAGAMENTO,
  StatusReserva.CONFIRMADA,
  StatusReserva.EM_ANDAMENTO,
];

async function lockVehicleAllocation(
  tx: Transaction,
  veiculoId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${veiculoId}, 0))`;
}

async function lockGarage(
  tx: Transaction,
  garagemId: string,
): Promise<LockedGarage> {
  const rows = await tx.$queryRaw<LockedGarage[]>(Prisma.sql`
    SELECT
      "id",
      "idLocador",
      "capacidade",
      "veiculosAlocados",
      "status"
    FROM "Garagem"
    WHERE "id" = ${garagemId}::uuid
    FOR UPDATE
  `);

  const garagem = rows[0];
  if (!garagem) {
    throw new HttpError(404, "Garagem não encontrada.");
  }
  return garagem;
}

async function lockVehicle(
  tx: Transaction,
  veiculoId: string,
): Promise<LockedVehicle> {
  const rows = await tx.$queryRaw<LockedVehicle[]>(Prisma.sql`
    SELECT "id", "idLocador", "garagemId"
    FROM "Veiculo"
    WHERE "id" = ${veiculoId}::uuid
    FOR UPDATE
  `);

  const veiculo = rows[0];
  if (!veiculo) {
    throw new HttpError(404, "Veículo não encontrado.");
  }
  return veiculo;
}

async function assertNoReservationThatPinsGarage(
  tx: Transaction,
  veiculoId: string,
): Promise<void> {
  const reservas = await tx.$queryRaw<LockedReservation[]>(Prisma.sql`
    SELECT "id", "status", "statusPagamento", "criadaEm"
    FROM "Reserva"
    WHERE "idVeiculo" = ${veiculoId}::uuid
    ORDER BY "id"
    FOR UPDATE
  `);
  // Task 10: reserva não paga com prazo vencido (15 min) já não segura nada.
  const ativa = reservas.find((reserva) =>
    RESERVAS_QUE_FIXAM_GARAGEM.includes(reserva.status) &&
    !(
      reserva.status === StatusReserva.AGUARDANDO_PAGAMENTO &&
      reserva.statusPagamento !== StatusPagamento.SUCESSO &&
      prazoPagamentoVencido(reserva.criadaEm)
    ),
  );
  if (ativa) {
    throw new HttpError(
      409,
      "O veículo possui uma reserva que impede sua transferência.",
      "VEHICLE_HAS_ACTIVE_RESERVATION",
    );
  }
}

// Task 10 (D10-06, B-03/BUG-14): status que impedem cumprir uma reserva.
const STATUS_QUE_INDISPONIBILIZAM: StatusVeiculo[] = [StatusVeiculo.MANUTENCAO, StatusVeiculo.INATIVO];

export async function assertSemCompromissoParaIndisponibilizar(
  tx: Transaction,
  veiculoId: string,
  statusAtual: StatusVeiculo,
  novoStatus: StatusVeiculo | undefined,
): Promise<void> {
  if (!novoStatus || novoStatus === statusAtual || !STATUS_QUE_INDISPONIBILIZAM.includes(novoStatus)) return;
  await lockVehicleAllocation(tx, veiculoId);
  const agora = new Date();
  const reservas = await tx.$queryRaw<Array<{ status: StatusReserva; statusPagamento: StatusPagamento; dataHoraFim: Date }>>(Prisma.sql`
    SELECT "status", "statusPagamento", "dataHoraFim"
    FROM "Reserva"
    WHERE "idVeiculo" = ${veiculoId}::uuid
    ORDER BY "id"
    FOR UPDATE
  `);
  const compromisso = reservas.some((r) =>
    r.status === StatusReserva.EM_ANDAMENTO ||
    (r.statusPagamento === StatusPagamento.SUCESSO &&
      (r.status === StatusReserva.CONFIRMADA || r.status === StatusReserva.AGUARDANDO_PAGAMENTO) &&
      r.dataHoraFim > agora),
  );
  if (compromisso) {
    throw new HttpError(
      409,
      "O veículo possui reserva confirmada futura ou em andamento. Resolva essas reservas antes de colocá-lo em manutenção ou inativá-lo.",
      ErrorCode.VEICULO_COM_RESERVA_FUTURA_CONFIRMADA,
    );
  }
}

export async function verificarReservaOperacional(
  tx: Transaction,
  reserva: { idVeiculo: string; idGaragemRetirada: string | null; idGaragemDevolucao: string | null },
): Promise<HttpError | null> {
  await lockVehicleAllocation(tx, reserva.idVeiculo);
  const [veiculo] = await tx.$queryRaw<Array<{ status: StatusVeiculo }>>(Prisma.sql`
    SELECT "status" FROM "Veiculo" WHERE "id" = ${reserva.idVeiculo}::uuid
  `);
  if (!veiculo || STATUS_QUE_INDISPONIBILIZAM.includes(veiculo.status)) {
    return new HttpError(409, "O veículo desta reserva está indisponível no momento. O pagamento não foi confirmado e nenhum valor foi cobrado.", ErrorCode.VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA);
  }
  const ids = [...new Set([reserva.idGaragemRetirada, reserva.idGaragemDevolucao].filter((id): id is string => Boolean(id)))].sort();
  if (ids.length === 0) return null;
  const garagens = await tx.$queryRaw<Array<{ status: StatusGaragem }>>(Prisma.sql`
    SELECT "status" FROM "Garagem"
    WHERE "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY "id"
    FOR SHARE
  `);
  if (garagens.length !== ids.length || garagens.some((g) => g.status !== StatusGaragem.ATIVA)) {
    return new HttpError(409, "O local de retirada ou de devolução desta reserva está indisponível no momento. O pagamento não foi confirmado e nenhum valor foi cobrado.", ErrorCode.GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA);
  }
  return null;
}

export async function assertGaragemSemCompromissoParaIndisponibilizar(
  tx: Transaction,
  garagemId: string,
  novoStatus: StatusGaragem | undefined,
): Promise<void> {
  if (!novoStatus || novoStatus === StatusGaragem.ATIVA) return;
  const garagem = await lockGarage(tx, garagemId);
  if (garagem.status === novoStatus) return;
  const agora = new Date();
  const reservas = await tx.$queryRaw<Array<{
    status: StatusReserva;
    statusPagamento: StatusPagamento;
    dataHoraFim: Date;
    idGaragemRetirada: string | null;
    idGaragemDevolucao: string | null;
  }>>(Prisma.sql`
    SELECT "status", "statusPagamento", "dataHoraFim", "idGaragemRetirada", "idGaragemDevolucao"
    FROM "Reserva"
    WHERE "idGaragemRetirada" = ${garagemId}::uuid OR "idGaragemDevolucao" = ${garagemId}::uuid
    ORDER BY "id"
    FOR UPDATE
  `);
  const pagaFutura = (r: (typeof reservas)[number]) =>
    r.statusPagamento === StatusPagamento.SUCESSO &&
    (r.status === StatusReserva.CONFIRMADA || r.status === StatusReserva.AGUARDANDO_PAGAMENTO) &&
    r.dataHoraFim > agora;
  const necessaria = reservas.some((r) => {
    const devolucao = r.idGaragemDevolucao ?? r.idGaragemRetirada;
    return (
      (r.idGaragemRetirada === garagemId && pagaFutura(r)) ||
      (devolucao === garagemId && (pagaFutura(r) || r.status === StatusReserva.EM_ANDAMENTO))
    );
  });
  if (necessaria) {
    throw new HttpError(409, "Esta garagem possui reservas confirmadas que ainda dependem dela. Resolva essas reservas antes de colocá-la em manutenção ou inativá-la.", ErrorCode.GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA);
  }
}

async function lockGarages(
  tx: Transaction,
  ids: Array<string | null | undefined>,
): Promise<Map<string, LockedGarage>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
  const locked = new Map<string, LockedGarage>();

  for (const id of uniqueIds) {
    locked.set(id, await lockGarage(tx, id));
  }

  return locked;
}

function assertGarageOwner(
  garagem: LockedGarage,
  idLocador: string,
): void {
  if (garagem.idLocador !== idLocador) {
    throw new HttpError(
      403,
      "A garagem precisa pertencer ao mesmo locador responsável pelo veículo",
    );
  }
}

function assertGarageOperational(garagem: LockedGarage): void {
  if (garagem.status !== StatusGaragem.ATIVA) {
    throw new HttpError(
      409,
      "A garagem não está disponível para nova alocação.",
    );
  }
}

function assertCapacity(garagem: LockedGarage, quantidade = 1): void {
  if (garagem.veiculosAlocados + quantidade > garagem.capacidade) {
    throw new HttpError(409, "A garagem já atingiu sua capacidade máxima.");
  }
}

export async function reserveGarageCapacityForNewVehicles(
  tx: Transaction,
  garagemId: string,
  idLocador: string,
  quantidade = 1,
): Promise<void> {
  const garagem = await lockGarage(tx, garagemId);
  assertGarageOwner(garagem, idLocador);
  assertGarageOperational(garagem);
  assertCapacity(garagem, quantidade);

  await tx.garagem.update({
    where: { id: garagemId },
    data: { veiculosAlocados: { increment: quantidade } },
  });
}

export async function assertGarageCapacityUpdate(
  tx: Transaction,
  garagemId: string,
  capacidade?: number,
): Promise<void> {
  const garagem = await lockGarage(tx, garagemId);

  if (capacidade !== undefined && capacidade < garagem.veiculosAlocados) {
    throw new HttpError(
      409,
      "A capacidade não pode ser menor que a quantidade de veículos alocados.",
    );
  }
}

export async function moveVehicleInTransaction(
  tx: Transaction,
  veiculoId: string,
  destinoGaragemId: string | null,
): Promise<void> {
  await lockVehicleAllocation(tx, veiculoId);
  const veiculo = await lockVehicle(tx, veiculoId);

  if (veiculo.garagemId === destinoGaragemId) {
    return;
  }

  const garagens = await lockGarages(tx, [veiculo.garagemId, destinoGaragemId]);
  await assertNoReservationThatPinsGarage(tx, veiculoId);

  const destino = destinoGaragemId
    ? garagens.get(destinoGaragemId)
    : undefined;
  const origem = veiculo.garagemId
    ? garagens.get(veiculo.garagemId)
    : undefined;

  if (destino) {
    assertGarageOwner(destino, veiculo.idLocador);
    assertGarageOperational(destino);
    assertCapacity(destino);
  }

  if (origem) {
    await tx.garagem.update({
      where: { id: origem.id },
      data: { veiculosAlocados: { decrement: 1 } },
    });
  }

  if (destino) {
    await tx.garagem.update({
      where: { id: destino.id },
      data: { veiculosAlocados: { increment: 1 } },
    });
  }

  await tx.veiculo.update({
    where: { id: veiculoId },
    data: { garagemId: destinoGaragemId },
  });
}

export async function desalocarVehicleInTransaction(
  tx: Transaction,
  garagemId: string,
  veiculoId: string,
): Promise<void> {
  await lockVehicleAllocation(tx, veiculoId);
  const veiculo = await lockVehicle(tx, veiculoId);
  if (veiculo.garagemId !== garagemId) {
    throw new HttpError(409, "O veículo não está alocado nesta garagem.");
  }

  // Mesma ordem de locks da movimentação: garagem antes das linhas de reserva.
  const garagem = await lockGarage(tx, garagemId);
  await assertNoReservationThatPinsGarage(tx, veiculoId);

  await tx.veiculo.update({
    where: { id: veiculoId },
    data: { garagemId: null },
  });
  await tx.garagem.update({
    where: { id: garagem.id },
    data: { veiculosAlocados: { decrement: 1 } },
  });
}
