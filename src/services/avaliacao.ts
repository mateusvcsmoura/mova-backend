import { Cargo, StatusReserva } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import {
  AvaliacaoResponse,
  CreateAvaliacaoRequest,
} from "../repositories/contracts/avaliacao.contract.js";
import { IAvaliacaoRepository } from "../repositories/avaliacao.repository.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { ReservaResponse } from "../repositories/contracts/reserva.contract.js";

interface AvaliacaoAccessContext {
  id: string;
  cargo: Cargo;
}

export class AvaliacaoService {
  constructor(
    private readonly avaliacaoRepository: IAvaliacaoRepository,
    private readonly reservaRepository: IReservaRepository,
    private readonly veiculoRepository: IVeiculoRepository,
  ) {}

  // Carrega a reserva ou lança 404.
  private async carregarReserva(idReserva: string): Promise<ReservaResponse> {
    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }
    return reserva;
  }

  // Quem pode avaliar: o próprio locatário dono da reserva (ou ADMIN).
  private assertPodeAvaliar(
    requester: AvaliacaoAccessContext,
    reserva: ReservaResponse,
  ): void {
    if (requester.cargo === Cargo.ADMIN) return;
    if (
      requester.cargo === Cargo.LOCATARIO &&
      requester.id === reserva.idLocatario
    ) {
      return;
    }
    throw new HttpError(403, "Acesso negado");
  }

  // Quem pode ver a avaliação: dono da reserva, locador do veículo ou ADMIN.
  private async assertPodeVer(
    requester: AvaliacaoAccessContext,
    reserva: ReservaResponse,
  ): Promise<void> {
    if (requester.cargo === Cargo.ADMIN) return;

    if (requester.cargo === Cargo.LOCATARIO) {
      if (requester.id === reserva.idLocatario) return;
      throw new HttpError(403, "Acesso negado");
    }

    if (requester.cargo === Cargo.LOCADOR) {
      const veiculo = await this.veiculoRepository.findById(reserva.idVeiculo);
      if (veiculo && veiculo.idLocador === requester.id) return;
      throw new HttpError(403, "Acesso negado");
    }

    throw new HttpError(403, "Acesso negado");
  }

  criar = async (
    data: CreateAvaliacaoRequest,
    requester: AvaliacaoAccessContext,
  ): Promise<AvaliacaoResponse> => {
    const reserva = await this.carregarReserva(data.idReserva);

    this.assertPodeAvaliar(requester, reserva);

    if (reserva.status !== StatusReserva.REALIZADA) {
      throw new HttpError(
        409,
        "Só é possível avaliar reservas concluídas (REALIZADA).",
      );
    }

    const existente = await this.avaliacaoRepository.findByReservaId(
      data.idReserva,
    );
    if (existente) {
      throw new HttpError(409, "Esta reserva já possui uma avaliação.");
    }

    return this.avaliacaoRepository.create(data);
  };

  findByReserva = async (
    idReserva: string,
    requester: AvaliacaoAccessContext,
  ): Promise<AvaliacaoResponse> => {
    const reserva = await this.carregarReserva(idReserva);

    await this.assertPodeVer(requester, reserva);

    const avaliacao =
      await this.avaliacaoRepository.findByReservaId(idReserva);
    if (!avaliacao) {
      throw new HttpError(404, "Avaliação não encontrada para esta reserva");
    }
    return avaliacao;
  };
}
