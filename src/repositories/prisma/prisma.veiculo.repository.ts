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
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";
import { Prisma, PrismaClient, StatusGaragem, StatusVeiculo } from "@prisma/client";
import {
  moveVehicleInTransaction,
  reserveGarageCapacityForNewVehicles,
} from "./vehicle-garage-allocation.js";

// A listagem do catálogo precisa identificar a garagem efetiva do veículo.
// Selecionar esses campos na mesma query evita GET /garagem/:id por card.
const withModelo = {
  modeloVeiculo: true,
  garagem: { select: { id: true, nome: true, status: true } },
} as const;

export class PrismaVeiculoRepository implements IVeiculoRepository {
  // ── Upsert interno do modelo ──────────────────────────────────────────────
  // Busca o modelo pelo unique [idLocador, marca, modelo, ano].
  // Se não existir, cria. Se existir, retorna o existente sem alterar.
  private async upsertModelo(
    db: PrismaClient | Prisma.TransactionClient,
    data: ModeloVeiculoData,
  ) {
    return db.modeloVeiculo.upsert({
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
        valorDiaria: data.valorDiaria,
        categoria: data.categoria ?? undefined,
      },
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  async findAll(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.veiculo.findMany({
        skip,
        take,
        include: withModelo,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.veiculo.count(),
    ]);
    return buildPaginatedResult(
      VeiculoMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findByLocadorId(
    idLocador: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idLocador };
    const [data, total] = await prisma.$transaction([
      prisma.veiculo.findMany({
        where,
        skip,
        take,
        include: withModelo,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.veiculo.count({ where }),
    ]);
    return buildPaginatedResult(
      VeiculoMapper.toManyResponse(data),
      total,
      pagination,
    );
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

  async findModeloById(id: string): Promise<ModeloVeiculoResponse | null> {
    const modelo = await prisma.modeloVeiculo.findUnique({ where: { id } });
    if (!modelo) return null;
    return {
      id: modelo.id,
      idLocador: modelo.idLocador,
      marca: modelo.marca,
      modelo: modelo.modelo,
      ano: modelo.ano,
      valorDiaria: Number(modelo.valorDiaria),
      cambio: modelo.cambio,
      capacidade: modelo.capacidade,
      eletrico: modelo.eletrico,
      adaptado: modelo.adaptado,
      categoria: modelo.categoria,
      criadoEm: modelo.criadoEm,
    };
  }

  async search(
    filters: VeiculoFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where: Prisma.VeiculoWhereInput = {
      idLocador: filters.idLocador,
      garagemId: filters.garagemId,
      status: "DISPONIVEL",
      // Catálogo reservável: só há oferta quando existe um ponto operacional
      // real e a garagem está ATIVA. Veículo em preparação sem garagem fica
      // visível apenas na frota privada do locador.
      garagem: { status: StatusGaragem.ATIVA },
      modeloVeiculo: {
        marca: filters.marca,
        modelo: filters.modelo,
        ano: filters.ano,
        cambio: filters.cambio,
        capacidade: filters.capacidade,
        eletrico: filters.eletrico,
        adaptado: filters.adaptado,
        categoria: filters.categoria,
      },
    };
    const [data, total] = await prisma.$transaction([
      prisma.veiculo.findMany({
        where,
        skip,
        take,
        include: withModelo,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.veiculo.count({ where }),
    ]);
    return buildPaginatedResult(
      VeiculoMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findForInteresse(
    pagination: PaginationParams,
  ): Promise<PaginatedResult<VeiculoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where: Prisma.VeiculoWhereInput = {
      // RESERVADO e MANUTENCAO são indisponíveis agora, mas podem voltar a
      // DISPONIVEL. INATIVO é desativação administrativa e não entra aqui.
      status: { in: [StatusVeiculo.RESERVADO, StatusVeiculo.MANUTENCAO] },
    };
    const [data, total] = await prisma.$transaction([
      prisma.veiculo.findMany({
        where,
        skip,
        take,
        include: withModelo,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.veiculo.count({ where }),
    ]);
    return buildPaginatedResult(
      VeiculoMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async create(data: CreateVeiculoRequest): Promise<VeiculoResponse> {
    const veiculo = await prisma.$transaction(async (tx) => {
      const modelo = await this.upsertModelo(tx, data);

      if (data.garagemId) {
        await reserveGarageCapacityForNewVehicles(
          tx,
          data.garagemId,
          data.idLocador,
        );
      }

      return tx.veiculo.create({
        data: {
          idLocador: data.idLocador,
          idModeloVeiculo: modelo.id,
          placa: data.placa,
          garagemId: data.garagemId ?? null,
          // undefined cai no @default(DISPONIVEL) do schema
          status: data.status ?? undefined,
        },
        include: withModelo,
      });
    });

    return VeiculoMapper.toResponse(veiculo);
  }

  async createLote(data: CreateVeiculoLoteRequest): Promise<VeiculoResponse[]> {
    const veiculos = await prisma.$transaction(async (tx) => {
      const modelo = await this.upsertModelo(tx, data);
      const existentes = await tx.veiculo.findMany({
        where: { placa: { in: data.placas } },
        select: { placa: true },
      });
      const placasExistentes = new Set(existentes.map((veiculo) => veiculo.placa));
      const placasNovas = data.placas.filter((placa) => !placasExistentes.has(placa));

      if (data.garagemId && placasNovas.length > 0) {
        await reserveGarageCapacityForNewVehicles(
          tx,
          data.garagemId,
          data.idLocador,
          placasNovas.length,
        );
      }

      await tx.veiculo.createMany({
        data: placasNovas.map((placa) => ({
          idLocador: data.idLocador,
          idModeloVeiculo: modelo.id,
          placa,
          garagemId: data.garagemId ?? null,
        })),
      });

      return tx.veiculo.findMany({
        where: {
          placa: { in: data.placas },
          idLocador: data.idLocador,
        },
        include: withModelo,
      });
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
      const veiculo = await prisma.$transaction(async (tx) => {
        const atual = await tx.veiculo.findUnique({
          where: { id },
          include: { modeloVeiculo: true },
        });
        if (!atual) return null;

        let idModeloVeiculo = atual.idModeloVeiculo;
        if (data.modelo) {
          const modeloAtual = atual.modeloVeiculo;
          const modelo = {
            marca: data.modelo.marca ?? modeloAtual.marca,
            modelo: data.modelo.modelo ?? modeloAtual.modelo,
            ano: data.modelo.ano ?? modeloAtual.ano,
            cambio: data.modelo.cambio ?? modeloAtual.cambio,
            capacidade: data.modelo.capacidade ?? modeloAtual.capacidade,
            eletrico: data.modelo.eletrico ?? modeloAtual.eletrico,
            adaptado: data.modelo.adaptado ?? modeloAtual.adaptado,
            categoria:
              data.modelo.categoria !== undefined
                ? data.modelo.categoria
                : modeloAtual.categoria,
            valorDiaria:
              data.modelo.valorDiaria ?? Number(modeloAtual.valorDiaria),
          };

          // A identidade do catálogo é única por locador. Se ela mudou,
          // associa o veículo ao modelo correspondente; se não mudou, o
          // update explícito mantém a semântica de modelo compartilhado.
          const atualizado = await tx.modeloVeiculo.upsert({
            where: {
              idLocador_marca_modelo_ano: {
                idLocador: atual.idLocador,
                marca: modelo.marca,
                modelo: modelo.modelo,
                ano: modelo.ano,
              },
            },
            update: {
              cambio: modelo.cambio,
              capacidade: modelo.capacidade,
              eletrico: modelo.eletrico,
              adaptado: modelo.adaptado,
              categoria: modelo.categoria,
              valorDiaria: modelo.valorDiaria,
            },
            create: {
              idLocador: atual.idLocador,
              marca: modelo.marca,
              modelo: modelo.modelo,
              ano: modelo.ano,
              cambio: modelo.cambio,
              capacidade: modelo.capacidade,
              eletrico: modelo.eletrico,
              adaptado: modelo.adaptado,
              categoria: modelo.categoria ?? undefined,
              valorDiaria: modelo.valorDiaria,
            },
          });
          idModeloVeiculo = atualizado.id;
        }

        if (data.garagemId !== undefined) {
          await moveVehicleInTransaction(tx, id, data.garagemId);
        }

        return tx.veiculo.update({
          where: { id },
          data: {
            placa: data.placa ?? undefined,
            status: data.status ?? undefined,
            ...(idModeloVeiculo !== atual.idModeloVeiculo
              ? { idModeloVeiculo }
              : {}),
          },
          include: withModelo,
        });
      });

      if (!veiculo) throw new HttpError(404, "Veículo não encontrado.");
      return VeiculoMapper.toResponse(veiculo);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new HttpError(409, "Veículo ou modelo já existe.");
        }
        if (error.code === "P2025") {
          throw new HttpError(404, "Veículo não encontrado.");
        }
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    // RN08: soft delete — marca INATIVO (espelha garagem). Preserva histórico
    // (evita cascade destrutivo) e tira o veículo de buscas (filtro DISPONIVEL)
    // e de novas reservas (create rejeita status != DISPONIVEL).
    try {
      await prisma.veiculo.update({
        where: { id },
        data: { status: StatusVeiculo.INATIVO },
      });
    } catch {
      throw new HttpError(404, "Veículo não encontrado.");
    }
  }

  async updateModelo(
    idModelo: string,
    data: UpdateModeloVeiculoRequest,
  ): Promise<ModeloVeiculoResponse> {
    try {
      const atualizado = await prisma.modeloVeiculo.update({
        where: { id: idModelo },
        data: {
          cambio: data.cambio ?? undefined,
          capacidade: data.capacidade ?? undefined,
          eletrico: data.eletrico ?? undefined,
          adaptado: data.adaptado ?? undefined,
          valorDiaria: data.valorDiaria ?? undefined,
          categoria: data.categoria !== undefined ? data.categoria : undefined,
          // marca, modelo, ano intencionalmente fora — mudar isso
          // quebraria o @@unique e a identidade do modelo
        },
      });
      return VeiculoMapper.toModeloResponse(atualizado);
    } catch {
      throw new HttpError(404, "Modelo de veículo não encontrado.");
    }
  }

  async updateModeloDoVeiculo(
    idVeiculo: string,
    data: ModeloVeiculoData,
  ): Promise<VeiculoResponse> {
    const modelo = await this.upsertModelo(prisma, data);

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
