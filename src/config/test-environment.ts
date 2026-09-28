const TEST_DATABASE_NAME = "mova_test";
const TEST_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const TEST_DATABASE_PORT = "5433";

type TestEnvironment = {
  NODE_ENV?: string;
  SEND_REAL_EMAIL?: string;
  DATABASE_URL?: string;
  DATABASE_URL_TEST?: string;
  DIRECT_URL_TEST?: string;
};

const parseDatabaseUrl = (value: string | undefined, name: string): URL => {
  if (!value) throw new Error(`${name} é obrigatório para testes destrutivos.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} não é uma URL PostgreSQL válida.`);
  }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) {
    throw new Error(`${name} precisa usar o protocolo PostgreSQL.`);
  }
  const host = url.hostname.toLowerCase();
  if (!TEST_DATABASE_HOSTS.has(host) || url.port !== TEST_DATABASE_PORT) {
    throw new Error(`${name} precisa apontar para localhost:5433.`);
  }
  if (url.pathname !== `/${TEST_DATABASE_NAME}`) {
    throw new Error(`${name} precisa apontar para o banco ${TEST_DATABASE_NAME}.`);
  }
  return url;
};

const sameTarget = (left: URL, right: URL): boolean =>
  left.protocol === right.protocol &&
  left.hostname === right.hostname &&
  left.port === right.port &&
  left.pathname === right.pathname;

export function assertSafeTestEnvironment(environment: TestEnvironment = process.env): {
  databaseUrl: URL;
  directUrl: URL;
} {
  if (environment.NODE_ENV !== "test") {
    throw new Error(`Testes destrutivos bloqueados: NODE_ENV=${environment.NODE_ENV ?? "(vazio)"}.`);
  }
  if (environment.SEND_REAL_EMAIL !== "false") {
    throw new Error("Testes destrutivos bloqueados: SEND_REAL_EMAIL precisa ser false.");
  }

  const databaseUrl = parseDatabaseUrl(environment.DATABASE_URL_TEST, "DATABASE_URL_TEST");
  const directUrl = parseDatabaseUrl(environment.DIRECT_URL_TEST, "DIRECT_URL_TEST");
  if (!sameTarget(databaseUrl, directUrl)) {
    throw new Error("DATABASE_URL_TEST e DIRECT_URL_TEST precisam apontar para o mesmo banco local.");
  }

  if (environment.DATABASE_URL) {
    let developmentUrl: URL;
    try {
      developmentUrl = new URL(environment.DATABASE_URL);
    } catch {
      developmentUrl = databaseUrl;
    }
    if (sameTarget(databaseUrl, developmentUrl)) {
      throw new Error("DATABASE_URL_TEST não pode compartilhar o mesmo alvo de DATABASE_URL.");
    }
  }

  return { databaseUrl, directUrl };
}

export { TEST_DATABASE_NAME, TEST_DATABASE_PORT };
