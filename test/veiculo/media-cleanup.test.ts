import { describe, expect, it } from "vitest";

import { selecionarOrfaos } from "../../src/infra/media/media-cleanup";

describe("seleção segura de objetos de mídia órfãos", () => {
  const agora = new Date("2026-09-28T12:00:00.000Z");

  it("não seleciona objeto sem timestamp ou ainda recente", () => {
    const selecionados = selecionarOrfaos({
      referencedKeys: new Set(),
      objects: [
        { bucket: "private", key: "sem-data" },
        { bucket: "private", key: "recente", lastModified: new Date("2026-09-28T11:30:00.000Z") },
      ],
      now: agora,
      minAgeMs: 60 * 60 * 1000,
    });

    expect(selecionados).toEqual([]);
  });

  it("seleciona somente objeto antigo sem referência", () => {
    const selecionados = selecionarOrfaos({
      referencedKeys: new Set(["referenciado"]),
      objects: [
        { bucket: "private", key: "antigo", lastModified: new Date("2026-09-28T10:00:00.000Z") },
        { bucket: "private", key: "referenciado", lastModified: new Date("2026-09-28T10:00:00.000Z") },
      ],
      now: agora,
      minAgeMs: 60 * 60 * 1000,
    });

    expect(selecionados).toEqual([{ bucket: "private", key: "antigo", lastModified: new Date("2026-09-28T10:00:00.000Z") }]);
  });
});
