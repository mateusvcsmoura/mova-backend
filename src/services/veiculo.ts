import { StatusVeiculo } from "@prisma/client";
import { HttpError } from "../errors/HttpError.js";
import {
  CreateVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
} from "../repositories/contracts/veiculo.contract.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";

export class VeiculoService {
  constructor(private veiculoRepository: IVeiculoRepository) {}

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

  async search(filters: VeiculoFilters) {
    const veiculos = await this.veiculoRepository.search(filters);

    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(
        404,
        "Nenhum veículo encontrado com os filtros fornecidos",
      );
    }

    return veiculos;
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
      status: data.status ?? StatusVeiculo.DISPONIVEL,
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
