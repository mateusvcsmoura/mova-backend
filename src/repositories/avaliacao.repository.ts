import {
  CreateAvaliacaoRequest,
  AvaliacaoResponse,
} from "./contracts/avaliacao.contract.js";

export interface IAvaliacaoRepository {
  create(data: CreateAvaliacaoRequest): Promise<AvaliacaoResponse>;
  // idReserva é @unique: uma reserva possui no máximo uma avaliação.
  findByReservaId(idReserva: string): Promise<AvaliacaoResponse | null>;
}
