import { prisma } from "../../database/prisma.js";
import { IVeiculoRepository } from "../veiculo.repository.js";
import { HttpError } from "../../errors/HttpError.js";
import {
  CreateVeiculoLoteRequest,
  CreateVeiculoRequest,
  ModeloVeiculoData,
  ModeloVeiculoResponse,
  UpdateModeloVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
  VeiculoResponse,
} from "../contracts/veiculo.contract.js";
import { VeiculoMapper } from "../mappers/veiculo.mapper.js";

const withModelo = { modeloVeiculo: true } as const;

export class PrismaVeiculoRepository implements IVeiculoRepository {
  // ── Upsert interno do modelo ──────────────────────────────────────────────
  // Busca o modelo pelo unique [idLocador, marca, modelo, ano].
  // Se não existir, cria. Se existir, retorna o existente sem alterar.
  private async upsertModelo(data: ModeloVeiculoData) {
    return prisma.modeloVeiculo.upsert({
      where: {
        idLocador_marca_modelo_ano: {
          idLocador: data.idLocador,
          marca: data.marca,
          modelo: data.modelo,
          ano: data.ano,
        },
      },
      update: {},
      create: {
        idLocador: data.idLocador,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano,
        cambio: data.cambio,
        capacidade: data.capacidade,
        eletrico: data.eletrico,
        adaptado: data.adaptado,
      },
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  async findAll(): Promise<VeiculoResponse[]> {
    const data = await prisma.veiculo.findMany({
      include: withModelo,
    });
    return VeiculoMapper.toManyResponse(data);
  }

  async findByLocadorId(idLocador: string): Promise<VeiculoResponse[]> {
    const data = await prisma.veiculo.findMany({
      where: { idLocador },
      include: withModelo,
    });
    return VeiculoMapper.toManyResponse(data);
  }

  async findById(id: string): Promise<VeiculoResponse | null> {
    const data = await prisma.veiculo.findUnique({
      where: { id },
      include: withModelo,
    });
    return data ? VeiculoMapper.toResponse(data) : null;
  }

  async findByPlaca(placa: string): Promise<VeiculoResponse | null> {
    const data = await prisma.veiculo.findUnique({
      where: { placa },
      include: withModelo,
    });
    return data ? VeiculoMapper.toResponse(data) : null;
  }

  async search(filters: VeiculoFilters): Promise<VeiculoResponse[]> {
    const data = await prisma.veiculo.findMany({
      where: {
        idLocador: filters.idLocador,
        garagemId: filters.garagemId,
        status: "DISPONIVEL",
        modeloVeiculo: {
          marca: filters.marca,
          modelo: filters.modelo,
          ano: filters.ano,
          cambio: filters.cambio,
          capacidade: filters.capacidade,
          eletrico: filters.eletrico,
          adaptado: filters.adaptado,
        },
      },
      include: withModelo,
    });
    return VeiculoMapper.toManyResponse(data);
  }

  async create(data: CreateVeiculoRequest): Promise<VeiculoResponse> {
    const modelo = await this.upsertModelo(data);

    const veiculo = await prisma.veiculo.create({
      data: {
        idLocador: data.idLocador,
        idModeloVeiculo: modelo.id,
        placa: data.placa,
        garagemId: data.garagemId,
      },
      include: withModelo,
    });

    return VeiculoMapper.toResponse(veiculo);
  }

  async createLote(data: CreateVeiculoLoteRequest): Promise<VeiculoResponse[]> {
    const modelo = await this.upsertModelo(data);

    await prisma.veiculo.createMany({
      data: data.placas.map((placa) => ({
        idLocador: data.idLocador,
        idModeloVeiculo: modelo.id,
        placa,
        garagemId: data.garagemId ?? null,
      })),
      skipDuplicates: true, // placas repetidas na lista são ignoradas silenciosamente
    });

    const veiculos = await prisma.veiculo.findMany({
      where: {
        placa: { in: data.placas },
        idLocador: data.idLocador,
      },
      include: withModelo,
    });

    return VeiculoMapper.toManyResponse(veiculos);
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
          status: data.status ?? undefined,
          // null desvincula da garagem, undefined ignora o campo
          garagemId: data.garagemId !== undefined ? data.garagemId : undefined,
        },
        include: withModelo,
      });
      return VeiculoMapper.toResponse(veiculo);
    } catch {
      throw new HttpError(404, "Veículo não encontrado.");
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.veiculo.delete({ where: { id } });
  }

  async updateModelo(
    idModelo: string,
    data: UpdateModeloVeiculoRequest,
  ): Promise<ModeloVeiculoResponse> {
    try {
      return await prisma.modeloVeiculo.update({
        where: { id: idModelo },
        data: {
          cambio: data.cambio ?? undefined,
          capacidade: data.capacidade ?? undefined,
          eletrico: data.eletrico ?? undefined,
          adaptado: data.adaptado ?? undefined,
          // marca, modelo, ano intencionalmente fora — mudar isso
          // quebraria o @@unique e a identidade do modelo
        },
      });
    } catch {
      throw new HttpError(404, "Modelo de veículo não encontrado.");
    }
  }

  async updateModeloDoVeiculo(
    idVeiculo: string,
    data: ModeloVeiculoData,
  ): Promise<VeiculoResponse> {
    const modelo = await this.upsertModelo(data);

    try {
      const veiculo = await prisma.veiculo.update({
        where: { id: idVeiculo },
        data: { idModeloVeiculo: modelo.id },
        include: withModelo,
      });
      return VeiculoMapper.toResponse(veiculo);
    } catch {
      throw new HttpError(404, "Veículo não encontrado.");
    }
  }
}
