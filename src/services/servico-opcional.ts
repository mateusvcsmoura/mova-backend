import { HttpError } from "../errors/HttpError.js";
import { ServicoOpcionalFilters } from "../repositories/contracts/servico-opcional.contract.js";
import { IServicoOpcionalRepository } from "../repositories/servico-opcional.repository.js";
import { PaginationParams } from "../shared/pagination.js";

export class ServicoOpcionalService {
  constructor(
    private readonly servicoOpcionalRepository: IServicoOpcionalRepository,
  ) {}

  list = async (filters: ServicoOpcionalFilters, pagination: PaginationParams) => {
    return await this.servicoOpcionalRepository.findAll(filters, pagination);
  };

  findById = async (id: string) => {
    const servico = await this.servicoOpcionalRepository.findById(id);
    if (!servico) {
      throw new HttpError(404, "Serviço opcional não encontrado");
    }
    return servico;
  };
}
