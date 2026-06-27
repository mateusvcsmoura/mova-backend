import { MotivoBloqueio } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import {
  BloqueioResponse,
  CreateBloqueioRequest,
} from "../repositories/contracts/bloqueio.contract.js";
import { IBloqueioRepository } from "../repositories/bloqueio.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

// Mensagens de negócio por motivo. Centralizadas para manter o erro consistente
// e permitir novos motivos sem espalhar strings pelo código.
const MENSAGEM_POR_MOTIVO: Record<MotivoBloqueio, string> = {
  INADIMPLENCIA:
    "Existem pendências financeiras impeditivas. Regularize sua situação para realizar novas reservas.",
  FRAUDE:
    "Sua conta está bloqueada por suspeita de fraude. Entre em contato com o suporte.",
  DOCUMENTACAO:
    "Sua conta está bloqueada por pendências de documentação. Regularize seus documentos para reservar.",
  MULTA:
    "Sua conta está bloqueada por multas pendentes. Regularize-as para realizar novas reservas.",
  ADMINISTRATIVO:
    "Sua conta está temporariamente bloqueada por decisão administrativa.",
  OUTRO: "Sua conta está bloqueada e não pode realizar novas reservas no momento.",
};

export class BloqueioService {
  constructor(
    private readonly bloqueioRepository: IBloqueioRepository,
    private readonly locatarioRepository: ILocatarioRepository,
  ) {}

  // Regra central reutilizada na criação/confirmação de reservas. Lança 403
  // quando há um bloqueio impeditivo, com a mensagem correspondente ao motivo.
  // Consulta única e otimizada (findFirst), sem carregar o histórico.
  assertLocatarioLiberado = async (idLocatario: string): Promise<void> => {
    const bloqueio = await this.bloqueioRepository.findBloqueioAtivo(
      idLocatario,
      new Date(),
    );

    if (bloqueio) {
      throw new HttpError(403, MENSAGEM_POR_MOTIVO[bloqueio.motivo]);
    }
  };

  create = async (data: CreateBloqueioRequest): Promise<BloqueioResponse> => {
    const locatario = await this.locatarioRepository.findById(data.idLocatario);
    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }

    if (data.expiraEm && data.expiraEm <= new Date()) {
      throw new HttpError(
        400,
        "A data de expiração do bloqueio deve estar no futuro.",
      );
    }

    return this.bloqueioRepository.create(data);
  };

  findById = async (id: string): Promise<BloqueioResponse> => {
    const bloqueio = await this.bloqueioRepository.findById(id);
    if (!bloqueio) {
      throw new HttpError(404, "Bloqueio não encontrado");
    }
    return bloqueio;
  };

  findAtivosByLocatario = async (
    idLocatario: string,
  ): Promise<BloqueioResponse[]> => {
    return this.bloqueioRepository.findAtivosByLocatario(
      idLocatario,
      new Date(),
    );
  };

  findHistoricoByLocatario = async (
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BloqueioResponse>> => {
    return this.bloqueioRepository.findHistoricoByLocatario(
      idLocatario,
      pagination,
    );
  };

  revogar = async (
    id: string,
    revogadoPor?: string,
  ): Promise<BloqueioResponse> => {
    const bloqueio = await this.bloqueioRepository.findById(id);
    if (!bloqueio) {
      throw new HttpError(404, "Bloqueio não encontrado");
    }

    if (bloqueio.revogadoEm !== null) {
      throw new HttpError(409, "Bloqueio já foi revogado.");
    }

    return this.bloqueioRepository.revogar(id, {
      revogadoEm: new Date(),
      revogadoPor,
    });
  };
}
