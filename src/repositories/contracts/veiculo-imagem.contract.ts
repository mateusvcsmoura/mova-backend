import { StatusVeiculoImagem } from "@prisma/client";

export interface VeiculoImagemResponse {
  id: string;
  idVeiculo: string;
  ordem: number;
  altText: string | null;
  mimeType: string;
  tamanho: number;
  largura: number;
  altura: number;
  status: StatusVeiculoImagem;
  url: string | null;
  criadaEm: Date;
  atualizadoEm: Date;
}

export interface ReordenarImagensRequest {
  imagemIds: string[];
}
