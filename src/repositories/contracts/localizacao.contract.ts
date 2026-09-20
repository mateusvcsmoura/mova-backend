// Registro de um novo ponto de localização de um veículo.
// dataHora é opcional: quando omitido, o banco usa @default(now()).
export interface CreateLocalizacaoRequest {
  idVeiculo: string;
  latitude: number;
  longitude: number;
  dataHora?: Date;
}

export interface LocalizacaoResponse {
  id: string;
  idVeiculo: string;
  // Prisma.Decimal -> number para a resposta da API
  latitude: number;
  longitude: number;
  dataHora: Date;
  atualizadoEm: Date;
}

export interface RastreamentoReservaResponse {
  reservaId: string;
  veiculo: {
    id: string;
    placa: string;
    nome: string;
  };
  localizacao: Pick<
    LocalizacaoResponse,
    "latitude" | "longitude" | "dataHora"
  > | null;
}
