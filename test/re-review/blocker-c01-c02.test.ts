import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app";
import { prisma } from "../../src/database/prisma";
import {
  DEFAULT_SENHA,
  createAdminAccount,
  createLocatario,
  uniqueEmail,
} from "../helpers";

// Re-review independente dos blockers FINAL-C-01 (registro público cria ADMIN)
// e FINAL-C-02 (self-update eleva cargo). Nada aqui confia nos relatórios das
// tasks anteriores: cada ataque é reproduzido pela API real e o efeito é
// verificado diretamente no banco.

const basePayload = () => ({
  nome: "Attacker Re Review",
  email: uniqueEmail("rr-c01"),
  senha: DEFAULT_SENHA,
  cep: "12345-678",
  endereco: "Rua do Ataque, 1",
});

describe("re-review DB safety", () => {
  it("roda contra mova_test", async () => {
    expect(process.env.NODE_ENV).toBe("test");
    const [row] = await prisma.$queryRawUnsafe<
      { current_database: string }[]
    >("SELECT current_database()");
    expect(row.current_database).toBe("mova_test");
    expect(process.env.DATABASE_URL_TEST).toContain("mova_test");
    expect(process.env.DATABASE_URL_TEST).not.toBe(process.env.DATABASE_URL);
  });
});

describe("FINAL-C-01 — registro público não cria ADMIN", () => {
  const cargosProibidos = [
    "ADMIN",
    "admin",
    "Admin",
    " ADMIN ",
    "ADMIN ",
    "SUPERADMIN",
    "ROOT",
  ];

  for (const cargo of cargosProibidos) {
    it(`rejeita cargo=${JSON.stringify(cargo)}`, async () => {
      const payload = { ...basePayload(), cargo };
      const res = await request(app)
        .post("/api/conta/auth/register")
        .send(payload);

      expect(res.status).toBe(400);
      const conta = await prisma.conta.findUnique({
        where: { email: payload.email },
      });
      expect(conta).toBeNull();
    });
  }

  it("rejeita cargo em representações não-string (null/array/objeto/número)", async () => {
    for (const cargo of [null, ["ADMIN"], { value: "ADMIN" }, 2, true]) {
      const payload = { ...basePayload(), cargo };
      const res = await request(app)
        .post("/api/conta/auth/register")
        .send(payload as any);
      expect(res.status).toBe(400);
      const conta = await prisma.conta.findUnique({
        where: { email: payload.email },
      });
      expect(conta).toBeNull();
    }
  });

  it("propriedades administrativas extras não viram ADMIN nem sobrescrevem identidade", async () => {
    const payload = {
      ...basePayload(),
      cargo: "LOCATARIO",
      id: "11111111-1111-1111-1111-111111111111",
      senhaHash: "$2b$10$forged",
      criadaEm: "2000-01-01T00:00:00.000Z",
      role: "ADMIN",
      isAdmin: true,
      "cargo ": "ADMIN",
    };

    const res = await request(app)
      .post("/api/conta/auth/register")
      .send(payload as any);

    expect(res.status).toBe(201);
    expect(res.body.result.conta.cargo).toBe("LOCATARIO");

    const conta = await prisma.conta.findUnique({
      where: { email: payload.email },
    });
    expect(conta?.cargo).toBe("LOCATARIO");
    expect(conta?.id).not.toBe(payload.id);
    expect(conta?.senhaHash).not.toBe(payload.senhaHash);
  });

  it("chave cargo duplicada no JSON cru: ADMIN continua rejeitado", async () => {
    const email = uniqueEmail("rr-c01-dup");
    const corpo = JSON.stringify({
      nome: "Dup Key Attack",
      email,
      senha: DEFAULT_SENHA,
      cep: "12345-678",
      endereco: "Rua do Ataque, 1",
      cargo: "LOCATARIO",
      cargo2: "ADMIN",
    }).replace('"cargo2"', '"cargo"');

    const res = await request(app)
      .post("/api/conta/auth/register")
      .set("Content-Type", "application/json")
      .send(corpo);

    expect(res.status).toBe(400);
    const conta = await prisma.conta.findUnique({ where: { email } });
    expect(conta).toBeNull();
  });

  it("LOCATARIO e LOCADOR continuam cadastráveis pela rota pública", async () => {
    for (const cargo of ["LOCATARIO", "LOCADOR"]) {
      const payload = { ...basePayload(), cargo };
      const res = await request(app)
        .post("/api/conta/auth/register")
        .send(payload);
      expect(res.status).toBe(201);
      expect(res.body.result.conta.cargo).toBe(cargo);
      expect(res.body.result.token).toBeTruthy();
    }
  });

  it("token emitido no registro não abre rota ADMIN", async () => {
    const payload = { ...basePayload(), cargo: "LOCATARIO" };
    const registro = await request(app)
      .post("/api/conta/auth/register")
      .send(payload);
    const token = registro.body.result.token;

    const admin = await request(app)
      .get("/api/admin/conta/all")
      .set("Authorization", `Bearer ${token}`);
    expect(admin.status).toBe(403);
  });

  it("rotas alternativas de criação de conta não são públicas", async () => {
    const semToken = await request(app)
      .post("/api/admin/conta/create")
      .send({ ...basePayload(), cargo: "ADMIN" });
    expect(semToken.status).toBe(401);

    const locadorAnon = await request(app)
      .post("/api/locador")
      .send({
        id: "11111111-1111-1111-1111-111111111111",
        empresa: "X",
        cnpj: "1",
      });
    expect(locadorAnon.status).toBe(401);

    const locatarioAnon = await request(app)
      .post("/api/locatario")
      .send({ cpf: "12345678909", cnh: "12345678900", rg: "123456789" });
    expect(locatarioAnon.status).toBe(401);
  });

  it("LOCATARIO autenticado não consegue criar ADMIN por rota administrativa", async () => {
    const locatario = await createLocatario();
    const res = await request(app)
      .post("/api/admin/conta/create")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ ...basePayload(), cargo: "ADMIN" });
    expect(res.status).toBe(403);
  });

  it("banco: contagem de ADMIN não muda após tentativa pública", async () => {
    const antes = await prisma.conta.count({ where: { cargo: "ADMIN" } });
    const payload = { ...basePayload(), cargo: "ADMIN" };
    await request(app).post("/api/conta/auth/register").send(payload);
    const depois = await prisma.conta.count({ where: { cargo: "ADMIN" } });
    expect(depois).toBe(antes);
  });
});

