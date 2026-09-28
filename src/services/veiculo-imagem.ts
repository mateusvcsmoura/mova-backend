import { randomUUID } from "node:crypto";
import { Cargo, StatusGaragem, StatusVeiculo, StatusVeiculoImagem } from "@prisma/client";

import { env } from "../config/env.js";
import { HttpError } from "../errors/HttpError.js";
import { prisma } from "../database/prisma.js";
import { validateImageBuffer } from "../infra/media/image-validation.js";
import { publicMediaUrl, S3StorageProvider, StorageProvider } from "../infra/media/storage-provider.js";
import {
  ReordenarImagensRequest,
  VeiculoImagemResponse,
} from "../repositories/contracts/veiculo-imagem.contract.js";

export interface VeiculoImagemRequester {
  id: string;
  cargo: Cargo;
}

const extensionFor = (mimeType: string): string =>
  mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

export class VeiculoImagemService {
  constructor(private readonly storage: StorageProvider = new S3StorageProvider()) {}

  private isPubliclyEligible(veiculo: {
    status: StatusVeiculo;
    garagem?: { status: StatusGaragem } | null;
  }): boolean {
    return veiculo.status === StatusVeiculo.DISPONIVEL && veiculo.garagem?.status === StatusGaragem.ATIVA;
  }

  private async vehicle(idVeiculo: string) {
    const veiculo = await prisma.veiculo.findUnique({
      where: { id: idVeiculo },
      select: { id: true, idLocador: true, status: true, garagem: { select: { status: true } } },
    });
    if (!veiculo) throw new HttpError(404, "Veículo não encontrado");
    return veiculo;
  }

  private assertOwner(veiculo: { idLocador: string }, requester: VeiculoImagemRequester): void {
    if (requester.cargo !== Cargo.ADMIN && (requester.cargo !== Cargo.LOCADOR || requester.id !== veiculo.idLocador)) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  private map(imagem: {
    id: string;
    idVeiculo: string;
    objectKey: string;
    ordem: number;
    altText: string | null;
    mimeType: string;
    tamanho: number;
    largura: number;
    altura: number;
    status: StatusVeiculoImagem;
    criadaEm: Date;
    atualizadoEm: Date;
  }, publicavel: boolean): VeiculoImagemResponse {
    return {
      id: imagem.id,
      idVeiculo: imagem.idVeiculo,
      ordem: imagem.ordem,
      altText: imagem.altText,
      mimeType: imagem.mimeType,
      tamanho: imagem.tamanho,
      largura: imagem.largura,
      altura: imagem.altura,
      status: imagem.status,
      url: imagem.status === StatusVeiculoImagem.READY && publicavel ? publicMediaUrl(imagem.objectKey) : null,
      criadaEm: imagem.criadaEm,
      atualizadoEm: imagem.atualizadoEm,
    };
  }

  async listar(idVeiculo: string, requester?: VeiculoImagemRequester): Promise<VeiculoImagemResponse[]> {
    const veiculo = await this.vehicle(idVeiculo);
    const privado = requester?.cargo === Cargo.LOCADOR || requester?.cargo === Cargo.ADMIN;
    const publicavel = this.isPubliclyEligible(veiculo);
    if (privado) {
      this.assertOwner(veiculo, requester!);
    } else if (!publicavel) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    const imagens = await prisma.veiculoImagem.findMany({
      where: { idVeiculo, ...(privado ? {} : { status: StatusVeiculoImagem.READY }) },
      orderBy: { ordem: "asc" },
    });
    return imagens.map((imagem) => this.map(imagem, publicavel));
  }

  async criar(
    idVeiculo: string,
    body: Buffer,
    declaredMime: string,
    altText: string | undefined,
    requester: VeiculoImagemRequester,
  ): Promise<VeiculoImagemResponse> {
    const veiculo = await this.vehicle(idVeiculo);
    this.assertOwner(veiculo, requester);
    if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, "Envie o arquivo da imagem");

    let validado;
    try {
      validado = validateImageBuffer(body, declaredMime, {
        maxBytes: env.MEDIA_MAX_BYTES,
        maxWidth: env.MEDIA_MAX_WIDTH,
        maxHeight: env.MEDIA_MAX_HEIGHT,
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Imagem inválida");
    }
    const normalizedAlt = altText?.trim() || null;
    if (normalizedAlt && normalizedAlt.length > 160) throw new HttpError(400, "Texto alternativo muito longo");

    const objectKey = `vehicles/${idVeiculo}/${randomUUID()}.${extensionFor(validado.mimeType)}`;
    const imagem = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idVeiculo}, 0))`;
      const quantidade = await tx.veiculoImagem.count({
        where: { idVeiculo, status: { not: StatusVeiculoImagem.DELETING } },
      });
      if (quantidade >= env.MEDIA_MAX_IMAGES_PER_VEHICLE) {
        throw new HttpError(409, "Limite de imagens do veículo atingido");
      }
      const ultima = await tx.veiculoImagem.aggregate({
        where: { idVeiculo },
        _max: { ordem: true },
      });
      return tx.veiculoImagem.create({
        data: {
          idVeiculo,
          objectKey,
          ordem: (ultima._max.ordem ?? -1) + 1,
          altText: normalizedAlt,
          mimeType: validado.mimeType,
          tamanho: body.length,
          largura: validado.width,
          altura: validado.height,
          status: StatusVeiculoImagem.PENDING,
        },
      });
    });

    try {
      await this.storage.putObject({
        bucket: env.MEDIA_PRIVATE_BUCKET,
        key: objectKey,
        body,
        contentType: validado.mimeType,
      });
      const ready = await prisma.veiculoImagem.update({
        where: { id: imagem.id },
        data: { status: StatusVeiculoImagem.READY },
      });
      // A promoção/revogação ocorre somente depois de READY e sob a mesma
      // reconciliação protegida usada nas mudanças de visibilidade.
      await this.sincronizarVisibilidadeVeiculo(idVeiculo);
      const estadoAtual = await this.vehicle(idVeiculo);
      return this.map(ready, this.isPubliclyEligible(estadoAtual));
    } catch {
      await Promise.allSettled([
        this.storage.deleteObject({ bucket: env.MEDIA_PRIVATE_BUCKET, key: objectKey }),
        // A promoção é feita pela sincronização final e pode ter criado o
        // objeto antes de falhar. A chave é nova e opaca, portanto remover os
        // dois lados é uma compensação segura e independente de onde falhou.
        this.storage.deleteObject({ bucket: env.MEDIA_PUBLIC_BUCKET, key: objectKey }),
        prisma.veiculoImagem.delete({ where: { id: imagem.id } }),
      ]);
      throw new HttpError(502, "Não foi possível persistir a imagem");
    }
  }

  async sincronizarVisibilidadeVeiculo(idVeiculo: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // O cleanup usa a mesma chave. A operação de storage é curta e fica
      // protegida pelo lock apenas no comando de reconciliação local; assim a
      // troca de status e a republicação não se atropelam.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idVeiculo}, 0))`;
      const veiculo = await tx.veiculo.findUnique({
        where: { id: idVeiculo },
        select: { status: true, garagem: { select: { status: true } } },
      });
      if (!veiculo) throw new HttpError(404, "Veículo não encontrado");
      const imagens = await tx.veiculoImagem.findMany({
        where: { idVeiculo, status: StatusVeiculoImagem.READY },
        select: { objectKey: true, mimeType: true },
      });
      const publicavel = this.isPubliclyEligible(veiculo);

