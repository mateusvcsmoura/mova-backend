import {
  Favorito,
  Garagem,
  Locador,
  ModeloVeiculo,
  Veiculo,
} from "@prisma/client";
import {
  FavoritoGaragemResponse,
  FavoritoLocadorResponse,
  FavoritoResponse,
  FavoritoVeiculoResponse,
} from "../contracts/favorito.contract.js";
import { VeiculoMapper } from "./veiculo.mapper.js";

type VeiculoComRelacoes = Veiculo & {
  modeloVeiculo: ModeloVeiculo;
  locador: Locador;
  garagem: Garagem | null;
};

type FavoritoComVeiculo = Favorito & { veiculo: VeiculoComRelacoes };

export class FavoritoMapper {
  private static toLocadorResponse(locador: Locador): FavoritoLocadorResponse {
    return {
      id: locador.id,
      empresa: locador.empresa,
      cnpj: locador.cnpj,
    };
  }

  private static toGaragemResponse(
    garagem: Garagem | null,
  ): FavoritoGaragemResponse | null {
    if (!garagem) return null;
    return {
      id: garagem.id,
      nome: garagem.nome,
      endereco: garagem.endereco,
      acessibilidade: garagem.acessibilidade,
    };
  }

  private static toVeiculoResponse(
    veiculo: VeiculoComRelacoes,
  ): FavoritoVeiculoResponse {
    return {
      ...VeiculoMapper.toResponse(veiculo),
      locador: this.toLocadorResponse(veiculo.locador),
      garagem: this.toGaragemResponse(veiculo.garagem),
    };
  }

  static toResponse(favorito: FavoritoComVeiculo): FavoritoResponse {
    return {
      id: favorito.id,
      idLocatario: favorito.idLocatario,
      idVeiculo: favorito.idVeiculo,
      veiculo: this.toVeiculoResponse(favorito.veiculo),
      criadoEm: favorito.criadoEm,
      atualizadoEm: favorito.atualizadoEm,
    };
  }

  static toManyResponse(favoritos: FavoritoComVeiculo[]): FavoritoResponse[] {
    return favoritos.map((f) => this.toResponse(f));
  }
}
