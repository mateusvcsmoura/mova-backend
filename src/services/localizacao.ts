import { HttpError } from "../errors/HttpError.js";
import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
} from "../repositories/contracts/localizacao.contract.js";
import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";

export class LocalizacaoService {
  constructor(
    private readonly localizacaoRepository: ILocalizacaoRepository,
    private readonly veiculoRepository: IVeiculoRepository,
  ) {}

  // Garante que o veículo existe antes de qualquer operação de localização.
  private async assertVeiculoExiste(idVeiculo: string): Promise<void> {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
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
  ): Promise<LocalizacaoResponse[]> => {
    await this.assertVeiculoExiste(idVeiculo);
    return this.localizacaoRepository.findByVeiculoId(idVeiculo);
  };

  // Apenas a última localização conhecida (consulta eficiente, sem histórico).
  findUltima = async (idVeiculo: string): Promise<LocalizacaoResponse> => {
    await this.assertVeiculoExiste(idVeiculo);
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
