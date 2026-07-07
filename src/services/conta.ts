import { HttpError } from "../errors/HttpError.js";
import { IContaRepository } from "../repositories/conta.repository.js";
import {
  CreateContaRequest,
  UpdateContaRequest,
} from "../repositories/contracts/conta.contract.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ILocadorRepository } from "../repositories/locador.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { PaginationParams } from "../shared/pagination.js";
import { env } from "../config/env.js";

export class ContaService {
  constructor(
    private contaRepository: IContaRepository,
    private locadorRepository: ILocadorRepository,
    private locatarioRepository: ILocatarioRepository,
  ) {}

  // Gera o token JWT usando o segredo/expiração já validados em config/env.ts.
  // Payload único (id + cargo) compartilhado por register e login, para que o
  // authMiddleware — que exige `cargo` — aceite ambos os tokens.
  private gerarToken(payload: { id: string; cargo: string }): string {
    return jwt.sign(payload, env.JWT_SECRET as jwt.Secret, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }

  findAll = async (pagination: PaginationParams) => {
    return await this.contaRepository.findAll(pagination);
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

  async getCurrentAccount(id: string) {
    const [conta, locador, locatario] = await Promise.all([
      this.contaRepository.findById(id),
      this.locadorRepository.findById(id),
      this.locatarioRepository.findById(id),
    ]);

    if (!conta) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return {
      ...conta,
      locador: locador ?? null,
      locatario: locatario ?? null,
    };
  }

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

    // Mesmo payload do login (id + cargo) para que o authMiddleware aceite o
    // token emitido no cadastro.
    const token = this.gerarToken({ id: conta.id, cargo: conta.cargo });

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

    const token = this.gerarToken({ id: conta.id, cargo: conta.cargo });

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

    // Unicidade de e-mail no update: rejeita se o novo e-mail já pertence a
    // outra conta (o create já valida; aqui fecha a lacuna apontada na auditoria).
    if (data.email && data.email !== existingConta.email) {
      const emailEmUso = await this.contaRepository.findByEmail(data.email);
      if (emailEmUso && emailEmUso.id !== id) {
        throw new HttpError(409, "Email já está em uso");
      }
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
