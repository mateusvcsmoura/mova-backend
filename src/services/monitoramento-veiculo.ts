import { StatusNotificacao, TipoAlertaVeiculo } from "@prisma/client";

import {
  AlertaVeiculoResponse,
  VeiculoBaixaAvaliacaoRow,
  VeiculoInativoRow,
} from "../repositories/contracts/monitoramento.contract.js";
import { IMonitoramentoVeiculoRepository } from "../repositories/monitoramento.repository.js";
import { AlertaVeiculoContent } from "./contracts/alerta-veiculo.js";
import {
  renderAlertaBaixaAvaliacao,
  renderAlertaInatividade,
} from "../templates/alerta-veiculo.template.js";
import { IAlertaVeiculoDispatcher } from "./notificacao-alerta-veiculo.js";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Teto de tentativas de envio de um alerta. Ao atingir, a rotina para de
// reenviar (dead-letter) — evita marteladas em SMTP indisponível.
// ponytail: fixo; virar config se o cenário exigir backoff/reset.
const MAX_TENTATIVAS_ALERTA = 5;

export interface MonitoramentoVeiculoConfig {
  // Regra 1: dias consecutivos em INATIVO para gerar alerta.
  diasInatividade: number;
  // Regra 2: janela recente considerada (dias) e critérios de recorrência.
  janelaAvaliacaoDias: number;
  mediaMinima: number;
  // Mínimo de avaliações na janela para a regra de média (evita alerta por
  // uma única avaliação isolada).
  minAvaliacoes: number;
  notaBaixa: number;
  minNotasBaixas: number;
}

const CONFIG_PADRAO: MonitoramentoVeiculoConfig = {
  diasInatividade: 7,
  janelaAvaliacaoDias: 90,
  mediaMinima: 3,
  minAvaliacoes: 2,
  notaBaixa: 3,
  minNotasBaixas: 3,
};

// Resultado de uma regra em uma execução — retornado pelo endpoint manual e
// logado pela rotina periódica.
export interface ResultadoRegra {
  candidatos: number;
  alertasGerados: number;
  reenvios: number;
  ignoradosDuplicados: number;
  notificacoesEnviadas: number;
  falhasEnvio: number;
  alertasResolvidos: number;
}

export interface ResultadoMonitoramento {
  executadoEm: Date;
  inatividade: ResultadoRegra;
  baixaAvaliacao: ResultadoRegra;
}

// Candidato normalizado: qualquer regra produz esta estrutura, e o
// processamento (dedup -> registro -> envio -> resolução) é único. Novas
// regras = um método que gera candidatos + um TipoAlertaVeiculo novo.
interface CandidatoAlerta {
  idVeiculo: string;
  idLocador: string;
  destinatario: string;
  descricao: string;
  content: AlertaVeiculoContent;
}

const resultadoVazio = (): ResultadoRegra => ({
  candidatos: 0,
  alertasGerados: 0,
  reenvios: 0,
  ignoradosDuplicados: 0,
  notificacoesEnviadas: 0,
  falhasEnvio: 0,
  alertasResolvidos: 0,
});

// Serviço de monitoramento da frota: aplica as regras, gera/deduplica os
// alertas e delega o envio ao dispatcher. NUNCA lança — é executado por rotina
// periódica e a falha de uma regra não pode derrubar a outra nem o scheduler.
export class MonitoramentoVeiculoService {
  private readonly config: MonitoramentoVeiculoConfig;

  constructor(
    private readonly monitoramentoRepository: IMonitoramentoVeiculoRepository,
    private readonly dispatcher: IAlertaVeiculoDispatcher,
    config: Partial<MonitoramentoVeiculoConfig> = {},
  ) {
    this.config = { ...CONFIG_PADRAO, ...config };
  }

  executar = async (): Promise<ResultadoMonitoramento> => {
    const agora = new Date();

    const inatividade = await this.executarRegra(
      TipoAlertaVeiculo.INATIVIDADE,
      () => this.candidatosInatividade(agora),
      agora,
    );
    const baixaAvaliacao = await this.executarRegra(
      TipoAlertaVeiculo.BAIXA_AVALIACAO,
      () => this.candidatosBaixaAvaliacao(agora),
      agora,
    );

    console.info(
      `[monitoramento] execução concluída — inatividade: ${inatividade.candidatos} candidatos/${inatividade.notificacoesEnviadas} enviados; ` +
        `baixa avaliação: ${baixaAvaliacao.candidatos} candidatos/${baixaAvaliacao.notificacoesEnviadas} enviados`,
    );

    return { executadoEm: agora, inatividade, baixaAvaliacao };
  };

  // ------------------------------------------------------------------
  // Regras (cada uma apenas produz candidatos normalizados)
  // ------------------------------------------------------------------

  private async candidatosInatividade(agora: Date): Promise<CandidatoAlerta[]> {
    const limite = new Date(
      agora.getTime() - this.config.diasInatividade * UM_DIA_MS,
    );
    const veiculos =
      await this.monitoramentoRepository.findVeiculosInativosDesde(limite);

    return veiculos.map((v) => this.candidatoInatividade(v, agora));
  }

  private candidatoInatividade(
    v: VeiculoInativoRow,
    agora: Date,
  ): CandidatoAlerta {
    const diasInativos = Math.floor(
      (agora.getTime() - v.inativoDesde.getTime()) / UM_DIA_MS,
    );
    const content = renderAlertaInatividade({
      veiculo: { marca: v.marca, modelo: v.modelo, ano: v.ano, placa: v.placa },
      locador: { nome: v.locadorNome, empresa: v.locadorEmpresa },
      diasInativos,
    });
    return {
      idVeiculo: v.idVeiculo,
      idLocador: v.idLocador,
      destinatario: v.locadorEmail,
      descricao: `Inativo há ${diasInativos} dias`,
      content,
    };
  }

