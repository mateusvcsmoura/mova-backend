import {
  Conta,
  Garagem,
  InteresseVeiculo,
  Locador,
  Locatario,
  ModeloVeiculo,
  Veiculo,
} from "@prisma/client";
import {
  InteressadoResponse,
  InteresseGaragemResponse,
  InteresseLocadorResponse,
  InteresseResponse,
  InteresseVeiculoDetalheResponse,
  InteresseVeiculoDescobertaResponse,
} from "../contracts/interesse.contract.js";
import { VeiculoMapper } from "./veiculo.mapper.js";
import { VeiculoResponse } from "../contracts/veiculo.contract.js";

type VeiculoComRelacoes = Veiculo & {
  modeloVeiculo: ModeloVeiculo;
  locador: Locador;
  garagem: Garagem | null;
};

type InteresseComVeiculo = InteresseVeiculo & { veiculo: VeiculoComRelacoes };

type InteresseComLocatario = InteresseVeiculo & {
  locatario: Locatario & { conta: Pick<Conta, "nome" | "email"> };
};

export class InteresseMapper {
  private static toLocadorResponse(locador: Locador): InteresseLocadorResponse {
    return {
      id: locador.id,
      empresa: locador.empresa,
      cnpj: locador.cnpj,
    };
  }

  private static toGaragemResponse(
    garagem: Garagem | null,
  ): InteresseGaragemResponse | null {
    if (!garagem) return null;
    return {
      id: garagem.id,
      nome: garagem.nome,
      endereco: garagem.endereco,
      acessibilidade: garagem.acessibilidade,
      status: garagem.status,
    };
  }

  private static toVeiculoResponse(
    veiculo: VeiculoComRelacoes,
  ): InteresseVeiculoDetalheResponse {
    return {
      ...VeiculoMapper.toResponse(veiculo),
      locador: this.toLocadorResponse(veiculo.locador),
      garagem: this.toGaragemResponse(veiculo.garagem),
    };
  }

  static toResponse(interesse: InteresseComVeiculo): InteresseResponse {
    return {
      id: interesse.id,
      idLocatario: interesse.idLocatario,
      idVeiculo: interesse.idVeiculo,
      status: interesse.status,
      optInEm: interesse.optInEm,
      canceladoEm: interesse.canceladoEm,
      notificadoEm: interesse.notificadoEm,
      veiculo: this.toVeiculoResponse(interesse.veiculo),
      criadoEm: interesse.criadoEm,
      atualizadoEm: interesse.atualizadoEm,
    };
  }

  static toManyResponse(
    interesses: InteresseComVeiculo[],
  ): InteresseResponse[] {
    return interesses.map((i) => this.toResponse(i));
  }

  static toDescobertaResponse(
    veiculo: VeiculoResponse,
  ): InteresseVeiculoDescobertaResponse {
    return {
      id: veiculo.id,
      status: veiculo.status,
      modeloVeiculo: {
        id: veiculo.modeloVeiculo.id,
        marca: veiculo.modeloVeiculo.marca,
        modelo: veiculo.modeloVeiculo.modelo,
        ano: veiculo.modeloVeiculo.ano,
        cambio: veiculo.modeloVeiculo.cambio,
        capacidade: veiculo.modeloVeiculo.capacidade,
        eletrico: veiculo.modeloVeiculo.eletrico,
        adaptado: veiculo.modeloVeiculo.adaptado,
        categoria: veiculo.modeloVeiculo.categoria,
        valorDiaria: veiculo.modeloVeiculo.valorDiaria,
      },
      garagem: veiculo.garagem
        ? {
            id: veiculo.garagem.id,
            nome: veiculo.garagem.nome,
            status: veiculo.garagem.status,
          }
        : null,
    };
  }

  static toInteressadoResponse(
    interesse: InteresseComLocatario,
  ): InteressadoResponse {
    return {
      id: interesse.id,
      idLocatario: interesse.idLocatario,
      idVeiculo: interesse.idVeiculo,
      locatario: {
        nome: interesse.locatario.conta.nome,
        email: interesse.locatario.conta.email,
      },
    };
  }

  static toManyInteressadoResponse(
    interesses: InteresseComLocatario[],
  ): InteressadoResponse[] {
    return interesses.map((i) => this.toInteressadoResponse(i));
  }
}
