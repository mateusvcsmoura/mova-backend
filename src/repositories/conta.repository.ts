import {
  ContaResponse,
  CreateContaRequest,
  UpdateContaRequest,
} from "./contracts/conta.contract.js";

export interface IContaRepository {
  findAll(): Promise<ContaResponse[]>;
  findByEmail(email: string): Promise<ContaResponse | null>;
  findAuthByEmail(email: string): Promise<{ id: string; email: string; senhaHash: string, cargo: string } | null>;
  findById(id: string): Promise<ContaResponse | null>;
  create(data: CreateContaRequest): Promise<ContaResponse>;
  update(id: string, data: UpdateContaRequest): Promise<ContaResponse | null>;
  updatePassword(id: string, senhaHash: string): Promise<void>;
  delete(id: string): Promise<void>;
}
