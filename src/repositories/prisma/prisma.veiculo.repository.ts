import { prisma } from "../../database/prisma.js";
import { IVeiculoRepository } from "../veiculo.repository.js";
import { HttpError } from "../../errors/HttpError.js";
import {
  CreateVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
  VeiculoResponse,
} from "../contracts/veiculo.contract.js";
import { VeiculoMapper } from "../mappers/veiculo.mapper.js";

export class PrismaVeiculoRepository implements IVeiculoRepository {
  async findAll(): Promise<VeiculoResponse[]> {
    const data = await prisma.veiculo.findMany();
    return VeiculoMapper.toManyResponse(data);
  }

  async findByLocadorId(idLocador: string): Promise<VeiculoResponse[]> {
    const data = await prisma.veiculo.findMany({
      where: { idLocador },
    });

    return VeiculoMapper.toManyResponse(data);
  }

  async findById(id: string): Promise<VeiculoResponse | null> {
    const data = await prisma.veiculo.findUnique({
      where: { id },
    });

    return data ? VeiculoMapper.toResponse(data) : null;
  }

  async findByPlaca(placa: string): Promise<VeiculoResponse | null> {
    const data = await prisma.veiculo.findUnique({
      where: { placa },
    });

    return data ? VeiculoMapper.toResponse(data) : null;
  }

  async search(filters: VeiculoFilters): Promise<VeiculoResponse[]> {
    const data = await prisma.veiculo.findMany({
      where: {
        idLocador: filters.idLocador,
        placa: filters.placa,
        marca: filters.marca,
        modelo: filters.modelo,
        ano: filters.ano,
        cambio: filters.cambio,
        capacidade: filters.capacidade,
        status: filters.status,
        eletrico: filters.eletrico,
        adaptado: filters.adaptado,
      },
    });

    return VeiculoMapper.toManyResponse(data);
  }

  async create(data: CreateVeiculoRequest): Promise<VeiculoResponse> {
    const veiculo = await prisma.veiculo.create({
      data: {
        idLocador: data.idLocador,
        placa: data.placa,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cambio: data.cambio,
        capacidade: data.capacidade,
        status: data.status,
        eletrico: data.eletrico,
        adaptado: data.adaptado,
      },
    });

    return VeiculoMapper.toResponse(veiculo);
  }

  async update(
    id: string,
    data: UpdateVeiculoRequest,
  ): Promise<VeiculoResponse> {
    const hasData = Object.values(data).some((v) => v !== undefined);

    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    try {
      const veiculo = await prisma.veiculo.update({
        where: { id },
        data: {
          placa: data.placa ?? undefined,
          marca: data.marca ?? undefined,
          modelo: data.modelo ?? undefined,
          ano: data.ano ?? undefined,
          cambio: data.cambio ?? undefined,
          capacidade: data.capacidade ?? undefined,
          status: data.status ?? undefined,
          eletrico: data.eletrico ?? undefined,
          adaptado: data.adaptado ?? undefined,
        },
      });

      return VeiculoMapper.toResponse(veiculo);
    } catch {
      throw new HttpError(404, "Veículo não encontrado.");
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.veiculo.delete({
      where: { id },
    });
  }
}
