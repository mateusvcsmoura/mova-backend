import { MotivoBloqueio } from "@prisma/client";

export interface CreateBloqueioRequest {
  idLocatario: string;
  motivo: MotivoBloqueio;
  descricao?: string;
  // null/undefined => bloqueio permanente.
  expiraEm?: Date;
  // Conta (admin) que criou o bloqueio.
  criadoPor?: string;
}

export interface RevogarBloqueioRequest {
  revogadoEm: Date;
  revogadoPor?: string;
}

export interface BloqueioResponse {
  id: string;
  idLocatario: string;
  motivo: MotivoBloqueio;
  descricao: string | null;
  criadoEm: Date;
  expiraEm: Date | null;
  revogadoEm: Date | null;
  criadoPor: string | null;
  revogadoPor: string | null;
  // Derivado: revogadoEm IS NULL e (expiraEm IS NULL ou expiraEm > agora).
  ativo: boolean;
  atualizadoEm: Date;
}
