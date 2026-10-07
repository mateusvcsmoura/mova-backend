import { Cargo, StatusGaragem, StatusVeiculo } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import {
  CreateGaragemRequest,
  GaragemBaseResponse,
  GaragemDetalhadaResponse,
  GaragemFilters,
  GaragemVeiculosFilters,
  PublicGaragemResponse,
  UpdateGaragemRequest,
} from "../repositories/contracts/garagem.contract.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import {
  PaginatedResult,
  PaginationParams,
} from "../shared/pagination.js";
import { VeiculoResponse } from "../repositories/contracts/veiculo.contract.js";

interface GaragemAccessContext {
  id: string;
  cargo: Cargo;
}

interface ListGaragemRequest {
  requester: GaragemAccessContext;
  filters?: GaragemFilters;
  pagination: PaginationParams;
}

interface MediaVisibilitySynchronizer {
  sincronizarVisibilidadeVeiculo(idVeiculo: string): Promise<void>;
  sincronizarVisibilidadeGaragem(idGaragem: string): Promise<void>;
}

export class GaragemService {
  constructor(
    private readonly garagemRepository: IGaragemRepository,
    private readonly veiculoRepository: IVeiculoRepository,
    private readonly mediaVisibility?: MediaVisibilitySynchronizer,
  ) {}

  private paraCatalogo(garagem: GaragemBaseResponse): PublicGaragemResponse {
    return {
      id: garagem.id,
      nome: garagem.nome,
      endereco: garagem.endereco,
      capacidade: garagem.capacidade,
      veiculosAlocados: garagem.veiculosAlocados,
      acessibilidade: garagem.acessibilidade,
      status: garagem.status,
    };
  }

  listPublic = async (
    filters: GaragemFilters,
    pagination: PaginationParams,
    veiculoId?: string,
  ) => {
    let idLocador = filters.idLocador;
    if (veiculoId) {
      const veiculo = await this.veiculoRepository.findById(veiculoId);
      if (
        !veiculo ||
        veiculo.status !== StatusVeiculo.DISPONIVEL ||
        veiculo.garagem?.status !== StatusGaragem.ATIVA
      ) {
        throw new HttpError(404, "Veículo não encontrado");
      }
      idLocador = veiculo.idLocador;
    }

    const resultado = await this.garagemRepository.findAll(
      { ...filters, idLocador, status: StatusGaragem.ATIVA },
      pagination,
    );
    return {
      ...resultado,
      data: resultado.data.map((garagem) => this.paraCatalogo(garagem)),
    };
  };

  findPublicById = async (id: string): Promise<PublicGaragemResponse> => {
    const garagem = await this.garagemRepository.findById(id);
    if (!garagem || garagem.status !== StatusGaragem.ATIVA) {
      throw new HttpError(404, "Garagem não encontrada");
    }
    return this.paraCatalogo(garagem);
  };

