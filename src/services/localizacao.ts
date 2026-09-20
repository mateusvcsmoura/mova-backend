import { Cargo, StatusReserva } from "@prisma/client";
import { HttpError } from "../errors/HttpError.js";
import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
  RastreamentoReservaResponse,
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
    requester: LocalizacaoRequester,
  ): Promise<LocalizacaoResponse> => {
    const veiculo = await this.getVeiculoOrThrow(data.idVeiculo);
    if (requester.cargo !== Cargo.ADMIN && veiculo.idLocador !== requester.id) {
      throw new HttpError(403, "Acesso negado");
    }
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

  // RF14: o Locatário nunca consulta um veículo diretamente. A reserva do
  // próprio token define veículo, estado e janela temporal permitidos.
  findUltimaDaReserva = async (
    idReserva: string,
    requester: LocalizacaoRequester,
  ): Promise<RastreamentoReservaResponse> => {
    if (requester.cargo !== Cargo.LOCATARIO) {
      throw new HttpError(403, "Acesso negado");
    }

    const reserva = await this.reservaRepository.findById(idReserva);
    if (!reserva) {
      throw new HttpError(404, "Reserva não encontrada");
    }
    if (reserva.idLocatario !== requester.id) {
      throw new HttpError(403, "Acesso negado");
    }

    const agora = new Date();
    const statusPermitido =
      reserva.status === StatusReserva.CONFIRMADA ||
      reserva.status === StatusReserva.EM_ANDAMENTO;
    if (
      !statusPermitido ||
      agora < reserva.dataHoraInicio ||
      agora > reserva.dataHoraFim
    ) {
      throw new HttpError(409, "Rastreamento indisponível para esta reserva");
    }

    const ultima = await this.localizacaoRepository.findLatestByVeiculoId(
      reserva.idVeiculo,
    );
    const modelo = reserva.veiculo.modeloVeiculo;
    const nome = `${modelo.marca} ${modelo.modelo}`.trim() || "Veículo";

    return {
      reservaId: reserva.id,
      veiculo: { id: reserva.veiculo.id, placa: reserva.veiculo.placa, nome },
      localizacao: ultima
        ? {
            latitude: ultima.latitude,
            longitude: ultima.longitude,
            dataHora: ultima.dataHora,
          }
        : null,
    };
  };
}
