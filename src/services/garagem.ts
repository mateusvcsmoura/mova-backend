import { Cargo } from "@prisma/client";

import { HttpError } from "../errors/HttpError.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import {
  CreateGaragemRequest,
  GaragemBaseResponse,
  GaragemDetalhadaResponse,
  GaragemFilters,
  GaragemVeiculosFilters,
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

export class GaragemService {
  constructor(
    private readonly garagemRepository: IGaragemRepository,
    private readonly veiculoRepository: IVeiculoRepository,
  ) {}

  private assertGaragemAccess(
    requester: GaragemAccessContext,
    garagem: GaragemBaseResponse,
  ) {
    if (requester.cargo === Cargo.ADMIN) {
      return;
    }

    if (
      requester.cargo !== Cargo.LOCADOR ||
      requester.id !== garagem.idLocador
    ) {
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

    this.assertGaragemAccess(requester, garagem);

    const updatedGaragem = await this.garagemRepository.update(id, data);

    if (!updatedGaragem) {
      throw new HttpError(404, "Garagem não encontrada");
    }

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

    this.assertGaragemAccess(requester, garagem);

    await this.garagemRepository.delete(id);
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

    await this.garagemRepository.alocarVeiculo(garagemId, veiculoId);
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

    await this.garagemRepository.desalocarVeiculo(garagemId, veiculoId);
  };
}
