import { StatusReserva, StatusVeiculo } from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { ILocadorDashboardRepository } from "../locador-dashboard.repository.js";
import {
  FaturamentoPorVeiculo,
  FrotaDashboard,
  RelatorioFinanceiro,
  RelatorioReservas,
  RelatorioUtilizacao,
  UtilizacaoVeiculo,
} from "../contracts/locador-dashboard.contract.js";

const MS_POR_HORA = 1000 * 60 * 60;

export class PrismaLocadorDashboardRepository
  implements ILocadorDashboardRepository
{
  async relatorioReservas(idLocador: string): Promise<RelatorioReservas> {
    const grupos = await prisma.reserva.groupBy({
      by: ["status"],
      where: { veiculo: { idLocador } },
      _count: { _all: true },
    });

    const contagem = (status: StatusReserva) =>
      grupos.find((g) => g.status === status)?._count._all ?? 0;

    return {
      total: grupos.reduce((acc, g) => acc + g._count._all, 0),
      aguardandoPagamento: contagem(StatusReserva.AGUARDANDO_PAGAMENTO),
      confirmadas: contagem(StatusReserva.CONFIRMADA),
      emAndamento: contagem(StatusReserva.EM_ANDAMENTO),
      concluidas: contagem(StatusReserva.REALIZADA),
      canceladas: contagem(StatusReserva.CANCELADA),
    };
  }

  async relatorioFinanceiro(idLocador: string): Promise<RelatorioFinanceiro> {
    // Apenas pagamentos confirmados entram no faturamento.
    const reservas = await prisma.reserva.findMany({
      where: {
        statusPagamento: "SUCESSO",
        veiculo: { idLocador },
      },
      select: {
        idVeiculo: true,
        valorTotal: true,
        criadaEm: true,
        veiculo: { select: { placa: true } },
      },
    });

    let faturamentoBruto = 0;
    const porPeriodoMap = new Map<string, number>();
    const porVeiculoMap = new Map<string, FaturamentoPorVeiculo>();

    for (const r of reservas) {
      const valor = Number(r.valorTotal);
      faturamentoBruto += valor;

      const periodo = `${r.criadaEm.getUTCFullYear()}-${String(
        r.criadaEm.getUTCMonth() + 1,
      ).padStart(2, "0")}`;
      porPeriodoMap.set(periodo, (porPeriodoMap.get(periodo) ?? 0) + valor);

      const atual = porVeiculoMap.get(r.idVeiculo);
      if (atual) {
        atual.total += valor;
      } else {
        porVeiculoMap.set(r.idVeiculo, {
          idVeiculo: r.idVeiculo,
          placa: r.veiculo.placa,
          total: valor,
        });
      }
    }

    return {
      faturamentoBruto,
      porPeriodo: [...porPeriodoMap.entries()]
        .map(([periodo, total]) => ({ periodo, total }))
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
      porVeiculo: [...porVeiculoMap.values()].sort((a, b) => b.total - a.total),
    };
  }

  async relatorioUtilizacao(idLocador: string): Promise<RelatorioUtilizacao> {
    const [totalVeiculos, veiculosReservados, reservas] = await Promise.all([
      prisma.veiculo.count({ where: { idLocador } }),
      prisma.veiculo.count({
        where: { idLocador, status: StatusVeiculo.RESERVADO },
      }),
      // Reservas não canceladas definem a utilização histórica.
      prisma.reserva.findMany({
        where: {
          status: { not: StatusReserva.CANCELADA },
          veiculo: { idLocador },
        },
        select: {
          idVeiculo: true,
          dataHoraInicio: true,
          dataHoraFim: true,
          veiculo: { select: { placa: true } },
        },
      }),
    ]);

    const porVeiculo = new Map<string, UtilizacaoVeiculo>();
    let horasTotais = 0;

    for (const r of reservas) {
      const horas =
        (r.dataHoraFim.getTime() - r.dataHoraInicio.getTime()) / MS_POR_HORA;
      horasTotais += horas;

      const atual = porVeiculo.get(r.idVeiculo);
      if (atual) {
        atual.reservas += 1;
        atual.horasReservadas += horas;
      } else {
        porVeiculo.set(r.idVeiculo, {
          idVeiculo: r.idVeiculo,
          placa: r.veiculo.placa,
          reservas: 1,
          horasReservadas: horas,
        });
      }
    }

    // Arredonda horas para 2 casas na saída.
    const lista = [...porVeiculo.values()].map((v) => ({
      ...v,
      horasReservadas: Math.round(v.horasReservadas * 100) / 100,
    }));
    const ordenado = [...lista].sort(
      (a, b) => b.horasReservadas - a.horasReservadas,
    );

    return {
      totalVeiculos,
      veiculosReservados,
      taxaOcupacao:
        totalVeiculos > 0
          ? Math.round((veiculosReservados / totalVeiculos) * 10000) / 10000
          : 0,
      tempoMedioReservadoHoras:
        reservas.length > 0
          ? Math.round((horasTotais / reservas.length) * 100) / 100
          : 0,
      maisUtilizados: ordenado.slice(0, 5),
      menosUtilizados: [...ordenado].reverse().slice(0, 5),
    };
  }

  async frotaDashboard(idLocador: string): Promise<FrotaDashboard> {
    const [statusGrupos, alertasAtivos, veiculos] = await Promise.all([
      prisma.veiculo.groupBy({
        by: ["status"],
        where: { idLocador },
        _count: { _all: true },
      }),
      prisma.alertaVeiculo.count({
        where: { idLocador, resolvidoEm: null },
      }),
      prisma.veiculo.findMany({
        where: { idLocador },
        select: {
          id: true,
          placa: true,
          localizacoes: {
            orderBy: { dataHora: "desc" },
            take: 1,
            select: { latitude: true, longitude: true, dataHora: true },
          },
        },
      }),
    ]);

    const contagem = (status: StatusVeiculo) =>
      statusGrupos.find((g) => g.status === status)?._count._all ?? 0;

    const ultimasLocalizacoes = veiculos
      .filter((v) => v.localizacoes.length > 0)
      .map((v) => ({
        idVeiculo: v.id,
        placa: v.placa,
        latitude: Number(v.localizacoes[0].latitude),
        longitude: Number(v.localizacoes[0].longitude),
        dataHora: v.localizacoes[0].dataHora,
      }));

    return {
      veiculos: {
        total: statusGrupos.reduce((acc, g) => acc + g._count._all, 0),
        disponivel: contagem(StatusVeiculo.DISPONIVEL),
        reservado: contagem(StatusVeiculo.RESERVADO),
        manutencao: contagem(StatusVeiculo.MANUTENCAO),
        inativo: contagem(StatusVeiculo.INATIVO),
      },
      alertasAtivos,
      ultimasLocalizacoes,
    };
  }
}
