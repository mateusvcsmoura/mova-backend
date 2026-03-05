import { HttpError } from "../errors/HttpError.js";
import {
  CreateVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
  VeiculoStatus,
} from "../repositories/contracts/veiculo.contract.js";
import { VeiculoRepository } from "../repositories/veiculo.repository.js";

export class VeiculoService {
  constructor(private veiculoRepository: VeiculoRepository) {}

  findAll = async () => {
    return await this.veiculoRepository.findAll();
  };

  findByLocadorId = async (id_locador: string) => {
    const veiculos = await this.veiculoRepository.findByLocadorId(id_locador);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para este locador");
    }

    return veiculos;
  };

  findById = async (id: string) => {
    const veiculo = await this.veiculoRepository.findById(id);

    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    return veiculo;
  };

  findByPlaca = async (placa: string) => {
    const veiculo = await this.veiculoRepository.findByPlaca(placa);

    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    return veiculo;
  };

  async findByMarca(marca: string) {
    const veiculos = await this.veiculoRepository.findByMarca(marca);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para esta marca");
    }

    return veiculos;
  }

  async findByModelo(modelo: string) {
    const veiculos = await this.veiculoRepository.findByModelo(modelo);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para este modelo");
    }

    return veiculos;
  }

  async findByAno(ano: number) {
    const veiculos = await this.veiculoRepository.findByAno(ano);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para este ano");
    }

    return veiculos;
  }

  async findByCambio(cambio: string) {
    const veiculos = await this.veiculoRepository.findByCambio(cambio);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para este câmbio");
    }

    return veiculos;
  }

  async findByCapacidade(capacidade: number) {
    const veiculos = await this.veiculoRepository.findByCapacidade(capacidade);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(
        404,
        "Nenhum veículo encontrado para esta capacidade",
      );
    }

    return veiculos;
  }

  async findByStatus(status: string) {
    const veiculos = await this.veiculoRepository.findByStatus(status);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para este status");
    }

    return veiculos;
  }

  async findByEletrico(eletrico: boolean) {
    const veiculos = await this.veiculoRepository.findByEletrico(eletrico);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(
        404,
        "Nenhum veículo encontrado para esta característica",
      );
    }

    return veiculos;
  }

  async findByAdaptado(adaptado: boolean) {
    const veiculos = await this.veiculoRepository.findByAdaptado(adaptado);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(
        404,
        "Nenhum veículo encontrado para esta característica",
      );
    }

    return veiculos;
  }

  async search(filters: VeiculoFilters) {
    return this.veiculoRepository.search(filters);
  }

  async create(data: CreateVeiculoRequest) {
    const existingVeiculo = await this.veiculoRepository.findByPlaca(
      data.placa,
    );

    if (existingVeiculo) {
      throw new HttpError(409, "Veículo com esta placa já existe");
    }

    return this.veiculoRepository.create({
      ...data,
      status: data.status ?? VeiculoStatus.DISPONIVEL,
    });
  }

  async update(id: string, data: UpdateVeiculoRequest) {
    const veiculo = await this.veiculoRepository.findById(id);

    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    return this.veiculoRepository.update(id, data);
  }

  async delete(id: string) {
    const veiculo = await this.veiculoRepository.findById(id);

    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }

    return this.veiculoRepository.delete(id);
  }
}
