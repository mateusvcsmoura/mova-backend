import { prisma } from "../../database/prisma.js";
import { ILocalizacaoRepository } from "../localizacao.repository.js";
import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
} from "../contracts/localizacao.contract.js";
import { LocalizacaoMapper } from "../mappers/localizacao.mapper.js";
import {
  buildPaginatedResult,
  PaginatedResult,
  PaginationParams,
  toSkipTake,
} from "../../shared/pagination.js";

export class PrismaLocalizacaoRepository implements ILocalizacaoRepository {
  async create(data: CreateLocalizacaoRequest): Promise<LocalizacaoResponse> {
    const localizacao = await prisma.localizacao.create({
      data: {
        idVeiculo: data.idVeiculo,
        latitude: data.latitude,
        longitude: data.longitude,
        // omitido => @default(now()) preserva o instante do evento
        dataHora: data.dataHora ?? undefined,
      },
    });
    return LocalizacaoMapper.toResponse(localizacao);
  }

  async findByVeiculoId(
    idVeiculo: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LocalizacaoResponse>> {
    const { skip, take } = toSkipTake(pagination);
    const where = { idVeiculo };
    const [data, total] = await prisma.$transaction([
      prisma.localizacao.findMany({
        where,
        skip,
        take,
        orderBy: { dataHora: "desc" },
      }),
      prisma.localizacao.count({ where }),
    ]);
    return buildPaginatedResult(
      LocalizacaoMapper.toManyResponse(data),
      total,
      pagination,
    );
  }

  async findLatestByVeiculoId(
    idVeiculo: string,
  ): Promise<LocalizacaoResponse | null> {
    // findFirst + orderBy = LIMIT 1 no banco; não carrega o histórico inteiro.
    const data = await prisma.localizacao.findFirst({
      where: { idVeiculo },
      orderBy: { dataHora: "desc" },
    });
    return data ? LocalizacaoMapper.toResponse(data) : null;
  }
}
