import { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { IAvaliacaoRelatorioRepository } from "../avaliacao-relatorio.repository.js";
import {
  AgregadoVeiculoRow,
  AvaliacaoRelatorioFilters,
  ComentarioRecente,
  DistribuicaoNota,
  EvolucaoPeriodo,
  Granularidade,
  ResumoGeral,
} from "../contracts/avaliacao-relatorio.contract.js";

// Mapeia a granularidade da API para o unit textual do date_trunc do Postgres.
// Passado como parâmetro ($) — date_trunc aceita o unit como texto, então não
// há interpolação de string na query.
const UNIT_POR_GRANULARIDADE: Record<Granularidade, string> = {
  dia: "day",
  mes: "month",
  ano: "year",
};

const nullableNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : Number(value);

export class PrismaAvaliacaoRelatorioRepository
  implements IAvaliacaoRelatorioRepository
{
  // Filtro para as consultas nativas do Prisma (aggregate/groupBy/findMany).
  // Percorre Avaliacao -> Reserva -> Veiculo para chegar ao locador.
  private buildWhere(
    filters: AvaliacaoRelatorioFilters,
  ): Prisma.AvaliacaoWhereInput {
    const {
      idLocador,
      idVeiculo,
      idModeloVeiculo,
      dataInicio,
      dataFim,
      notaMin,
      notaMax,
    } = filters;

    return {
      reserva: {
        veiculo: {
          idLocador,
          ...(idVeiculo ? { id: idVeiculo } : {}),
          ...(idModeloVeiculo ? { idModeloVeiculo } : {}),
        },
      },
      ...(dataInicio || dataFim
        ? { data: { ...(dataInicio ? { gte: dataInicio } : {}), ...(dataFim ? { lte: dataFim } : {}) } }
        : {}),
      ...(notaMin !== undefined || notaMax !== undefined
        ? {
            nota: {
              ...(notaMin !== undefined ? { gte: notaMin } : {}),
              ...(notaMax !== undefined ? { lte: notaMax } : {}),
            },
          }
        : {}),
    };
  }

  // Mesmas condições, como fragmento SQL, para as consultas com JOIN manual
  // (agregação por veículo e evolução temporal). Aliases: a=Avaliacao,
  // r=Reserva, v=Veiculo.
  private buildSqlWhere(filters: AvaliacaoRelatorioFilters): Prisma.Sql {
    const conds: Prisma.Sql[] = [
      Prisma.sql`v."idLocador" = ${filters.idLocador}::uuid`,
    ];

    if (filters.idVeiculo) {
      conds.push(Prisma.sql`r."idVeiculo" = ${filters.idVeiculo}::uuid`);
    }
    if (filters.idModeloVeiculo) {
      conds.push(
        Prisma.sql`v."idModeloVeiculo" = ${filters.idModeloVeiculo}::uuid`,
      );
    }
    if (filters.dataInicio) {
      conds.push(Prisma.sql`a."data" >= ${filters.dataInicio}::timestamp`);
    }
    if (filters.dataFim) {
      conds.push(Prisma.sql`a."data" <= ${filters.dataFim}::timestamp`);
    }
    if (filters.notaMin !== undefined) {
      conds.push(Prisma.sql`a."nota" >= ${filters.notaMin}`);
    }
    if (filters.notaMax !== undefined) {
      conds.push(Prisma.sql`a."nota" <= ${filters.notaMax}`);
    }

    return Prisma.join(conds, " AND ");
  }

  async resumoGeral(
    filters: AvaliacaoRelatorioFilters,
  ): Promise<ResumoGeral> {
    const agg = await prisma.avaliacao.aggregate({
      where: this.buildWhere(filters),
      _count: { _all: true },
      _avg: { nota: true },
      _max: { nota: true },
      _min: { nota: true },
    });

    return {
      total: agg._count._all,
      media: nullableNumber(agg._avg.nota),
      maior: nullableNumber(agg._max.nota),
      menor: nullableNumber(agg._min.nota),
    };
  }

  async distribuicaoNotas(
    filters: AvaliacaoRelatorioFilters,
  ): Promise<DistribuicaoNota[]> {
    const grupos = await prisma.avaliacao.groupBy({
      by: ["nota"],
      where: this.buildWhere(filters),
      _count: { _all: true },
      orderBy: { nota: "asc" },
    });

    return grupos.map((g) => ({
      nota: Number(g.nota),
      quantidade: g._count._all,
    }));
  }

  async aggregatePorVeiculo(
    filters: AvaliacaoRelatorioFilters,
  ): Promise<AgregadoVeiculoRow[]> {
    // COUNT como int e AVG/MIN/MAX como float => o driver devolve number puro,
    // sem BigInt/Decimal para converter. O JOIN com ModeloVeiculo resolve os
    // campos de exibição na mesma consulta (evita segunda query / N+1).
    const rows = await prisma.$queryRaw<
      Array<{
        idVeiculo: string;
        placa: string;
        marca: string;
        modelo: string;
        ano: number;
        quantidade: number;
        media: number;
        maior: number;
        menor: number;
      }>
    >(Prisma.sql`
      SELECT r."idVeiculo"        AS "idVeiculo",
             v."placa"            AS "placa",
             m."marca"            AS "marca",
             m."modelo"           AS "modelo",
             m."ano"              AS "ano",
             COUNT(a."id")::int   AS "quantidade",
             AVG(a."nota")::float AS "media",
             MAX(a."nota")::float AS "maior",
             MIN(a."nota")::float AS "menor"
        FROM "Avaliacao" a
        JOIN "Reserva" r       ON a."idReserva" = r."id"
        JOIN "Veiculo" v       ON r."idVeiculo" = v."id"
        JOIN "ModeloVeiculo" m ON v."idModeloVeiculo" = m."id"
       WHERE ${this.buildSqlWhere(filters)}
       GROUP BY r."idVeiculo", v."placa", m."marca", m."modelo", m."ano"
       ORDER BY "media" DESC, "quantidade" DESC
    `);

    return rows;
  }

  async evolucao(
    filters: AvaliacaoRelatorioFilters,
    granularidade: Granularidade,
  ): Promise<EvolucaoPeriodo[]> {
    const unit = UNIT_POR_GRANULARIDADE[granularidade];

    const rows = await prisma.$queryRaw<
      Array<{ periodo: Date; quantidade: number; media: number }>
    >(Prisma.sql`
      SELECT date_trunc(${unit}, a."data") AS "periodo",
             COUNT(a."id")::int            AS "quantidade",
             AVG(a."nota")::float          AS "media"
        FROM "Avaliacao" a
        JOIN "Reserva" r ON a."idReserva" = r."id"
        JOIN "Veiculo" v ON r."idVeiculo" = v."id"
       WHERE ${this.buildSqlWhere(filters)}
       GROUP BY "periodo"
       ORDER BY "periodo" ASC
    `);

    return rows.map((row) => ({
      periodo: new Date(row.periodo).toISOString(),
      quantidade: row.quantidade,
      media: row.media,
    }));
  }

  async comentariosRecentes(
    filters: AvaliacaoRelatorioFilters,
    limite: number,
  ): Promise<ComentarioRecente[]> {
    const rows = await prisma.avaliacao.findMany({
      where: { ...this.buildWhere(filters), comentario: { not: null } },
      orderBy: { data: "desc" },
      take: limite,
      include: {
        reserva: {
          include: { veiculo: { include: { modeloVeiculo: true } } },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      nota: Number(r.nota),
      // where já filtra comentario != null.
      comentario: r.comentario as string,
      data: r.data,
      veiculo: {
        id: r.reserva.veiculo.id,
        placa: r.reserva.veiculo.placa,
        marca: r.reserva.veiculo.modeloVeiculo.marca,
        modelo: r.reserva.veiculo.modeloVeiculo.modelo,
        ano: r.reserva.veiculo.modeloVeiculo.ano,
      },
    }));
  }
}
