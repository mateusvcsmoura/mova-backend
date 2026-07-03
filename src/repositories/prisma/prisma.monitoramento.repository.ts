import {
  Prisma,
  StatusNotificacao,
  StatusVeiculo,
  TipoAlertaVeiculo,
} from "@prisma/client";

import { prisma } from "../../database/prisma.js";
import { HttpError } from "../../errors/HttpError.js";
import { IMonitoramentoVeiculoRepository } from "../monitoramento.repository.js";
import {
  AlertaVeiculoResponse,
  CriterioBaixaAvaliacao,
  RegistrarAlertaRequest,
  VeiculoBaixaAvaliacaoRow,
  VeiculoInativoRow,
} from "../contracts/monitoramento.contract.js";
import { AlertaVeiculoMapper } from "../mappers/alerta-veiculo.mapper.js";

export class PrismaMonitoramentoVeiculoRepository
  implements IMonitoramentoVeiculoRepository
{
  async registrarStatus(
    idVeiculo: string,
    status: StatusVeiculo,
  ): Promise<void> {
    await prisma.veiculoStatusHistorico.create({
      data: { idVeiculo, status },
    });
  }

  async findVeiculosInativosDesde(limite: Date): Promise<VeiculoInativoRow[]> {
    // A última transição de status de um veículo indica desde quando ele está
    // no status atual. LEFT JOIN LATERAL pega apenas essa linha (usa o índice
    // (idVeiculo, criadoEm)); COALESCE cai para a criação do veículo quando
    // ainda não há histórico. Modelo, locador e conta (destinatário do e-mail)
    // são resolvidos na mesma consulta — sem N+1.
    return prisma.$queryRaw<VeiculoInativoRow[]>(Prisma.sql`
      SELECT v."id"                                AS "idVeiculo",
             v."idLocador"                         AS "idLocador",
             v."placa"                             AS "placa",
             m."marca"                             AS "marca",
             m."modelo"                            AS "modelo",
             m."ano"                               AS "ano",
             COALESCE(h."criadoEm", v."criadoEm")  AS "inativoDesde",
             c."nome"                              AS "locadorNome",
             c."email"                             AS "locadorEmail",
             l."empresa"                           AS "locadorEmpresa"
        FROM "Veiculo" v
        JOIN "ModeloVeiculo" m ON v."idModeloVeiculo" = m."id"
        JOIN "Locador" l       ON v."idLocador" = l."id"
        JOIN "Conta" c         ON c."id" = l."id"
        LEFT JOIN LATERAL (
          SELECT hs."criadoEm"
            FROM "VeiculoStatusHistorico" hs
           WHERE hs."idVeiculo" = v."id"
           ORDER BY hs."criadoEm" DESC
           LIMIT 1
        ) h ON TRUE
       WHERE v."status" = 'INATIVO'::"StatusVeiculo"
         AND COALESCE(h."criadoEm", v."criadoEm") <= ${limite}
    `);
  }

  async findVeiculosComBaixaAvaliacao(
    criterio: CriterioBaixaAvaliacao,
  ): Promise<VeiculoBaixaAvaliacaoRow[]> {
    // Agregação inteira no banco (COUNT/AVG/FILTER + HAVING): nenhuma
    // avaliação é carregada em memória. COUNT::int e AVG::float fazem o driver
    // devolver number puro (sem BigInt/Decimal) — mesmo padrão do relatório de
    // avaliações.
    return prisma.$queryRaw<VeiculoBaixaAvaliacaoRow[]>(Prisma.sql`
      SELECT r."idVeiculo"          AS "idVeiculo",
             v."idLocador"          AS "idLocador",
             v."placa"              AS "placa",
             m."marca"              AS "marca",
             m."modelo"             AS "modelo",
             m."ano"                AS "ano",
             AVG(a."nota")::float   AS "media",
             COUNT(a."id")::int     AS "quantidade",
             (COUNT(a."id") FILTER (WHERE a."nota" < ${criterio.notaBaixa}))::int
                                    AS "quantidadeNotasBaixas",
             c."nome"               AS "locadorNome",
             c."email"              AS "locadorEmail",
             l."empresa"            AS "locadorEmpresa"
        FROM "Avaliacao" a
        JOIN "Reserva" r       ON a."idReserva" = r."id"
        JOIN "Veiculo" v       ON r."idVeiculo" = v."id"
        JOIN "ModeloVeiculo" m ON v."idModeloVeiculo" = m."id"
        JOIN "Locador" l       ON v."idLocador" = l."id"
        JOIN "Conta" c         ON c."id" = l."id"
       WHERE a."data" >= ${criterio.desde}
       GROUP BY r."idVeiculo", v."idLocador", v."placa",
                m."marca", m."modelo", m."ano",
                c."nome", c."email", l."empresa"
      HAVING (COUNT(a."id") >= ${criterio.minAvaliacoes}
              AND AVG(a."nota") < ${criterio.mediaMinima})
          OR (COUNT(a."id") FILTER (WHERE a."nota" < ${criterio.notaBaixa}))
              >= ${criterio.minNotasBaixas}
    `);
  }

  async registrarAlerta(
    data: RegistrarAlertaRequest,
  ): Promise<AlertaVeiculoResponse> {
    const alerta = await prisma.alertaVeiculo.create({
      data: {
        tipo: data.tipo,
        idVeiculo: data.idVeiculo,
        idLocador: data.idLocador,
        descricao: data.descricao,
        destinatario: data.destinatario,
        assunto: data.assunto,
        canal: data.canal ?? undefined,
        status: StatusNotificacao.PENDENTE,
      },
    });
    return AlertaVeiculoMapper.toResponse(alerta);
  }

  async marcarEnviado(
    id: string,
    enviadoEm: Date,
  ): Promise<AlertaVeiculoResponse> {
    try {
      const alerta = await prisma.alertaVeiculo.update({
        where: { id },
        data: {
          status: StatusNotificacao.ENVIADA,
          enviadoEm,
          mensagemErro: null,
        },
      });
      return AlertaVeiculoMapper.toResponse(alerta);
    } catch {
      throw new HttpError(404, "Alerta não encontrado.");
    }
  }

  async marcarFalha(
    id: string,
    mensagemErro: string,
  ): Promise<AlertaVeiculoResponse> {
    try {
      const alerta = await prisma.alertaVeiculo.update({
        where: { id },
        data: {
          status: StatusNotificacao.FALHA,
          mensagemErro,
        },
      });
      return AlertaVeiculoMapper.toResponse(alerta);
    } catch {
      throw new HttpError(404, "Alerta não encontrado.");
    }
  }

  async resolver(
    id: string,
    resolvidoEm: Date,
  ): Promise<AlertaVeiculoResponse> {
    try {
      const alerta = await prisma.alertaVeiculo.update({
        where: { id },
        data: { resolvidoEm },
      });
      return AlertaVeiculoMapper.toResponse(alerta);
    } catch {
      throw new HttpError(404, "Alerta não encontrado.");
    }
  }

  async findAlertaAtivo(
    idVeiculo: string,
    tipo: TipoAlertaVeiculo,
  ): Promise<AlertaVeiculoResponse | null> {
    const alerta = await prisma.alertaVeiculo.findFirst({
      where: { idVeiculo, tipo, resolvidoEm: null },
      orderBy: { criadoEm: "desc" },
    });
    return alerta ? AlertaVeiculoMapper.toResponse(alerta) : null;
  }

  async findAtivosByTipo(
    tipo: TipoAlertaVeiculo,
  ): Promise<AlertaVeiculoResponse[]> {
    const alertas = await prisma.alertaVeiculo.findMany({
      where: { tipo, resolvidoEm: null },
      orderBy: { criadoEm: "asc" },
    });
    return AlertaVeiculoMapper.toManyResponse(alertas);
  }

  async findByVeiculo(idVeiculo: string): Promise<AlertaVeiculoResponse[]> {
    const alertas = await prisma.alertaVeiculo.findMany({
      where: { idVeiculo },
      orderBy: { criadoEm: "desc" },
    });
    return AlertaVeiculoMapper.toManyResponse(alertas);
  }
}
