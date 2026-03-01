import { CreateLocatarioRequest } from "./../repositories/contracts/locatario.contract.js";
import { LocatarioRepository } from "../repositories/locatario.repository.js";
import { HttpError } from "../errors/HttpError.js";
import { UpdateLocatarioRequest } from "../repositories/contracts/locatario.contract.js";

export class LocatarioService {
  constructor(private readonly locatarioRepository: LocatarioRepository) {}

  findAll = async () => {
    return await this.locatarioRepository.findAll();
  };

  findById = async (id: string) => {
    const locatario = await this.locatarioRepository.findById(id);

    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }
    return locatario;
  };

  findByCpf = async (cpf: string) => {
    const locatario = await this.locatarioRepository.findByCpf(cpf);

    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }
    return locatario;
  };

  findByCnh = async (cnh: string) => {
    const locatario = await this.locatarioRepository.findByCnh(cnh);

    if (!locatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }
    return locatario;
  };

  create = async (data: CreateLocatarioRequest) => {
    const existingLocatario =
      (await this.locatarioRepository.findByCpf(data.cpf)) ||
      (await this.locatarioRepository.findByCnh(data.cnh));

    if (existingLocatario) {
      throw new HttpError(409, "Locatário com este CPF ou CNH já existe");
    }

    return await this.locatarioRepository.create(data);
  };

  update = async (id: string, data: UpdateLocatarioRequest) => {
    const existingLocatario = await this.locatarioRepository.findById(id);

    if (!existingLocatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }

    return await this.locatarioRepository.update(id, data);
  };

  delete = async (id: string) => {
    const existingLocatario = await this.locatarioRepository.findById(id);

    if (!existingLocatario) {
      throw new HttpError(404, "Locatário não encontrado");
    }

    return await this.locatarioRepository.delete(id);
  };
}
