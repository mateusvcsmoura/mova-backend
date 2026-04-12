import { HttpError } from "../errors/HttpError.js";
import {
  CreateLocadorRequest,
  UpdateLocadorRequest,
} from "../repositories/contracts/locador.contract.js";
import { ILocadorRepository } from "../repositories/locador.repository.js";

export class LocadorService {
  constructor(private readonly locadorRepository: ILocadorRepository) {}

  findAll = async () => {
    return await this.locadorRepository.findAll();
  };

  findById = async (id: string) => {
    const locador = await this.locadorRepository.findById(id);

    if (!locador) {
      throw new HttpError(404, "Locador não encontrado");
    }

    return locador;
  };

  findByCnpj = async (cnpj: string) => {
    const locador = await this.locadorRepository.findByCnpj(cnpj);

    if (!locador) {
      throw new HttpError(404, "Locador não encontrado");
    }

    return locador;
  };

  findByEmpresa = async (empresa: string) => {
    const locadores = await this.locadorRepository.findByEmpresa(empresa);

    if (locadores.length === 0) {
      throw new HttpError(
        404,
        "Nenhum locador encontrado para a empresa especificada",
      );
    }

    return locadores;
  };

  create = async (data: CreateLocadorRequest) => {
    const existingByCnpj = await this.locadorRepository.findByCnpj(data.cnpj);
    const existingByEmpresa = await this.locadorRepository.findByEmpresa(data.empresa);

    if (existingByCnpj || existingByEmpresa.length > 0) {
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
