import { ModeloVeiculo, Veiculo } from "@prisma/client";
import {
  ModeloVeiculoResponse,
  VeiculoResponse,
} from "../contracts/veiculo.contract.js";

type VeiculoComModelo = Veiculo & { modeloVeiculo: ModeloVeiculo };

export class VeiculoMapper {
  static toModeloResponse(modelo: ModeloVeiculo): ModeloVeiculoResponse {
    return {
      id: modelo.id,
      marca: modelo.marca,
      idLocador: modelo.idLocador,
      modelo: modelo.modelo,
      ano: modelo.ano,
      cambio: modelo.cambio,
      capacidade: modelo.capacidade,
      eletrico: modelo.eletrico,
      adaptado: modelo.adaptado,
      criadoEm: modelo.criadoEm,
    };
  }

  static toResponse(veiculo: VeiculoComModelo): VeiculoResponse {
    return {
      id: veiculo.id,
      idLocador: veiculo.idLocador,
      idModeloVeiculo: veiculo.idModeloVeiculo,
      modeloVeiculo: this.toModeloResponse(veiculo.modeloVeiculo),
      garagemId: veiculo.garagemId,
      placa: veiculo.placa,
      status: veiculo.status,
      criadoEm: veiculo.criadoEm,
    };
  }

  static toManyResponse(veiculos: VeiculoComModelo[]): VeiculoResponse[] {
    return veiculos.map((v) => this.toResponse(v));
  }
}
