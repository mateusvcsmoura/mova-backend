import { CreateLocadorRequest } from "../repositories/contracts/locador.contract.js";
import { LocadorRepository } from "../repositories/locador.repository.js";

export class LocadorService {
  constructor(private readonly locadorRepository: LocadorRepository) {}

  findAll = async () => {
    return await this.locadorRepository.findAll();
  };

  findById = async (id: number) => {
    return await this.locadorRepository.findById(id);
  };

  findByCnpj = async (cnpj: string) => {
    return await this.locadorRepository.findByCnpj(cnpj);
  };

  findByName = async (nome: string) => {
    return await this.locadorRepository.findByName(nome);
  };

  create = async (data: CreateLocadorRequest) => {
    return await this.locadorRepository.create(data);
  };
}