  private assertGaragemAccess(
    requester: GaragemAccessContext,
    garagem: GaragemBaseResponse,
  ) {
    if (requester.cargo === Cargo.ADMIN) {
      return;
    }

    if (requester.cargo === Cargo.LOCATARIO) {
      if (garagem.status !== StatusGaragem.ATIVA) {
        throw new HttpError(404, "Garagem não encontrada");
      }
      return;
    }

    if (
      requester.cargo !== Cargo.LOCADOR ||
      requester.id !== garagem.idLocador
    ) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  private assertPodeGerenciar(
    requester: GaragemAccessContext,
    garagem: GaragemBaseResponse,
  ) {
    if (requester.cargo === Cargo.ADMIN) return;
    if (requester.cargo !== Cargo.LOCADOR || requester.id !== garagem.idLocador) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  private assertLocadorResponsavel(
    requester: GaragemAccessContext,
    garagem: GaragemBaseResponse,
  ) {
    if (
      requester.cargo !== Cargo.LOCADOR ||
      requester.id !== garagem.idLocador
    ) {
      throw new HttpError(
        403,
        "Apenas o locador responsável pode gerenciar veículos nesta garagem",
      );
    }
  }

  list = async ({
    requester,
    filters,
    pagination,
  }: ListGaragemRequest): Promise<PaginatedResult<GaragemBaseResponse>> => {
    if (requester.cargo === Cargo.ADMIN) {
      return this.garagemRepository.findAll(filters ?? {}, pagination);
    }

    if (requester.cargo === Cargo.LOCATARIO) {
      return this.garagemRepository.findAll(
        { ...(filters ?? {}), status: StatusGaragem.ATIVA },
        pagination,
      );
    }

    if (requester.cargo !== Cargo.LOCADOR) {
      throw new HttpError(403, "Acesso negado");
    }

    return this.garagemRepository.findAll(
      {
        ...(filters ?? {}),
        idLocador: requester.id,
      },
      pagination,
    );
  };

  findById = async (
    id: string,
    requester: GaragemAccessContext,
  ): Promise<GaragemDetalhadaResponse> => {
    const garagem = await this.garagemRepository.findById(id);

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    this.assertGaragemAccess(requester, garagem);

    return garagem;
  };

  findVeiculosByGaragem = async (
    garagemId: string,
    requester: GaragemAccessContext,
    pagination: PaginationParams,
    filters?: GaragemVeiculosFilters,
  ): Promise<PaginatedResult<VeiculoResponse>> => {
    const garagem = await this.garagemRepository.findById(garagemId);

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    this.assertGaragemAccess(requester, garagem);

    return this.garagemRepository.findVeiculosByGaragem(
      garagemId,
      pagination,
      filters,
    );
  };

  create = async (
    data: CreateGaragemRequest,
    requester: GaragemAccessContext,
  ): Promise<GaragemBaseResponse> => {
    if (requester.cargo !== Cargo.ADMIN && requester.id !== data.idLocador) {
      throw new HttpError(403, "Acesso negado");
    }

    return this.garagemRepository.create(data);
  };

  update = async (
    id: string,
    data: UpdateGaragemRequest,
    requester: GaragemAccessContext,
  ): Promise<GaragemBaseResponse> => {
    const hasData = Object.values(data).some((value) => value !== undefined);

    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    const garagem = await this.garagemRepository.findById(id);

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    this.assertPodeGerenciar(requester, garagem);

    const updatedGaragem = await this.garagemRepository.update(id, data);

    if (!updatedGaragem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    await this.mediaVisibility?.sincronizarVisibilidadeGaragem(id);

    return updatedGaragem;
  };

  delete = async (
    id: string,
    requester: GaragemAccessContext,
  ): Promise<void> => {
    const garagem = await this.garagemRepository.findById(id);

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    this.assertPodeGerenciar(requester, garagem);

    await this.garagemRepository.delete(id);
    await this.mediaVisibility?.sincronizarVisibilidadeGaragem(id);
  };

  alocarVeiculo = async (
    garagemId: string,
    veiculoId: string,
    requester: GaragemAccessContext,
  ): Promise<void> => {
    const garagem = await this.garagemRepository.findById(garagemId);

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    this.assertLocadorResponsavel(requester, garagem);

    const veiculo = await this.veiculoRepository.findById(veiculoId);

    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    if (veiculo.idLocador !== garagem.idLocador) {
      throw new HttpError(
        403,
        "O veículo precisa pertencer ao mesmo locador responsável pela garagem",
      );
    }

    await this.garagemRepository.alocarVeiculo(garagemId, veiculoId, requester);
    await this.mediaVisibility?.sincronizarVisibilidadeVeiculo(veiculoId);
  };

  desalocarVeiculo = async (
    garagemId: string,
    veiculoId: string,
    requester: GaragemAccessContext,
  ): Promise<void> => {
    const garagem = await this.garagemRepository.findById(garagemId);

    if (!garagem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

    this.assertLocadorResponsavel(requester, garagem);

    const veiculo = await this.veiculoRepository.findById(veiculoId);

    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    if (veiculo.idLocador !== garagem.idLocador) {
      throw new HttpError(
        403,
        "O veículo precisa pertencer ao mesmo locador responsável pela garagem",
      );
    }

    await this.garagemRepository.desalocarVeiculo(garagemId, veiculoId, requester);
    await this.mediaVisibility?.sincronizarVisibilidadeVeiculo(veiculoId);
  };
}
