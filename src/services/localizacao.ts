import { Cargo } from "@prisma/client";
import { HttpError } from "../errors/HttpError.js";
import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
} from "../repositories/contracts/localizacao.contract.js";
import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { VeiculoResponse } from "../repositories/contracts/veiculo.contract.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

// Contexto do requisitante autenticado (populado pelo authMiddleware).
export interface LocalizacaoRequester {
  id: string;
  cargo: Cargo;
}

export class LocalizacaoService {
  constructor(
    private readonly localizacaoRepository: ILocalizacaoRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly reservaRepository: IReservaRepository,
  ) {}

  // Garante que o veículo existe antes de qualquer operação de localização.
  private async assertVeiculoExiste(idVeiculo: string): Promise<void> {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
  }

  // Carrega o veículo (404 se não existir) para consultas que precisam do
  // idLocador na verificação de acesso.
  private async getVeiculoOrThrow(idVeiculo: string): Promise<VeiculoResponse> {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    return veiculo;
  }

  // Autoriza a consulta de localização:
  //   ADMIN     -> qualquer veículo;
  //   LOCADOR   -> apenas os próprios veículos;
  //   LOCATARIO -> apenas veículos de reservas às quais pertence.
  private async assertPodeConsultar(
    veiculo: VeiculoResponse,
    requester: LocalizacaoRequester,
  ): Promise<void> {
    if (requester.cargo === Cargo.ADMIN) return;

    if (requester.cargo === Cargo.LOCADOR) {
      if (veiculo.idLocador === requester.id) return;
      throw new HttpError(403, "Acesso negado");
    }

    if (requester.cargo === Cargo.LOCATARIO) {
      const reservas = await this.reservaRepository.search(
        { idVeiculo: veiculo.id, idLocatario: requester.id },
        { page: 1, limit: 1 },
      );
      if (reservas.total > 0) return;
    }

    throw new HttpError(403, "Acesso negado");
  }

  // Valida o intervalo das coordenadas (defesa em profundidade — o schema Zod
  // já valida na borda, mas a regra de negócio também é garantida aqui).
  private assertCoordenadasValidas(latitude: number, longitude: number): void {
    if (latitude < -90 || latitude > 90) {
      throw new HttpError(400, "Latitude deve estar entre -90 e 90");
    }
    if (longitude < -180 || longitude > 180) {
      throw new HttpError(400, "Longitude deve estar entre -180 e 180");
    }
  }

  // Registra um novo ponto no histórico. Nunca sobrescreve registros anteriores.
  registrar = async (
    data: CreateLocalizacaoRequest,
  ): Promise<LocalizacaoResponse> => {
    await this.assertVeiculoExiste(data.idVeiculo);
    this.assertCoordenadasValidas(data.latitude, data.longitude);
    return this.localizacaoRepository.create(data);
  };

  // Histórico completo, ordenado cronologicamente (mais recente primeiro).
  findHistorico = async (
    idVeiculo: string,
    requester: LocalizacaoRequester,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocalizacaoResponse>> => {
    const veiculo = await this.getVeiculoOrThrow(idVeiculo);
    await this.assertPodeConsultar(veiculo, requester);
    return this.localizacaoRepository.findByVeiculoId(idVeiculo, pagination);
  };

  // Apenas a última localização conhecida (consulta eficiente, sem histórico).
  findUltima = async (
    idVeiculo: string,
    requester: LocalizacaoRequester,
  ): Promise<LocalizacaoResponse> => {
    const veiculo = await this.getVeiculoOrThrow(idVeiculo);
    await this.assertPodeConsultar(veiculo, requester);
    const ultima =
      await this.localizacaoRepository.findLatestByVeiculoId(idVeiculo);
    if (!ultima) {
      throw new HttpError(
        404,
        "Nenhuma localização registrada para este veículo",
      );
    }
    return ultima;
  };
}
