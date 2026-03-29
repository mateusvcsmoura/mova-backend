import { Veiculo } from "@prisma/client";
import { VeiculoResponse } from "../contracts/veiculo.contract.js";

export class VeiculoMapper {
  static toResponse(veiculo: Veiculo): VeiculoResponse {
    return {
      id: veiculo.id,
      idLocador: veiculo.idLocador,
      placa: veiculo.placa,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      ano: veiculo.ano,
      cambio: veiculo.cambio,
      capacidade: veiculo.capacidade,
      status: veiculo.status,
      eletrico: veiculo.eletrico,
      adaptado: veiculo.adaptado,
      criadoEm: veiculo.criadoEm,
    };
  }

  static toManyResponse(veiculos: Veiculo[]): VeiculoResponse[] {
    return veiculos.map(this.toResponse);
  }
}
