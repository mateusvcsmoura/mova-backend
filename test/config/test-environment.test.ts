import { describe, expect, it } from "vitest";

import { assertSafeTestEnvironment } from "../../src/config/test-environment";

const base = {
  NODE_ENV: "test",
  SEND_REAL_EMAIL: "false",
  DATABASE_URL_TEST: "postgresql://mova:mova@localhost:5433/mova_test?schema=public",
  DIRECT_URL_TEST: "postgresql://mova:mova@localhost:5433/mova_test?schema=public",
  DATABASE_URL: "postgresql://mova:mova@localhost:5433/mova_dev?schema=public",
};

describe("isolamento do ambiente de teste", () => {
  it("aceita somente o PostgreSQL local mova_test", () => {
    expect(() => assertSafeTestEnvironment(base)).not.toThrow();
  });

  it.each([
    ["banco de desenvolvimento", { ...base, DATABASE_URL_TEST: base.DATABASE_URL }],
    ["servidor remoto", { ...base, DATABASE_URL_TEST: "postgresql://mova:mova@db.example.test:5432/mova_test" }],
    ["porta não publicada pelo Docker", { ...base, DATABASE_URL_TEST: "postgresql://mova:mova@localhost:5432/mova_test" }],
    ["e-mail real habilitado", { ...base, SEND_REAL_EMAIL: "true" }],
  ])("bloqueia %s antes de qualquer limpeza", (_caso, config) => {
    expect(() => assertSafeTestEnvironment(config)).toThrow();
  });
});
