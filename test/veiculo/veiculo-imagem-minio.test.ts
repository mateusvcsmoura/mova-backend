import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { S3StorageProvider } from "../../src/infra/media/storage-provider";
import { createLocador, createVeiculo } from "../helpers";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("galeria de veículo contra MinIO AIStor real", () => {
  it("faz upload, leitura, ownership, capa, ordem e exclusão no storage real", async () => {
    const locador = await createLocador();
    const outroLocador = await createLocador();
    const veiculo = await createVeiculo(locador.token, locador.locadorId);

    const enviar = (altText: string) => request(app)
      .post(`/api/veiculo/${veiculo.id}/imagens`)
      .set("Authorization", `Bearer ${locador.token}`)
      .set("Content-Type", "image/png")
      .set("X-Image-Alt", altText)
      .send(PNG_1X1);

    const primeiraResposta = await enviar("Frente do veículo");
    expect(primeiraResposta.status).toBe(201);
    expect(primeiraResposta.body.result).toMatchObject({ status: "READY", ordem: 0, mimeType: "image/png" });
    const primeira = primeiraResposta.body.result;

    const segundaResposta = await enviar("Lateral do veículo");
    expect(segundaResposta.status).toBe(201);
    expect(segundaResposta.body.result.ordem).toBe(1);
    const segunda = segundaResposta.body.result;

    const leituraPublica = await request(app).get(`/api/veiculo/${veiculo.id}/imagens`);
    expect(leituraPublica.status).toBe(200);
    expect(leituraPublica.body.result.map((imagem: { id: string }) => imagem.id)).toEqual([primeira.id, segunda.id]);

    const leituraBinaria = await fetch(primeira.url);
    expect(leituraBinaria.status).toBe(200);
    expect(leituraBinaria.headers.get("content-type")).toMatch(/image\/png/);
    expect(leituraBinaria.headers.get("cache-control")).toMatch(/immutable/);
    expect(Buffer.from(await leituraBinaria.arrayBuffer())).toEqual(PNG_1X1);

    const acessoOutroLocador = await request(app)
      .get(`/api/veiculo/${veiculo.id}/imagens`)
      .set("Authorization", `Bearer ${outroLocador.token}`);
    expect(acessoOutroLocador.status).toBe(403);

    const reordenada = await request(app)
      .put(`/api/veiculo/${veiculo.id}/imagens/ordem`)
      .set("Authorization", `Bearer ${locador.token}`)
      .send({ imagemIds: [segunda.id, primeira.id] });
    expect(reordenada.status).toBe(200);
    expect(reordenada.body.result.map((imagem: { id: string }) => imagem.id)).toEqual([segunda.id, primeira.id]);

    const capa = await request(app)
      .post(`/api/veiculo/${veiculo.id}/imagens/${primeira.id}/capa`)
      .set("Authorization", `Bearer ${locador.token}`);
    expect(capa.status).toBe(200);
    expect(capa.body.result[0].id).toBe(primeira.id);
    expect(capa.body.result[0].ordem).toBe(0);

    const exclusaoPrimeira = await request(app)
      .delete(`/api/veiculo/${veiculo.id}/imagens/${primeira.id}`)
      .set("Authorization", `Bearer ${locador.token}`);
    expect(exclusaoPrimeira.status).toBe(204);
    expect((await fetch(primeira.url)).status).toBe(404);

    const exclusaoSegunda = await request(app)
      .delete(`/api/veiculo/${veiculo.id}/imagens/${segunda.id}`)
      .set("Authorization", `Bearer ${locador.token}`);
    expect(exclusaoSegunda.status).toBe(204);

    const storage = new S3StorageProvider();
    const [privadas, publicas] = await Promise.all([
      storage.listObjects({ bucket: env.MEDIA_PRIVATE_BUCKET }),
      storage.listObjects({ bucket: env.MEDIA_PUBLIC_BUCKET }),
    ]);
    const prefixo = `vehicles/${veiculo.id}/`;
    expect(privadas.filter((objeto) => objeto.key.startsWith(prefixo))).toEqual([]);
    expect(publicas.filter((objeto) => objeto.key.startsWith(prefixo))).toEqual([]);
  });
});
