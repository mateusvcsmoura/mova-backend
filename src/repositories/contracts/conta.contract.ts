import { Cargo } from "@prisma/client";

export interface CreateContaRequest {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
  cep: string;
  endereco: string;
  cargo: Cargo;
}

export interface UpdateContaRequest {
  nome?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  endereco?: string;
  cargo?: Cargo;
}

export interface ContaResponse {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  criadaEm: Date;
  cep: string;
  endereco: string;
  cargo: Cargo;
}