      const operacoes = await Promise.allSettled(imagens.map((imagem) => publicavel
        ? this.storage.copyObject({
            sourceBucket: env.MEDIA_PRIVATE_BUCKET,
            sourceKey: imagem.objectKey,
            destinationBucket: env.MEDIA_PUBLIC_BUCKET,
            destinationKey: imagem.objectKey,
            contentType: imagem.mimeType,
          })
        : this.storage.deleteObject({ bucket: env.MEDIA_PUBLIC_BUCKET, key: imagem.objectKey })));
      const falha = operacoes.find((resultado): resultado is PromiseRejectedResult => resultado.status === "rejected");
      if (falha) throw falha.reason;
    });
  }

  async sincronizarVisibilidadeGaragem(idGaragem: string): Promise<void> {
    const veiculos = await prisma.veiculo.findMany({
      where: { garagemId: idGaragem },
      select: { id: true },
    });
    await Promise.all(veiculos.map((veiculo) => this.sincronizarVisibilidadeVeiculo(veiculo.id)));
  }

  async reordenar(idVeiculo: string, data: ReordenarImagensRequest, requester: VeiculoImagemRequester): Promise<VeiculoImagemResponse[]> {
    const veiculo = await this.vehicle(idVeiculo);
    this.assertOwner(veiculo, requester);
    if (new Set(data.imagemIds).size !== data.imagemIds.length) throw new HttpError(400, "Imagens duplicadas");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idVeiculo}, 0))`;
      const imagens = await tx.veiculoImagem.findMany({
        where: { idVeiculo, status: StatusVeiculoImagem.READY },
        select: { id: true },
      });
      const idsAtuais = new Set(imagens.map((imagem) => imagem.id));
      if (idsAtuais.size !== data.imagemIds.length || data.imagemIds.some((id) => !idsAtuais.has(id))) {
        throw new HttpError(400, "A ordem deve conter exatamente as imagens prontas do veículo");
      }
      if (data.imagemIds.length > 0) {
        await tx.veiculoImagem.updateMany({ where: { idVeiculo, status: StatusVeiculoImagem.READY }, data: { ordem: { increment: 10000 } } });
        for (const [ordem, id] of data.imagemIds.entries()) {
          await tx.veiculoImagem.update({ where: { id }, data: { ordem } });
        }
      }
    });
    return this.listar(idVeiculo, requester);
  }

  async definirCapa(idVeiculo: string, idImagem: string, requester: VeiculoImagemRequester): Promise<VeiculoImagemResponse[]> {
    const imagens = await this.listar(idVeiculo, requester);
    const capa = imagens.find((imagem) => imagem.id === idImagem);
    if (!capa || capa.status !== StatusVeiculoImagem.READY) throw new HttpError(404, "Imagem não encontrada");
    return this.reordenar(idVeiculo, { imagemIds: [idImagem, ...imagens.filter((imagem) => imagem.id !== idImagem).map((imagem) => imagem.id)] }, requester);
  }

  async excluir(idVeiculo: string, idImagem: string, requester: VeiculoImagemRequester): Promise<void> {
    const veiculo = await this.vehicle(idVeiculo);
    this.assertOwner(veiculo, requester);
    const imagem = await prisma.veiculoImagem.findFirst({ where: { id: idImagem, idVeiculo } });
    if (!imagem) throw new HttpError(404, "Imagem não encontrada");
    await prisma.veiculoImagem.update({ where: { id: idImagem }, data: { status: StatusVeiculoImagem.DELETING } });
    try {
      await this.storage.deleteObject({ bucket: env.MEDIA_PRIVATE_BUCKET, key: imagem.objectKey });
      await this.storage.deleteObject({ bucket: env.MEDIA_PUBLIC_BUCKET, key: imagem.objectKey });
      await prisma.veiculoImagem.delete({ where: { id: idImagem } });
    } catch {
      throw new HttpError(503, "Imagem marcada para remoção; storage indisponível para concluir");
    }
  }
}
