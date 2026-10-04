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

// Task 10 (M-05): perfil criado na mesma transação da Conta. O id do perfil é
// sempre o id da Conta recém-criada, nunca um valor enviado pelo cliente.
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