  private async candidatosBaixaAvaliacao(
    agora: Date,
  ): Promise<CandidatoAlerta[]> {
    const desde = new Date(
      agora.getTime() - this.config.janelaAvaliacaoDias * UM_DIA_MS,
    );
    const veiculos =
      await this.monitoramentoRepository.findVeiculosComBaixaAvaliacao({
        desde,
        mediaMinima: this.config.mediaMinima,
        minAvaliacoes: this.config.minAvaliacoes,
        notaBaixa: this.config.notaBaixa,
        minNotasBaixas: this.config.minNotasBaixas,
      });

    return veiculos.map((v) => this.candidatoBaixaAvaliacao(v));
  }

  private candidatoBaixaAvaliacao(
    v: VeiculoBaixaAvaliacaoRow,
  ): CandidatoAlerta {
    const content = renderAlertaBaixaAvaliacao({
      veiculo: { marca: v.marca, modelo: v.modelo, ano: v.ano, placa: v.placa },
      locador: { nome: v.locadorNome, empresa: v.locadorEmpresa },
      media: v.media,
      quantidade: v.quantidade,
      quantidadeNotasBaixas: v.quantidadeNotasBaixas,
      notaBaixa: this.config.notaBaixa,
      janelaDias: this.config.janelaAvaliacaoDias,
    });
    return {
      idVeiculo: v.idVeiculo,
      idLocador: v.idLocador,
      destinatario: v.locadorEmail,
      descricao: `Média ${v.media.toFixed(1)} em ${v.quantidade} avaliações (${v.quantidadeNotasBaixas} notas abaixo de ${this.config.notaBaixa}) nos últimos ${this.config.janelaAvaliacaoDias} dias`,
      content,
    };
  }

  // ------------------------------------------------------------------
  // Processamento comum: dedup -> registro -> envio -> resolução
  // ------------------------------------------------------------------

  private async executarRegra(
    tipo: TipoAlertaVeiculo,
    buscarCandidatos: () => Promise<CandidatoAlerta[]>,
    agora: Date,
  ): Promise<ResultadoRegra> {
    const resultado = resultadoVazio();

    try {
      const candidatos = await buscarCandidatos();
      resultado.candidatos = candidatos.length;

      for (const candidato of candidatos) {
        await this.processarCandidato(tipo, candidato, resultado);
      }

      // Resolução automática: alertas ativos cujo veículo não é mais candidato
      // tiveram a condição sanada — encerra para permitir novo alerta em caso
      // de reincidência.
      const candidatoIds = new Set(candidatos.map((c) => c.idVeiculo));
      const ativos =
        await this.monitoramentoRepository.findAtivosByTipo(tipo);
      for (const ativo of ativos) {
        if (!candidatoIds.has(ativo.idVeiculo)) {
          await this.monitoramentoRepository.resolver(ativo.id, agora);
          resultado.alertasResolvidos++;
        }
      }
    } catch (error) {
      // A regra nunca derruba a execução: loga e devolve o resultado parcial.
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(`[monitoramento] erro na regra ${tipo}: ${mensagem}`);
    }

    return resultado;
  }

  private async processarCandidato(
    tipo: TipoAlertaVeiculo,
    candidato: CandidatoAlerta,
    resultado: ResultadoRegra,
  ): Promise<void> {
    try {
      const ativo = await this.monitoramentoRepository.findAlertaAtivo(
        candidato.idVeiculo,
        tipo,
      );

      // Deduplicação: alerta ativo já notificado com sucesso — o locador não
      // recebe e-mail repetido enquanto a condição persistir.
      if (ativo && ativo.status === StatusNotificacao.ENVIADA) {
        resultado.ignoradosDuplicados++;
        return;
      }

      // Dead-letter: alerta que já falhou o número máximo de vezes não é
      // reprocessado (evita retry infinito contra um provedor indisponível).
      if (
        ativo &&
        ativo.status === StatusNotificacao.FALHA &&
        ativo.tentativas >= MAX_TENTATIVAS_ALERTA
      ) {
        console.warn(
          `[monitoramento] alerta ${ativo.id} excedeu ${MAX_TENTATIVAS_ALERTA} tentativas de envio — não será reenviado.`,
        );
        resultado.ignoradosDuplicados++;
        return;
      }

      // Reaproveita o alerta ativo PENDENTE/FALHA (retry) ou registra um novo.
      let alerta: AlertaVeiculoResponse;
      if (ativo) {
        alerta = ativo;
        resultado.reenvios++;
      } else {
        alerta = await this.monitoramentoRepository.registrarAlerta({
          tipo,
          idVeiculo: candidato.idVeiculo,
          idLocador: candidato.idLocador,
          descricao: candidato.descricao,
          destinatario: candidato.destinatario,
          assunto: candidato.content.subject,
        });
        resultado.alertasGerados++;
      }

      const enviado = await this.dispatcher.enviar(alerta, candidato.content);
      if (enviado) {
        resultado.notificacoesEnviadas++;
      } else {
        resultado.falhasEnvio++;
      }
    } catch (error) {
      // Falha em um veículo não interrompe os demais.
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[monitoramento] erro ao processar veículo ${candidato.idVeiculo} (${tipo}): ${mensagem}`,
      );
      resultado.falhasEnvio++;
    }
  }
}
