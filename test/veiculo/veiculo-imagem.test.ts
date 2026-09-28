import { describe, expect, it } from "vitest";
import request from "supertest";
import { Cargo } from "@prisma/client";

import { validateImageBuffer } from "../../src/infra/media/image-validation";
import { VeiculoImagemService } from "../../src/services/veiculo-imagem";
import type { StorageProvider } from "../../src/infra/media/storage-provider";
import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import { createLocador, createVeiculo } from "../helpers";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const WEBP_VP8X_WITH_EXIF = (() => {
  const buffer = Buffer.alloc(42);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(34, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUInt8(0, 24);
  buffer.writeUInt8(0, 25);
  buffer.writeUInt8(0, 26);
  buffer.writeUInt8(0, 27);
  buffer.writeUInt8(0, 28);
  buffer.writeUInt8(0, 29);
  buffer.writeUInt8(0, 30);
  buffer.write("EXIF", 30, "ascii");
  buffer.writeUInt32LE(4, 34);
  buffer.write("gps!", 38, "ascii");
  return buffer;
})();

describe("validação de imagem de veículo", () => {
  it("lê MIME, bytes e dimensões de PNG real", () => {
    expect(validateImageBuffer(PNG_1X1, "image/png", { maxBytes: 1024, maxWidth: 10, maxHeight: 10 })).toMatchObject({
      mimeType: "image/png",
      width: 1,
      height: 1,
    });
  });

  it("rejeita MIME declarado diferente da assinatura", () => {
    expect(() => validateImageBuffer(PNG_1X1, "image/jpeg", { maxBytes: 1024, maxWidth: 10, maxHeight: 10 })).toThrow(/MIME|assinatura/i);
  });

  it("rejeita SVG e arquivo acima do limite", () => {
    expect(() => validateImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml", { maxBytes: 1024, maxWidth: 10, maxHeight: 10 })).toThrow(/formato|SVG|suportado/i);
    expect(() => validateImageBuffer(PNG_1X1, "image/png", { maxBytes: 4, maxWidth: 10, maxHeight: 10 })).toThrow(/tamanho/i);
  });

  it("rejeita EXIF em qualquer chunk WebP, inclusive após VP8X", () => {
    expect(() => validateImageBuffer(WEBP_VP8X_WITH_EXIF, "image/webp", {
      maxBytes: 1024,
      maxWidth: 10,
      maxHeight: 10,
    })).toThrow(/EXIF/i);
  });

  it("persiste metadados, publica somente após storage e respeita ownership", async () => {
    const locador = await createLocador();
    const outro = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const objects = new Map<string, Buffer>();
    const storage: StorageProvider = {
      async putObject({ key, body }) { objects.set(`private/${key}`, body); },
      async copyObject({ sourceKey, destinationKey }) { objects.set(`public/${destinationKey}`, objects.get(`private/${sourceKey}`)!); },
      async deleteObject({ bucket, key }) { objects.delete(`${bucket.includes("private") ? "private" : "public"}/${key}`); },
      async listObjects() { return []; },
    };
    const service = new VeiculoImagemService(storage);
    const requester = { id: locador.locadorId, cargo: Cargo.LOCADOR };

    const imagem = await service.criar(veiculo.id, PNG_1X1, "image/png", "Frente do veículo", requester);
    expect(imagem).toMatchObject({ status: "READY", ordem: 0, largura: 1, altura: 1, url: expect.stringContaining("vehicles/") });
    expect(imagem).not.toHaveProperty("objectKey");
    expect(objects.size).toBe(2);

    await expect(service.listar(veiculo.id, { id: outro.locadorId, cargo: Cargo.LOCADOR })).rejects.toMatchObject({ status: 403 });
    const publico = await request(app).get(`/api/veiculo/${veiculo.id}/imagens`);
    expect(publico.status).toBe(200);
    expect(publico.body.result).toHaveLength(1);

    const reordenadas = await service.reordenar(veiculo.id, { imagemIds: [imagem.id] }, requester);
    expect(reordenadas[0].ordem).toBe(0);
    await service.excluir(veiculo.id, imagem.id, requester);
    expect(await service.listar(veiculo.id, requester)).toEqual([]);
    expect(objects.size).toBe(0);
  });

  it("mantém imagem de veículo indisponível somente no bucket privado", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId, { status: "MANUTENCAO" });
    const objects = new Map<string, Buffer>();
    let copies = 0;
    const storage: StorageProvider = {
      async putObject({ key, body }) { objects.set(`private/${key}`, body); },
      async copyObject() { copies += 1; },
      async deleteObject({ bucket, key }) { objects.delete(`${bucket.includes("private") ? "private" : "public"}/${key}`); },
      async listObjects() { return []; },
    };

    const imagem = await new VeiculoImagemService(storage).criar(
      veiculo.id,
      PNG_1X1,
      "image/png",
      "Rascunho",
      { id: locador.locadorId, cargo: Cargo.LOCADOR },
    );

    expect(copies).toBe(0);
    expect(imagem.status).toBe("READY");
    expect(imagem.url).toBeNull();
    expect([...objects.keys()]).toHaveLength(1);
    expect((await request(app).get(`/api/veiculo/${veiculo.id}/imagens`)).status).toBe(404);
  });

  it("remove a cópia pública quando o veículo deixa de ser elegível", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const privateObjects = new Map<string, Buffer>();
    const publicObjects = new Map<string, Buffer>();
    const storage: StorageProvider = {
      async putObject({ key, body }) { privateObjects.set(key, body); },
      async copyObject({ sourceKey, destinationKey }) { publicObjects.set(destinationKey, privateObjects.get(sourceKey)!); },
      async deleteObject({ bucket, key }) { (bucket.includes("private") ? privateObjects : publicObjects).delete(key); },
      async listObjects() { return []; },
    };
    const service = new VeiculoImagemService(storage);
    await service.criar(veiculo.id, PNG_1X1, "image/png", undefined, { id: locador.locadorId, cargo: Cargo.LOCADOR });
    expect(publicObjects.size).toBe(1);

    await prisma.veiculo.update({ where: { id: veiculo.id }, data: { status: "MANUTENCAO" } });
    await service.sincronizarVisibilidadeVeiculo(veiculo.id);

    expect(publicObjects.size).toBe(0);
    expect(privateObjects.size).toBe(1);
  });

  it("revalida a visibilidade quando o veículo fica privado durante o upload", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const objects = new Map<string, Buffer>();
    const storage: StorageProvider = {
      async putObject({ bucket, key, body }) {
        objects.set(`${bucket}/${key}`, body);
        await prisma.veiculo.update({ where: { id: veiculo.id }, data: { status: "MANUTENCAO" } });
      },
      async copyObject({ sourceBucket, sourceKey, destinationBucket, destinationKey }) {
        objects.set(`${destinationBucket}/${destinationKey}`, objects.get(`${sourceBucket}/${sourceKey}`)!);
      },
      async deleteObject({ bucket, key }) { objects.delete(`${bucket}/${key}`); },
      async listObjects() { return []; },
    };

    const imagem = await new VeiculoImagemService(storage).criar(
      veiculo.id,
      PNG_1X1,
      "image/png",
      "Corrida de visibilidade",
      { id: locador.locadorId, cargo: Cargo.LOCADOR },
    );

    expect(imagem.url).toBeNull();
    expect([...objects.keys()].some((key) => key.startsWith("mova-media-public/"))).toBe(false);
  });

  it("compensa cópia pública criada pela sincronização quando a promoção falha", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const objects = new Map<string, Buffer>();
    const storage: StorageProvider = {
      async putObject({ bucket, key, body }) { objects.set(`${bucket}/${key}`, body); },
      async copyObject({ sourceBucket, sourceKey, destinationBucket, destinationKey }) {
        objects.set(`${destinationBucket}/${destinationKey}`, objects.get(`${sourceBucket}/${sourceKey}`)!);
        throw new Error("falha depois de publicar");
      },
      async deleteObject({ bucket, key }) { objects.delete(`${bucket}/${key}`); },
      async listObjects() { return []; },
    };

    await expect(new VeiculoImagemService(storage).criar(
      veiculo.id,
      PNG_1X1,
      "image/png",
      "Compensação de promoção",
      { id: locador.locadorId, cargo: Cargo.LOCADOR },
    )).rejects.toMatchObject({ status: 502 });

    expect(objects).toEqual(new Map());
    expect(await prisma.veiculoImagem.count({ where: { idVeiculo: veiculo.id } })).toBe(0);
  });

  it("recusa upload com bytes inválidos antes de tocar o storage", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    let puts = 0;
    const storage: StorageProvider = {
      async putObject() { puts += 1; },
      async copyObject() {},
      async deleteObject() {},
      async listObjects() { return []; },
    };
    await expect(new VeiculoImagemService(storage).criar(
      veiculo.id,
      Buffer.from("not an image"),
      "image/png",
      undefined,
      { id: locador.locadorId, cargo: Cargo.LOCADOR },
    )).rejects.toMatchObject({ status: 400 });
    expect(puts).toBe(0);
  });

  it("compensa registro PENDING quando o upload é interrompido", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const storage: StorageProvider = {
      async putObject() { throw new Error("storage indisponível"); },
      async copyObject() {},
      async deleteObject() {},
      async listObjects() { return []; },
    };

    await expect(new VeiculoImagemService(storage).criar(
      veiculo.id,
      PNG_1X1,
      "image/png",
      undefined,
      { id: locador.locadorId, cargo: Cargo.LOCADOR },
    )).rejects.toMatchObject({ status: 502 });
    expect(await prisma.veiculoImagem.count({ where: { idVeiculo: veiculo.id } })).toBe(0);
  });

  it("preserva DELETING quando a remoção do storage falha", async () => {
    const locador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);
    const storage: StorageProvider = {
      async putObject() {},
      async copyObject() {},
      async deleteObject() { throw new Error("storage indisponível"); },
      async listObjects() { return []; },
    };
    const service = new VeiculoImagemService(storage);
    const requester = { id: locador.locadorId, cargo: Cargo.LOCADOR };
    const imagem = await service.criar(veiculo.id, PNG_1X1, "image/png", undefined, requester);

    await expect(service.excluir(veiculo.id, imagem.id, requester)).rejects.toMatchObject({ status: 503 });
    await expect(prisma.veiculoImagem.findUnique({ where: { id: imagem.id } })).resolves.toMatchObject({ status: "DELETING" });
  });
});
