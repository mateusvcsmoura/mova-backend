import { Garagem, ModeloVeiculo, StatusGaragem, StatusVeiculo, StatusVeiculoImagem, Veiculo, VeiculoImagem } from "@prisma/client";
import {
  ModeloVeiculoResponse,
  VeiculoResponse,
} from "../contracts/veiculo.contract.js";
import { publicMediaUrl } from "../../infra/media/storage-provider.js";

type VeiculoComModelo = Veiculo & {
  modeloVeiculo: ModeloVeiculo;
  garagem?: Pick<Garagem, "id" | "nome" | "status"> | null;
  imagens?: VeiculoImagem[];
};

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
      categoria: modelo.categoria,
      valorDiaria: Number(modelo.valorDiaria),
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
      garagem: veiculo.garagem
        ? {
            id: veiculo.garagem.id,
            nome: veiculo.garagem.nome,
            status: veiculo.garagem.status,
          }
        : null,
      placa: veiculo.placa,
      status: veiculo.status,
      criadoEm: veiculo.criadoEm,
      imagens: (veiculo.imagens ?? []).map((imagem) => ({
        id: imagem.id,
        idVeiculo: imagem.idVeiculo,
        ordem: imagem.ordem,
        altText: imagem.altText,
        mimeType: imagem.mimeType,
        tamanho: imagem.tamanho,
        largura: imagem.largura,
        altura: imagem.altura,
        status: imagem.status,
        url: imagem.status === StatusVeiculoImagem.READY &&
          veiculo.status === StatusVeiculo.DISPONIVEL &&
          veiculo.garagem?.status === StatusGaragem.ATIVA
          ? publicMediaUrl(imagem.objectKey)
          : null,
        criadaEm: imagem.criadaEm,
        atualizadoEm: imagem.atualizadoEm,
      })),
    };
  }

  static toManyResponse(veiculos: VeiculoComModelo[]): VeiculoResponse[] {
    return veiculos.map((v) => this.toResponse(v));
  }
}
