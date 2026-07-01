import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/database/prisma";

type Cargo = "LOCADOR" | "LOCATARIO" | "ADMIN";

// Contador global de processo — gera valores únicos entre chamadas.
// O banco é limpo por arquivo (setup.ts), então não há colisão de constraints.
let counter = 0;
const seq = () => ++counter;

const pad = (n: number, len: number) => String(n).padStart(len, "0").slice(-len);

export const DEFAULT_SENHA = "StrongPass#123";

export const uniqueEmail = (prefix = "acc") =>
  `${prefix}.${seq()}.${Math.floor(Math.random() * 1_000_000)}@test.local`;

export const uniqueCnpj = () => pad(20000000000000 + seq(), 14);
export const uniqueCpf = () => pad(20000000000 + seq(), 11);
export const uniqueCnh = () => pad(30000000000 + seq(), 11);
export const uniquePlaca = () => `ABC${pad(1000 + seq(), 4)}`;

export interface Account {
  conta: any;
  token: string;
  email: string;
  senha: string;
}

// Registra uma conta e faz login. Retorna o token de LOGIN, que contém o
// cargo no payload do JWT (necessário para o authMiddleware aceitar a rota).
export async function createAccount(
  cargo: Cargo,
  overrides: Record<string, unknown> = {},
): Promise<Account> {
  const email = uniqueEmail(cargo.toLowerCase());
  const payload = {
    nome: `Conta ${cargo} ${seq()}`,
    email,
    senha: DEFAULT_SENHA,
    cep: "12345-678",
    endereco: "Rua de Teste, 123",
    cargo,
    ...overrides,
  };

  const register = await request(app)
    .post("/api/conta/auth/register")
    .send(payload);

  const conta = register.body.result.conta;

  const login = await request(app)
    .post("/api/conta/auth/login")
    .send({ email, senha: DEFAULT_SENHA });

  return { conta, token: login.body.result.token, email, senha: DEFAULT_SENHA };
}

export interface LocadorContext extends Account {
  locador: any;
  locadorId: string;
  empresa: string;
  cnpj: string;
}

// Conta LOCADOR + registro de Locador (Locador.id === Conta.id).
export async function createLocador(): Promise<LocadorContext> {
  const account = await createAccount("LOCADOR");
  const empresa = `Empresa ${seq()} Ltda`;
  const cnpj = uniqueCnpj();

  const res = await request(app)
    .post("/api/locador")
    .send({ id: account.conta.id, empresa, cnpj });

  return {
    ...account,
    locador: res.body.result,
    locadorId: account.conta.id,
    empresa,
    cnpj,
  };
}

export interface LocatarioContext extends Account {
  locatario: any;
  locatarioId: string;
  cpf: string;
  cnh: string;
}

// Conta LOCATARIO + registro de Locatario (Locatario.id === Conta.id).
export async function createLocatario(
  deficienciaId?: string,
): Promise<LocatarioContext> {
  const account = await createAccount("LOCATARIO");
  const cpf = uniqueCpf();
  const cnh = uniqueCnh();

  const res = await request(app)
    .post("/api/locatario")
    .send({
      id: account.conta.id,
      cpf,
      cnh,
      ...(deficienciaId ? { deficiencia_id: deficienciaId } : {}),
    });

  return {
    ...account,
    locatario: res.body.result,
    locatarioId: account.conta.id,
    cpf,
    cnh,
  };
}

export async function createVeiculo(
  idLocador: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    idLocador,
    placa: uniquePlaca(),
    marca: "Fiat",
    modelo: "Argo",
    ano: 2022,
    cambio: "Manual",
    capacidade: 5,
    eletrico: false,
    adaptado: false,
    ...overrides,
  };

  const res = await request(app).post("/api/veiculo").send(payload);
  return res.body.result;
}

export async function createGaragem(
  token: string,
  idLocador: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    idLocador,
    nome: `Garagem ${seq()}`,
    endereco: "Avenida das Garagens, 500",
    capacidade: 10,
    acessibilidade: true,
    ...overrides,
  };

  const res = await request(app)
    .post("/api/garagem")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

  return res.body.result;
}

export async function createDeficiencia(
  adminToken: string,
  descricao = `Deficiência ${seq()}`,
) {
  const res = await request(app)
    .post("/api/deficiencia")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ descricao });

  return res.body.result;
}

// Cria um serviço opcional no catálogo. Inserido direto via Prisma porque o
// catálogo é populado por seed (não há endpoint público de criação).
export async function createServico(
  overrides: Record<string, unknown> = {},
) {
  const servico = await prisma.servicoOpcional.create({
    data: {
      nome: `Servico ${seq()}`,
      descricao: "Servico opcional de teste",
      valor: 50,
      ativo: true,
      ...overrides,
    },
  });
  // Normaliza Decimal -> number para uso direto nas asserções dos testes.
  return { ...servico, valor: Number(servico.valor) };
}

// Registra um ponto de localização para um veículo. Exige token LOCADOR/ADMIN.
export async function createLocalizacao(
  token: string,
  idVeiculo: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    idVeiculo,
    latitude: -23.5505,
    longitude: -46.6333,
    ...overrides,
  };

  const res = await request(app)
    .post("/api/localizacao")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

  return res.body.result;
}

// Gera um período no futuro (em dias a partir de agora) para reservas.
export function futurePeriod(startInDays = 1, durationInDays = 2) {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + startInDays);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + durationInDays);
  return {
    dataHoraInicio: inicio.toISOString(),
    dataHoraFim: fim.toISOString(),
  };
}

export async function createReserva(
  token: string,
  idVeiculo: string,
  idLocatario: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    idVeiculo,
    idLocatario,
    valorTotal: 250.5,
    ...futurePeriod(),
    ...overrides,
  };

  const res = await request(app)
    .post("/api/reserva")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

  return res.body.result;
}

// Cria um bloqueio de locatário via endpoint administrativo. Exige token ADMIN.
export async function createBloqueio(
  adminToken: string,
  idLocatario: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    idLocatario,
    motivo: "INADIMPLENCIA",
    ...overrides,
  };

  const res = await request(app)
    .post("/api/admin/bloqueio")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload);

  return res.body.result;
}

// Favorita um veículo em nome do locatário autenticado (token LOCATARIO).
export async function createFavorito(
  token: string,
  idVeiculo: string,
) {
  const res = await request(app)
    .post("/api/favorito")
    .set("Authorization", `Bearer ${token}`)
    .send({ idVeiculo });

  return res.body.result;
}

export async function createAvaliacao(
  token: string,
  idReserva: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    idReserva,
    nota: 5,
    ...overrides,
  };

  const res = await request(app)
    .post("/api/avaliacao")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

  return res.body.result;
}
