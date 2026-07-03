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
  // Reativa uma inscrição encerrada (CANCELADO/NOTIFICADO): status volta a
  // ATIVO e o opt-in é renovado. O par (locatário, veículo) é @@unique — a
  // reinscrição reutiliza a mesma linha.
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
  // Interessados a notificar quando o veículo volta a DISPONIVEL: apenas
  // inscrições ATIVAS, com o destinatário (nome/e-mail) já resolvido.
  findAtivosByVeiculo(idVeiculo: string): Promise<InteressadoResponse[]>;
}
