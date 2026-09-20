import { randomBytes } from "node:crypto";
import { Cargo } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
import { ICompartilhamentoReservaRepository } from "../repositories/compartilhamento.repository.js";
import {
  CompartilhamentoLinkResponse,
  CompartilhamentoPublico,
} from "../repositories/contracts/compartilhamento.contract.js";

interface Requester {
  id: string;
  cargo: Cargo;
}

export class CompartilhamentoReservaService {
  constructor(
    private readonly compartilhamentoRepository: ICompartilhamentoReservaRepository,
    private readonly reservaRepository: IReservaRepository,
  ) {}

  async criar(idReserva: string, requester: Requester): Promise<{
    response: CompartilhamentoLinkResponse;
    criado: boolean;
  }> {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) throw new HttpError(404, "Reserva não encontrada.");
    this.assertOwner(reserva.idLocatario, requester);

    const resultado = await this.compartilhamentoRepository.criarOuObterAtivo(
      idReserva,
      () => randomBytes(32).toString("base64url"),
    );
    return {
      criado: resultado.criado,
      response: {
        ...resultado.compartilhamento,
        urlPath: `/viagem/compartilhada/${resultado.compartilhamento.token}`,
      },
    };
  }

  async revogar(idReserva: string, requester: Requester): Promise<void> {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) throw new HttpError(404, "Reserva não encontrada.");
    this.assertOwner(reserva.idLocatario, requester);
    const revogado = await this.compartilhamentoRepository.revogar(idReserva);
    if (!revogado) throw new HttpError(404, "Compartilhamento não encontrado.");
  }

  async resolver(token: string): Promise<CompartilhamentoPublico> {
    const resultado = await this.compartilhamentoRepository.findPublicoByToken(token);
    if (!resultado) throw new HttpError(404, "Compartilhamento não encontrado.");
    return resultado;
  }

  private assertOwner(idLocatario: string, requester: Requester): void {
    if (requester.cargo !== Cargo.LOCATARIO || requester.id !== idLocatario) {
      throw new HttpError(403, "Acesso negado");
    }
  }
}
