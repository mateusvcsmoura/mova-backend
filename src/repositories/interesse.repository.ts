import {
  CreateInteresseRequest,
  InteressadoResponse,
  InteresseResponse,
} from "./contracts/interesse.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IInteresseVeiculoRepository {
  create(data: CreateInteresseRequest): Promise<InteresseResponse>;
  reativar(id: string): Promise<InteresseResponse>;
  // Encerramento pelo locatário (opt-out): status CANCELADO + canceladoEm.
  cancelar(id: string): Promise<void>;
  // Encerramento automático após notificação enviada com sucesso.
  marcarNotificado(id: string, notificadoEm: Date): Promise<void>;
  // Busca pelo par único (qualquer status) — verificação de duplicidade.
  findByLocatarioAndVeiculo(
    idLocatario: string,
    idVeiculo: string,
  ): Promise<InteresseResponse | null>;
  // Inscrições ATIVAS do locatário (a watchlist atual dele).
  findAtivosByLocatarioId(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<InteresseResponse>>;
  findAtivosByVeiculo(idVeiculo: string): Promise<InteressadoResponse[]>;
}
