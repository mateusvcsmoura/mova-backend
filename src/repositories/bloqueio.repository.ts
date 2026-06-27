import {
  BloqueioResponse,
  CreateBloqueioRequest,
  RevogarBloqueioRequest,
} from "./contracts/bloqueio.contract.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface IBloqueioRepository {
  create(data: CreateBloqueioRequest): Promise<BloqueioResponse>;
  findById(id: string): Promise<BloqueioResponse | null>;
  // Primeiro bloqueio impeditivo (ativo) do locatário, ou null. Consulta
  // otimizada (findFirst) usada na criação/confirmação de reservas — não
  // carrega o histórico completo.
  findBloqueioAtivo(
    idLocatario: string,
    agora: Date,
  ): Promise<BloqueioResponse | null>;
  // Existência de bloqueio impeditivo (mais barato quando o motivo não importa).
  existsBloqueioAtivo(idLocatario: string, agora: Date): Promise<boolean>;
  // Todos os bloqueios ativos do locatário.
  findAtivosByLocatario(
    idLocatario: string,
    agora: Date,
  ): Promise<BloqueioResponse[]>;
  // Histórico completo (inclui revogados/expirados), paginado, para auditoria.
  findHistoricoByLocatario(
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BloqueioResponse>>;
  // Revoga preservando o registro (não deleta).
  revogar(
    id: string,
    data: RevogarBloqueioRequest,
  ): Promise<BloqueioResponse>;
}
