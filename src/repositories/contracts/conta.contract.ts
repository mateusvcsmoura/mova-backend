import { Cargo, Locador, Locatario } from "@prisma/client";
import { CreateLocatarioRequest } from "./locatario.contract.js";
import { CreateLocadorRequest } from "./locador.contract.js";

export interface CreateContaRequest {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
  cep: string;
  endereco: string;
  cargo: Cargo;
}

export interface PerfilCadastro {
  locatario?: Omit<CreateLocatarioRequest, "id">;
  locador?: Omit<CreateLocadorRequest, "id">;
}

export interface PerfilCriado {
  locatario?: Locatario;
  locador?: Locador;
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
