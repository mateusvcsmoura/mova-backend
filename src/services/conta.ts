import { HttpError } from "../errors/HttpError.js";
import { ContaRepository } from "../repositories/conta.repository.js";
import {
  CreateContaRequest,
  UpdateContaRequest,
} from "../repositories/contracts/conta.contract.js";

export class ContaService {
  constructor(private readonly contaRepository: ContaRepository) {}

  findAll = async () => {
    return await this.contaRepository.findAll();
  };

  findByEmail = async (email: string) => {
    return await this.contaRepository.findByEmail(email);
  };

  findById = async (id: string) => {
    return await this.contaRepository.findById(id);
  };

  create = async (data: CreateContaRequest) => {
    const existingConta = await this.contaRepository.findByEmail(data.email);

    if (existingConta) {
      throw new HttpError(409, "Email já está em uso");
    }

    return await this.contaRepository.create(data);
  };

  update = async (id: string, data: UpdateContaRequest) => {
    const existingConta = await this.contaRepository.findById(id);

    if (!existingConta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return await this.contaRepository.update(id, data);
  };

  updatePassword = async (id: string, senha_hash: string) => {
    const existingConta = await this.contaRepository.findById(id);

    if (!existingConta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    await this.contaRepository.updatePassword(id, senha_hash);
  };

  delete = async (id: string) => {
    const existingConta = await this.contaRepository.findById(id);

    if (!existingConta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    await this.contaRepository.delete(id);
  };
}
