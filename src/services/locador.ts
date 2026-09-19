import { HttpError } from "../errors/HttpError.js";
import { Cargo } from "@prisma/client";
import {
  CreateLocadorRequest,
  UpdateLocadorRequest,
} from "../repositories/contracts/locador.contract.js";
import { ILocadorRepository } from "../repositories/locador.repository.js";
import { PaginationParams } from "../shared/pagination.js";
import { buildPaginatedResult } from "../shared/pagination.js";

interface LocadorRequester {
  id: string;
  cargo: Cargo;
}

export class LocadorService {
  constructor(private readonly locadorRepository: ILocadorRepository) {}

  private assertOwnProfile(id: string, requester: LocadorRequester) {
    if (requester.cargo === Cargo.ADMIN) return;

    if (requester.cargo !== Cargo.LOCADOR || requester.id !== id) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  private async findOwnProfile(requester: LocadorRequester) {
    const locador = await this.locadorRepository.findById(requester.id);
    if (!locador) throw new HttpError(404, "Locador não encontrado");
    return locador;
  }

  findAll = async (pagination: PaginationParams, requester: LocadorRequester) => {
    if (requester.cargo === Cargo.ADMIN) {
      return this.locadorRepository.findAll(pagination);
    }

    const locador = await this.findOwnProfile(requester);
    return buildPaginatedResult([locador], 1, pagination);
  };

  findById = async (id: string, requester: LocadorRequester) => {
    this.assertOwnProfile(id, requester);
    const locador = await this.locadorRepository.findById(id);

    if (!locador) {
      throw new HttpError(404, "Locador não encontrado");
    }

    return locador;
  };

  findByCnpj = async (cnpj: string, requester: LocadorRequester) => {
    if (requester.cargo !== Cargo.ADMIN) return this.findOwnProfile(requester);
    const locador = await this.locadorRepository.findByCnpj(cnpj);

    if (!locador) {
      throw new HttpError(404, "Locador não encontrado");
    }

    return locador;
  };

  findByEmpresa = async (empresa: string, pagination: PaginationParams, requester: LocadorRequester) => {
    if (requester.cargo !== Cargo.ADMIN) {
      const locador = await this.findOwnProfile(requester);
      return buildPaginatedResult([locador], 1, pagination);
    }
    const locadores = await this.locadorRepository.findByEmpresa(
      empresa,
      pagination,
    );

    if (locadores.total === 0) {
      throw new HttpError(
        404,
        "Nenhum locador encontrado para a empresa especificada",
      );
    }

    return locadores;
  };

  create = async (data: CreateLocadorRequest, requester: LocadorRequester) => {
    const id = requester.cargo === Cargo.ADMIN ? data.id : requester.id;
    if (!id) throw new HttpError(400, "ID do locador é obrigatório");

    const existingByCnpj = await this.locadorRepository.findByCnpj(data.cnpj);
    const existingByEmpresa = await this.locadorRepository.findByEmpresa(
      data.empresa,
      { page: 1, limit: 1 },
    );

    if (existingByCnpj || existingByEmpresa.total > 0) {
      throw new HttpError(409, "Locador com este CNPJ ou empresa já existe");
    }

    return await this.locadorRepository.create({ ...data, id });
  };

  update = async (id: string, data: UpdateLocadorRequest, requester: LocadorRequester) => {
    this.assertOwnProfile(id, requester);
    const existingLocador = await this.locadorRepository.findById(id);

    if (!existingLocador) {
      throw new HttpError(404, "Locador não encontrado");
    }

    return await this.locadorRepository.update(id, data);
  };

  delete = async (id: string, requester: LocadorRequester) => {
    this.assertOwnProfile(id, requester);
    const existingLocador = await this.locadorRepository.findById(id);

    if (!existingLocador) {
      throw new HttpError(404, "Locador não encontrado");
    }
    return await this.locadorRepository.delete(id);
  };
}
