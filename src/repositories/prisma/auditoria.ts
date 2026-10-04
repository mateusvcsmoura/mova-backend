import { AcaoAuditoria, Cargo, EntidadeAuditada, Prisma } from "@prisma/client";

// RN09 — trilha de auditoria de negócio (não é log técnico).
//
// O ator vem SEMPRE do usuário autenticado (req.user → requester), nunca do
// body. O registro é gravado com o mesmo `tx` da alteração: ou os dois são
// persistidos, ou nenhum. Snapshots guardam só campos operacionais (status,
// garagem, placa, atributos do modelo, período/valores da reserva) e, deles,
// apenas o que mudou — nada de PII, senha, token ou dados de cartão.

export interface AtorAuditoria {
  id: string;
  cargo: Cargo;
}

type Snapshot = Record<string, Prisma.InputJsonValue | null>;

type VeiculoComModelo = {
  placa: string;
  status: string;
  garagemId: string | null;
  modeloVeiculo?: {
    marca: string;
    modelo: string;
    ano: number;
    cambio: string;
    capacidade: number;
    eletrico: boolean;
    adaptado: boolean;
    categoria: string | null;
    valorDiaria: Prisma.Decimal | number;
  } | null;
};

export function snapshotVeiculo(veiculo: VeiculoComModelo): Snapshot {
  const modelo = veiculo.modeloVeiculo;
  return {
    placa: veiculo.placa,
    status: veiculo.status,
    garagemId: veiculo.garagemId,
    ...(modelo
      ? {
          marca: modelo.marca,
          modelo: modelo.modelo,
          ano: modelo.ano,
          cambio: modelo.cambio,
          capacidade: modelo.capacidade,
          eletrico: modelo.eletrico,
          adaptado: modelo.adaptado,
          categoria: modelo.categoria,
          valorDiaria: Number(modelo.valorDiaria),
        }
      : {}),
  };
}

type ReservaAuditavel = {
  status: string;
  statusPagamento: string;
  dataHoraInicio: Date;
  dataHoraFim: Date;
  idGaragemRetirada: string | null;
  idGaragemDevolucao: string | null;
  metodoPagamento: string | null;
  valorTotal: Prisma.Decimal | number;
  devolvidoEm?: Date | null;
};

export function snapshotReserva(reserva: ReservaAuditavel): Snapshot {
  return {
    status: reserva.status,
    statusPagamento: reserva.statusPagamento,
    dataHoraInicio: reserva.dataHoraInicio.toISOString(),
    dataHoraFim: reserva.dataHoraFim.toISOString(),
    idGaragemRetirada: reserva.idGaragemRetirada,
    idGaragemDevolucao: reserva.idGaragemDevolucao,
    metodoPagamento: reserva.metodoPagamento,
    valorTotal: Number(reserva.valorTotal),
    devolvidoEm: reserva.devolvidoEm ? reserva.devolvidoEm.toISOString() : null,
  };
}

// Só as chaves que mudaram, dos dois lados.
export function diferenca(antes: Snapshot, depois: Snapshot): { antes: Snapshot; depois: Snapshot } {
  const a: Snapshot = {};
  const d: Snapshot = {};
  for (const chave of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    if (JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave])) {
      a[chave] = antes[chave] ?? null;
      d[chave] = depois[chave] ?? null;
    }
  }
  return { antes: a, depois: d };
}

// Ação mais específica para uma alteração de veículo.
export function acaoAlteracaoVeiculo(campos: string[]): AcaoAuditoria {
  if (campos.length === 1 && campos[0] === "status") return AcaoAuditoria.ALTERACAO_STATUS;
  if (campos.length === 1 && campos[0] === "garagemId") return AcaoAuditoria.MUDANCA_GARAGEM;
  return AcaoAuditoria.ALTERACAO;
}

export async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  ator: AtorAuditoria | undefined,
  registro: {
    entidade: EntidadeAuditada;
    idEntidade: string;
    idLocador: string;
    acao: AcaoAuditoria;
    antes?: Snapshot | null;
    depois?: Snapshot | null;
  },
): Promise<void> {
  // Sem ator (scripts internos/seed) não há autoria a registrar.
  if (!ator) return;
  await tx.registroAuditoria.create({
    data: {
      idAtor: ator.id,
      cargoAtor: ator.cargo,
      idLocador: registro.idLocador,
      entidade: registro.entidade,
      idEntidade: registro.idEntidade,
      acao: registro.acao,
      antes: registro.antes ?? Prisma.JsonNull,
      depois: registro.depois ?? Prisma.JsonNull,
    },
  });
}

// Registra uma alteração de veículo se algo mudou de fato.
export async function auditarAlteracaoVeiculo(
  tx: Prisma.TransactionClient,
  ator: AtorAuditoria | undefined,
  idVeiculo: string,
  idLocador: string,
  antes: Snapshot,
  depois: Snapshot,
  acaoForcada?: AcaoAuditoria,
): Promise<void> {
  const diff = diferenca(antes, depois);
  const campos = Object.keys(diff.depois);
  if (campos.length === 0) return;
  await registrarAuditoria(tx, ator, {
    entidade: EntidadeAuditada.VEICULO,
    idEntidade: idVeiculo,
    idLocador,
    acao: acaoForcada ?? acaoAlteracaoVeiculo(campos),
    antes: diff.antes,
    depois: diff.depois,
  });
}
