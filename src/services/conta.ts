import { HttpError } from "../errors/HttpError.js";
import { IContaRepository } from "../repositories/conta.repository.js";
import {
  CreateContaRequest,
  UpdateContaRequest,
} from "../repositories/contracts/conta.contract.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export class ContaService {
  constructor(private contaRepository: IContaRepository) {}

  findAll = async () => {
    return await this.contaRepository.findAll();
  };

  findByEmail = async (email: string) => {
    const conta = await this.contaRepository.findByEmail(email);

    if (!conta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return conta;
  };

  findById = async (id: string) => {
    const conta = await this.contaRepository.findById(id);

    if (!conta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return conta;
  };

  async register(data: CreateContaRequest) {
    const contaExistente = await this.contaRepository.findByEmail(data.email);

    if (contaExistente) {
      throw new HttpError(409, "Email já em uso");
    }

    const senhaHash = await bcrypt.hash(data.senha, 10);

    const conta = await this.contaRepository.create({
      ...data,
      senha: senhaHash,
    });

    const secret = process.env.JWT_SECRET as jwt.Secret;
    const expiresIn =
      (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "1h";

    const token = jwt.sign({ id: conta.id }, secret, {
      expiresIn,
    });

    return { conta, token };
  }

  async login(email: string, senha: string) {
    const conta = await this.contaRepository.findAuthByEmail(email);

    if (!conta) {
      throw new HttpError(401, "Credenciais inválidas");
    }

    const senhaValida = await bcrypt.compare(senha, conta.senhaHash);

    if (!senhaValida) {
      throw new HttpError(401, "Credenciais inválidas");
    }

    const secret = process.env.JWT_SECRET as jwt.Secret;
    const expiresIn =
      (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "1h";

    const token = jwt.sign({ id: conta.id }, secret, {
      expiresIn,
    });

    return { token };
  }

  async changePassword(id: string, senhaAtual: string, novaSenha: string) {
    const conta = await this.contaRepository.findById(id);

    if (!conta) throw new HttpError(404, "Conta não encontrada");

    const auth = await this.contaRepository.findAuthByEmail(conta.email);

    const senhaValida = await bcrypt.compare(senhaAtual, auth!.senhaHash);

    if (!senhaValida) {
      throw new HttpError(400, "Senha atual incorreta");
    }

    const novaHash = await bcrypt.hash(novaSenha, 10);

    await this.contaRepository.updatePassword(id, novaHash);
  }

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

  delete = async (id: string) => {
    const existingConta = await this.contaRepository.findById(id);

    if (!existingConta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    await this.contaRepository.delete(id);
  };
}
