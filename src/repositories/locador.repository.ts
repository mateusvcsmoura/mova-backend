import {
  LocadorResponse,
  CreateLocadorRequest,
  UpdateLocadorRequest,
} from "./contracts/locador.contract";

export interface ILocadorRepository {
  findAll(): Promise<LocadorResponse[]>;
  findById(id: string): Promise<LocadorResponse | null>;
  findByCnpj(cnpj: string): Promise<LocadorResponse | null>;
  findByEmpresa(empresa: string): Promise<LocadorResponse[]>;
  create(data: CreateLocadorRequest): Promise<LocadorResponse>;
  update(
    id: string,
    data: UpdateLocadorRequest,
  ): Promise<LocadorResponse | null>;
  delete(id: string): Promise<void>;
}
