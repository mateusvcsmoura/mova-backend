import { HttpError } from "../errors/HttpError.js";
import {
  CreateLocadorRequest,
  UpdateLocadorRequest,
} from "../repositories/contracts/locador.contract.js";
import { LocadorRepository } from "../repositories/locador.repository.js";

export class LocadorService {
  constructor(private readonly locadorRepository: LocadorRepository) {}

  findAll = async () => {
    return await this.locadorRepository.findAll();
  };

  findById = async (id: string) => {
    return await this.locadorRepository.findById(id);
  };

  findByCnpj = async (cnpj: string) => {
    return await this.locadorRepository.findByCnpj(cnpj);
  };

  findByEmpresa = async (empresa: string) => {
    return await this.locadorRepository.findByEmpresa(empresa);
  };

  create = async (data: CreateLocadorRequest) => {
    const existingLocador =
      (await this.locadorRepository.findByCnpj(data.cnpj)) ||
      (await this.locadorRepository.findByEmpresa(data.empresa));

    if (existingLocador) {
      throw new HttpError(409, "Locador com este CNPJ ou empresa já existe");
    }

    return await this.locadorRepository.create(data);
  };

  update = async (id: string, data: UpdateLocadorRequest) => {
    const existingLocador = await this.locadorRepository.findById(id);

    if (!existingLocador) {
      throw new HttpError(404, "Locador não encontrado");
    }

    return await this.locadorRepository.update(id, data);
  };

  delete = async (id: string) => {
    const existingLocador = await this.locadorRepository.findById(id);

    if (!existingLocador) {
      throw new HttpError(404, "Locador não encontrado");
    }
    return await this.locadorRepository.delete(id);
  };
}
