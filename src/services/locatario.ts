import { Cargo } from "@prisma/client";
import { HttpError } from "../errors/HttpError.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { CreateLocatarioRequest, UpdateLocatarioRequest } from "../repositories/contracts/locatario.contract.js";
import { buildPaginatedResult, PaginationParams } from "../shared/pagination.js";

interface LocatarioRequester {
  id: string;
  cargo: Cargo;
}

type CreateLocatarioPayload = Omit<CreateLocatarioRequest, "id"> & {
  id?: string;
};

export class LocatarioService {
  constructor(private readonly locatarioRepository: ILocatarioRepository) {}

  private assertOwnProfile(id: string, requester: LocatarioRequester) {
    if (requester.cargo === Cargo.ADMIN) return;
    if (requester.cargo !== Cargo.LOCATARIO || requester.id !== id) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  private async findOwnProfile(requester: LocatarioRequester) {
    const locatario = await this.locatarioRepository.findById(requester.id);
    if (!locatario) throw new HttpError(404, "Locatário não encontrado");
    return locatario;
  }

  findAll = async (pagination: PaginationParams, requester: LocatarioRequester) => {
    if (requester.cargo === Cargo.ADMIN) {
      return this.locatarioRepository.findAll(pagination);
    }

    const locatario = await this.findOwnProfile(requester);
    return buildPaginatedResult([locatario], 1, pagination);
  };

  findById = async (id: string, requester: LocatarioRequester) => {
    this.assertOwnProfile(id, requester);
    const locatario = await this.locatarioRepository.findById(id);
    if (!locatario) throw new HttpError(404, "Locatário não encontrado");
    return locatario;
  };

  findByCpf = async (cpf: string, requester: LocatarioRequester) => {
    if (requester.cargo !== Cargo.ADMIN) return this.findOwnProfile(requester);
    const locatario = await this.locatarioRepository.findByCpf(cpf);
    if (!locatario) throw new HttpError(404, "Locatário não encontrado");
    return locatario;
  };

  findByCnh = async (cnh: string, requester: LocatarioRequester) => {
    if (requester.cargo !== Cargo.ADMIN) return this.findOwnProfile(requester);
    const locatario = await this.locatarioRepository.findByCnh(cnh);
    if (!locatario) throw new HttpError(404, "Locatário não encontrado");
    return locatario;
  };

  create = async (data: CreateLocatarioPayload, requester: LocatarioRequester) => {
    const id = requester.cargo === Cargo.ADMIN ? data.id : requester.id;
    if (!id) throw new HttpError(400, "ID do locatário é obrigatório");

    const existingLocatario =
      (await this.locatarioRepository.findByCpf(data.cpf)) ||
      (await this.locatarioRepository.findByCnh(data.cnh));
    if (existingLocatario) {
      throw new HttpError(409, "Locatário com este CPF ou CNH já existe");
    }

    return this.locatarioRepository.create({ ...data, id });
  };

  update = async (id: string, data: UpdateLocatarioRequest, requester: LocatarioRequester) => {
    this.assertOwnProfile(id, requester);
    const existingLocatario = await this.locatarioRepository.findById(id);
    if (!existingLocatario) throw new HttpError(404, "Locatário não encontrado");
    return this.locatarioRepository.update(id, data);
  };

  delete = async (id: string, requester: LocatarioRequester) => {
    this.assertOwnProfile(id, requester);
    const existingLocatario = await this.locatarioRepository.findById(id);
    if (!existingLocatario) throw new HttpError(404, "Locatário não encontrado");
    return this.locatarioRepository.delete(id);
  };
}
