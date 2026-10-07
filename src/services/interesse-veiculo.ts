import { StatusInteresse, StatusVeiculo } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import { InteresseResponse } from "../repositories/contracts/interesse.contract.js";
import {
  InteresseVeiculoDescobertaResponse,
} from "../repositories/contracts/interesse.contract.js";
import { NotificacaoInteresseResponse } from "../repositories/contracts/notificacao-interesse.contract.js";
import { IInteresseVeiculoRepository } from "../repositories/interesse.repository.js";
import { INotificacaoInteresseRepository } from "../repositories/notificacao-interesse.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";
import { InteresseMapper } from "../repositories/mappers/interesse.mapper.js";

export class InteresseVeiculoService {
  constructor(
    private readonly interesseRepository: IInteresseVeiculoRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly locatarioRepository: ILocatarioRepository,
    private readonly notificacaoRepository?: INotificacaoInteresseRepository,
  ) {}

  private async assertLocatarioExiste(idLocatario: string): Promise<void> {
    const locatario = await this.locatarioRepository.findById(idLocatario);
    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }
  }

  private async assertVeiculoElegivel(idVeiculo: string): Promise<void> {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    if (veiculo.status === StatusVeiculo.INATIVO) {
      throw new HttpError(409, "Veículo inativo não aceita interesse de disponibilidade");
    }
  }

  registrar = async (
    idLocatario: string,
    idVeiculo: string,
  ): Promise<InteresseResponse> => {
    await this.assertLocatarioExiste(idLocatario);
    await this.assertVeiculoElegivel(idVeiculo);

    const existente = await this.interesseRepository.findByLocatarioAndVeiculo(
      idLocatario,
      idVeiculo,
    );

    if (existente?.status === StatusInteresse.ATIVO) {
      throw new HttpError(
        409,
        "Você já possui uma inscrição ativa para este veículo.",
      );
    }

    if (existente) {
      return this.interesseRepository.reativar(existente.id);
    }

    return this.interesseRepository.create({ idLocatario, idVeiculo });
  };

  // Cancelamento (opt-out). Apenas inscrições ATIVAS do próprio locatário.
  cancelar = async (
    idLocatario: string,
    idVeiculo: string,
  ): Promise<void> => {
    const interesse = await this.interesseRepository.findByLocatarioAndVeiculo(
      idLocatario,
      idVeiculo,
    );

    if (!interesse || interesse.status !== StatusInteresse.ATIVO) {
      throw new HttpError(404, "Inscrição de interesse ativa não encontrada");
    }

    await this.interesseRepository.cancelar(interesse.id);
  };

  // Inscrições ATIVAS do locatário autenticado (a watchlist atual).
  listar = async (
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<InteresseResponse>> => {
    return this.interesseRepository.findAtivosByLocatarioId(
      idLocatario,
      pagination,
    );
  };

  descobrir = async (
    pagination: PaginationParams,
  ): Promise<PaginatedResult<InteresseVeiculoDescobertaResponse>> => {
    const veiculos = await this.veiculoRepository.findForInteresse(pagination);
    return buildPaginatedResult(
      veiculos.data.map((veiculo) => InteresseMapper.toDescobertaResponse(veiculo)),
      veiculos.total,
      pagination,
    );
  };

  listarNotificacoes = async (
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<NotificacaoInteresseResponse>> => {
    if (!this.notificacaoRepository) {
      return buildPaginatedResult([], 0, pagination);
    }
    return this.notificacaoRepository.findByLocatarioId(idLocatario, pagination);
  };
}
