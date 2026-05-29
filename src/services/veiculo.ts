import { StatusVeiculo } from "@prisma/client";
import { HttpError } from "../errors/HttpError.js";
import {
  CreateVeiculoLoteRequest,
  CreateVeiculoRequest,
  ListVeiculosRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
} from "../repositories/contracts/veiculo.contract.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";

export class VeiculoService {
  constructor(private veiculoRepository: IVeiculoRepository) {}

  list = async (data: ListVeiculosRequest) => {
    switch (data.cargo) {
      case "ADMIN":
        return data.filters
          ? await this.veiculoRepository.search(data.filters)
          : await this.veiculoRepository.findAll();

      case "LOCADOR":
        return data.filters
          ? await this.veiculoRepository.search({
              ...data.filters,
              idLocador: data.id, // garante que só vê os próprios
            })
          : await this.veiculoRepository.findByLocadorId(data.id);

      case "LOCATARIO":
        return await this.veiculoRepository.search(data.filters ?? {});

      default:
        throw new HttpError(403, "Acesso negado");
    }
  };

  findByLocadorId = async (idLocador: string) => {
    const veiculos = await this.veiculoRepository.findByLocadorId(idLocador);
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

  search = async (filters: VeiculoFilters) => {
    const veiculos = await this.veiculoRepository.search(filters);
    if (!veiculos || veiculos.length === 0) {
      throw new HttpError(
        404,
        "Nenhum veículo encontrado com os filtros fornecidos",
      );
    }
    return veiculos;
  };

  create = async (data: CreateVeiculoRequest) => {
    const existing = await this.veiculoRepository.findByPlaca(data.placa);
    if (existing) {
      throw new HttpError(409, "Veículo com esta placa já existe");
    }
    return this.veiculoRepository.create({
      ...data,
      status: data.status ?? StatusVeiculo.DISPONIVEL,
    });
  };

  createLote = async (data: CreateVeiculoLoteRequest) => {
    if (!data.placas || data.placas.length === 0) {
      throw new HttpError(400, "Informe ao menos uma placa");
    }

    // Verifica duplicatas dentro da própria lista enviada
    const placasUnicas = new Set(data.placas);
    if (placasUnicas.size !== data.placas.length) {
      throw new HttpError(400, "A lista contém placas duplicadas");
    }

    // Verifica quais placas já existem no banco
    const duplicadas = (
      await Promise.all(
        data.placas.map((placa) => this.veiculoRepository.findByPlaca(placa)),
      )
    )
      .filter(Boolean)
      .map((v) => v!.placa);

    if (duplicadas.length > 0) {
      throw new HttpError(
        409,
        `As seguintes placas já estão cadastradas: ${duplicadas.join(", ")}`,
      );
    }

    return this.veiculoRepository.createLote(data);
  };

  update = async (id: string, data: UpdateVeiculoRequest) => {
    const veiculo = await this.veiculoRepository.findById(id);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    return this.veiculoRepository.update(id, data);
  };

  delete = async (id: string) => {
    const veiculo = await this.veiculoRepository.findById(id);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    return this.veiculoRepository.delete(id);
  };
}