describe("FINAL-C-02 — self-update não altera cargo", () => {
  it("PUT /auth/update-profile com cargo ADMIN falha por inteiro (nome não muda)", async () => {
    const locatario = await createLocatario();
    const nomeOriginal = (
      await prisma.conta.findUniqueOrThrow({
        where: { id: locatario.locatarioId },
      })
    ).nome;

    const res = await request(app)
      .put("/api/conta/auth/update-profile")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ nome: "Nome Legitimo Novo", cargo: "ADMIN" });

    expect(res.status).toBe(400);

    const conta = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.locatarioId },
    });
    expect(conta.cargo).toBe("LOCATARIO");
    expect(conta.nome).toBe(nomeOriginal);
  });

  it("outras representações de cargo também são rejeitadas", async () => {
    const locatario = await createLocatario();
    const variantes: unknown[] = [
      "admin",
      "Admin",
      " ADMIN ",
      "LOCADOR",
      null,
      ["ADMIN"],
      { cargo: "ADMIN" },
      undefined,
    ];

    for (const cargo of variantes) {
      const res = await request(app)
        .put("/api/conta/auth/update-profile")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ nome: "Nome Legitimo Novo", cargo } as any);
      // `undefined` some na serialização JSON: vira update legítimo só de nome.
      expect(res.status).toBe(cargo === undefined ? 200 : 400);
    }

    const conta = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.locatarioId },
    });
    expect(conta.cargo).toBe("LOCATARIO");
  });

  it("campos administrativos/internos são rejeitados (mass assignment)", async () => {
    const locatario = await createLocatario();
    const camposProibidos: Record<string, unknown>[] = [
      { id: "11111111-1111-1111-1111-111111111111" },
      { idConta: "11111111-1111-1111-1111-111111111111" },
      { senhaHash: "$2b$10$forged" },
      { senha: "OutraSenha#123" },
      { criadaEm: "2000-01-01T00:00:00.000Z" },
      { atualizadoEm: "2000-01-01T00:00:00.000Z" },
      { updatedAt: "2000-01-01T00:00:00.000Z" },
    ];

    for (const campo of camposProibidos) {
      const res = await request(app)
        .put("/api/conta/auth/update-profile")
        .set("Authorization", `Bearer ${locatario.token}`)
        .send({ nome: "Nome Legitimo Novo", ...campo });
      expect(res.status).toBe(400);
    }

    const conta = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.locatarioId },
    });
    expect(conta.cargo).toBe("LOCATARIO");
    expect(conta.id).toBe(locatario.locatarioId);
  });

  it("update legítimo continua funcionando", async () => {
    const locatario = await createLocatario();
    const res = await request(app)
      .put("/api/conta/auth/update-profile")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ nome: "Nome Legitimo Novo", endereco: "Rua Nova, 42" });

    expect(res.status).toBe(200);
    const conta = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.locatarioId },
    });
    expect(conta.nome).toBe("Nome Legitimo Novo");
    expect(conta.endereco).toBe("Rua Nova, 42");
    expect(conta.cargo).toBe("LOCATARIO");
  });

  it("após a tentativa, relogin devolve token LOCATARIO e rota ADMIN segue 403", async () => {
    const locatario = await createLocatario();

    await request(app)
      .put("/api/conta/auth/update-profile")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ cargo: "ADMIN" });

    const login = await request(app)
      .post("/api/conta/auth/login")
      .send({ email: locatario.email, senha: locatario.senha });
    expect(login.status).toBe(200);

    const novoToken = login.body.result.token;
    const admin = await request(app)
      .get("/api/admin/conta/all")
      .set("Authorization", `Bearer ${novoToken}`);
    expect(admin.status).toBe(403);

    const me = await request(app)
      .get("/api/conta/auth/me")
      .set("Authorization", `Bearer ${novoToken}`);
    expect(me.body.result.conta.cargo).toBe("LOCATARIO");
  });

  it("LOCATARIO não escala cargo pela rota administrativa de update", async () => {
    const locatario = await createLocatario();
    const res = await request(app)
      .put(`/api/admin/conta/update/${locatario.locatarioId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ cargo: "ADMIN" });
    expect(res.status).toBe(403);

    const conta = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.locatarioId },
    });
    expect(conta.cargo).toBe("LOCATARIO");
  });

  it("LOCATARIO não escala cargo pelas rotas de perfil locador/locatario", async () => {
    const locatario = await createLocatario();

    const viaLocatario = await request(app)
      .put(`/api/locatario/${locatario.locatarioId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ cargo: "ADMIN" });
    expect([200, 400, 403, 404]).toContain(viaLocatario.status);

    const viaLocador = await request(app)
      .put(`/api/locador/${locatario.locatarioId}`)
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ cargo: "ADMIN" });
    expect(viaLocador.status).toBe(403);

    const conta = await prisma.conta.findUniqueOrThrow({
      where: { id: locatario.locatarioId },
    });
    expect(conta.cargo).toBe("LOCATARIO");
  });

  it("CROSS-01: escalada falha e o IDOR de reservas por veículo continua 403", async () => {
    const locatario = await createLocatario();
    await request(app)
      .put("/api/conta/auth/update-profile")
      .set("Authorization", `Bearer ${locatario.token}`)
      .send({ cargo: "ADMIN" });

    const login = await request(app)
      .post("/api/conta/auth/login")
      .send({ email: locatario.email, senha: locatario.senha });
    const token = login.body.result.token;

    const admin = await createAdminAccount();
    expect(admin.token).toBeTruthy();

    const contas = await request(app)
      .get("/api/admin/conta/all")
      .set("Authorization", `Bearer ${token}`);
    expect(contas.status).toBe(403);

    const reservas = await request(app)
      .get("/api/reserva/veiculo/11111111-1111-1111-1111-111111111111")
      .set("Authorization", `Bearer ${token}`);
    expect(reservas.status).toBe(403);
  });
});
