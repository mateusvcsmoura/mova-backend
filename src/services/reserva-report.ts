import { HttpError } from "../errors/HttpError.js";
import { IContaRepository } from "../repositories/conta.repository.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import { ILocadorRepository } from "../repositories/locador.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { ReservaResponse } from "../repositories/contracts/reserva.contract.js";
import {
  ReservaReportContent,
  ReservaReportPayload,
} from "./contracts/reserva-report.js";
import { renderReservaReport } from "../templates/reserva-report.template.js";
import { Locale, LOCALE_PADRAO } from "../i18n/index.js";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Monta o payload do relatório a partir de uma reserva, resolvendo as entidades
// relacionadas (veículo, locador, locatário, garagens) e calculando os valores
// derivados. Não envia nada — apenas produz o payload e o conteúdo renderizado.
// Assim o cálculo do relatório fica testável isoladamente e independente do
// canal de envio.
export class ReservaReportService {
  constructor(
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly contaRepository: IContaRepository,
    private readonly locadorRepository: ILocadorRepository,
    private readonly garagemRepository: IGaragemRepository,
  ) {}

  // Quantidade de dias da reserva (arredonda para cima; mínimo 1).
  private calcularDias(inicio: Date, fim: Date): number {
    const diff = fim.getTime() - inicio.getTime();
    return Math.max(1, Math.ceil(diff / UM_DIA_MS));
  }

  async buildPayload(
    reserva: ReservaResponse,
  ): Promise<ReservaReportPayload> {
    const veiculo = await this.veiculoRepository.findById(reserva.idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo da reserva não encontrado.");
    }

    const conta = await this.contaRepository.findById(reserva.idLocatario);
    if (!conta) {
      throw new HttpError(404, "Locatário da reserva não encontrado.");
    }

    const locador = await this.locadorRepository.findById(veiculo.idLocador);

    // Garagens são opcionais na reserva; resolvemos apenas quando informadas.
    const garagemRetirada = reserva.idGaragemRetirada
      ? await this.garagemRepository.findById(reserva.idGaragemRetirada)
      : null;
    const garagemDevolucao = reserva.idGaragemDevolucao
      ? await this.garagemRepository.findById(reserva.idGaragemDevolucao)
      : null;

    const valorServicos = reserva.servicos.reduce((acc, s) => acc + s.valor, 0);
    // valorTotal já inclui os serviços; o valor base é a diferença.
    const valorBase = reserva.valorTotal - valorServicos;

    return {
      reserva: {
        id: reserva.id,
        criadaEm: reserva.criadaEm,
        status: reserva.status,
        statusPagamento: reserva.statusPagamento,
        dataHoraInicio: reserva.dataHoraInicio,
        dataHoraFim: reserva.dataHoraFim,
        dias: this.calcularDias(reserva.dataHoraInicio, reserva.dataHoraFim),
        valorBase,
        valorServicos,
        valorTotal: reserva.valorTotal,
        codigoDesbloqueio: reserva.codigoDesbloqueio,
      },
      veiculo: {
        marca: veiculo.modeloVeiculo.marca,
        modelo: veiculo.modeloVeiculo.modelo,
        ano: veiculo.modeloVeiculo.ano,
        placa: veiculo.placa,
      },
      locador: {
        empresa: locador?.empresa ?? "Não informado",
      },
      locatario: {
        nome: conta.nome,
        email: conta.email,
      },
      retirada: garagemRetirada
        ? { garagem: garagemRetirada.nome, endereco: garagemRetirada.endereco }
        : null,
      devolucao: garagemDevolucao
        ? {
            garagem: garagemDevolucao.nome,
            endereco: garagemDevolucao.endereco,
          }
        : null,
      servicos: reserva.servicos.map((s) => ({
        nome: s.nome,
        descricao: s.descricao,
        valor: s.valor,
      })),
    };
  }

  // Monta o payload e já devolve o conteúdo pronto (assunto/HTML/texto) no
  // idioma pedido (padrão pt). O idioma afeta só o texto ao usuário, não os dados.
  async buildReport(
    reserva: ReservaResponse,
    locale: Locale = LOCALE_PADRAO,
  ): Promise<{
    payload: ReservaReportPayload;
    content: ReservaReportContent;
  }> {
    const payload = await this.buildPayload(reserva);
    return { payload, content: renderReservaReport(payload, locale) };
  }
}
