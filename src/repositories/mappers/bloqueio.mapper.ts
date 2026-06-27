import { BloqueioLocatario } from "@prisma/client";
import { BloqueioResponse } from "../contracts/bloqueio.contract.js";

export class BloqueioMapper {
  // Um bloqueio é impeditivo quando não foi revogado e ainda não expirou.
  static isAtivo(bloqueio: BloqueioLocatario, agora: Date): boolean {
    if (bloqueio.revogadoEm !== null) return false;
    if (bloqueio.expiraEm !== null && bloqueio.expiraEm <= agora) return false;
    return true;
  }

  static toResponse(
    bloqueio: BloqueioLocatario,
    agora: Date = new Date(),
  ): BloqueioResponse {
    return {
      id: bloqueio.id,
      idLocatario: bloqueio.idLocatario,
      motivo: bloqueio.motivo,
      descricao: bloqueio.descricao,
      criadoEm: bloqueio.criadoEm,
      expiraEm: bloqueio.expiraEm,
      revogadoEm: bloqueio.revogadoEm,
      criadoPor: bloqueio.criadoPor,
      revogadoPor: bloqueio.revogadoPor,
      ativo: this.isAtivo(bloqueio, agora),
      atualizadoEm: bloqueio.atualizadoEm,
    };
  }

  static toManyResponse(
    bloqueios: BloqueioLocatario[],
    agora: Date = new Date(),
  ): BloqueioResponse[] {
    return bloqueios.map((b) => this.toResponse(b, agora));
  }
}
