import { prisma } from "../../database/prisma.js";
import { ILocalizacaoRepository } from "../localizacao.repository.js";
import {
  CreateLocalizacaoRequest,
  LocalizacaoResponse,
} from "../contracts/localizacao.contract.js";
import { LocalizacaoMapper } from "../mappers/localizacao.mapper.js";

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

  async findByVeiculoId(idVeiculo: string): Promise<LocalizacaoResponse[]> {
    const data = await prisma.localizacao.findMany({
      where: { idVeiculo },
      orderBy: { dataHora: "desc" },
    });
    return LocalizacaoMapper.toManyResponse(data);
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
