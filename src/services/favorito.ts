import { HttpError } from "../errors/HttpError.js";
import { FavoritoResponse } from "../repositories/contracts/favorito.contract.js";
import { IFavoritoRepository } from "../repositories/favorito.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";

export interface VerificarFavoritoResponse {
  favoritado: boolean;
  favorito: FavoritoResponse | null;
}

// Isolamento por usuário: todos os métodos recebem o id do locatário extraído
// do token (req.user.id) — nunca do body/params. Um locatário só enxerga e
// modifica os próprios favoritos.
export class FavoritoService {
  constructor(
    private readonly favoritoRepository: IFavoritoRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly locatarioRepository: ILocatarioRepository,
  ) {}

  // Conta LOCATARIO pode existir sem o registro de Locatario (cadastro em duas
  // etapas) — o favorito exige o registro por causa da FK.
  private async assertLocatarioExiste(idLocatario: string): Promise<void> {
    const locatario = await this.locatarioRepository.findById(idLocatario);
    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }
  }

  private async assertVeiculoExiste(idVeiculo: string): Promise<void> {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
  }

  favoritar = async (
    idLocatario: string,
    idVeiculo: string,
  ): Promise<FavoritoResponse> => {
    await this.assertLocatarioExiste(idLocatario);
    await this.assertVeiculoExiste(idVeiculo);

    const jaFavoritado = await this.favoritoRepository.exists(
      idLocatario,
      idVeiculo,
    );
    if (jaFavoritado) {
      throw new HttpError(409, "Este veículo já está nos seus favoritos.");
    }

    return this.favoritoRepository.create({ idLocatario, idVeiculo });
  };

  desfavoritar = async (
    idLocatario: string,
    idVeiculo: string,
  ): Promise<void> => {
    const existe = await this.favoritoRepository.exists(
      idLocatario,
      idVeiculo,
    );
    if (!existe) {
      throw new HttpError(404, "Favorito não encontrado");
    }

    await this.favoritoRepository.delete(idLocatario, idVeiculo);
  };

  listar = async (
    idLocatario: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<FavoritoResponse>> => {
    return this.favoritoRepository.findByLocatarioId(idLocatario, pagination);
  };

  verificar = async (
    idLocatario: string,
    idVeiculo: string,
  ): Promise<VerificarFavoritoResponse> => {
    await this.assertVeiculoExiste(idVeiculo);

    const favorito = await this.favoritoRepository.findByLocatarioAndVeiculo(
      idLocatario,
      idVeiculo,
    );

    return { favoritado: favorito !== null, favorito };
  };
}
