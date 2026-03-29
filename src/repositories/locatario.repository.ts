import {
  LocatarioResponse,
  CreateLocatarioRequest,
  UpdateLocatarioRequest,
} from "./contracts/locatario.contract";

export interface ILocatarioRepository {
  findAll(): Promise<LocatarioResponse[]>;
  findById(id: string): Promise<LocatarioResponse | null>;
  findByCpf(cpf: string): Promise<LocatarioResponse | null>;
  findByCnh(cnh: string): Promise<LocatarioResponse | null>;
  create(data: CreateLocatarioRequest): Promise<LocatarioResponse>;
  update(
    id: string,
    data: UpdateLocatarioRequest,
  ): Promise<LocatarioResponse | null>;
  delete(id: string): Promise<void>;
}
