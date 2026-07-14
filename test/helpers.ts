import crypto from "node:crypto";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/database/prisma";
import { env } from "../src/config/env";
import { isValidCnh } from "../src/shared/documentos";

type Cargo = "LOCADOR" | "LOCATARIO" | "ADMIN";

// Contador global de processo — gera valores únicos entre chamadas.
// O banco é limpo por arquivo (setup.ts), então não há colisão de constraints.
let counter = 0;
const seq = () => ++counter;

const pad = (n: number, len: number) => String(n).padStart(len, "0").slice(-len);

export const DEFAULT_SENHA = "StrongPass#123";

export const uniqueEmail = (prefix = "acc") =>
  `${prefix}.${seq()}.${Math.floor(Math.random() * 1_000_000)}@test.local`;

// Geradores de documentos com dígitos verificadores VÁLIDOS (as validações
// reais rejeitam checksum inválido). Base sequencial garante unicidade.
function cpfComDv(base9: string): string {
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++)
      soma += Number(base[i]) * (pesoInicial - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base9, 10);
  const d2 = dv(base9 + d1, 11);
  return `${base9}${d1}${d2}`;
}

function cnpjComDv(base12: string): string {
  const calc = (num: string) => {
    const pesos =
      num.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < num.length; i++) soma += Number(num[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base12);
  const d2 = calc(base12 + d1);
  return `${base12}${d1}${d2}`;
}

function cnhComDv(base9: string): string {
  let soma = 0;
  for (let i = 0, p = 9; i < 9; i++, p--) soma += Number(base9[i]) * p;
  let dsc = 0;
  let dv1 = soma % 11;
  if (dv1 >= 10) {
    dv1 = 0;
    dsc = 2;
  }
  soma = 0;
  for (let i = 0, p = 1; i < 9; i++, p++) soma += Number(base9[i]) * p;
  let dv2 = soma % 11;
  if (dv2 >= 10) dv2 = 0;
  dv2 -= dsc;
  if (dv2 < 0) dv2 += 11;
  return `${base9}${dv1}${dv2}`;
}

export const uniqueCnpj = () => cnpjComDv(pad(100000000000 + seq(), 12));
export const uniqueCpf = () => cpfComDv(pad(100000000 + seq(), 9));
// Alguns bases produzem DV = 10 (CNH inexistente, 12 dígitos) — pula até obter
// uma CNH de 11 dígitos que passe na validação real (evita 400 esporádico).
export const uniqueCnh = () => {
  for (;;) {
    const cnh = cnhComDv(pad(200000000 + seq(), 9));
    if (cnh.length === 11 && isValidCnh(cnh)) return cnh;
  }
};
export const uniqueRg = () => pad(100000000 + seq(), 9);
// Data de nascimento válida (maioridade garantida) para os testes.
export const DEFAULT_DATA_NASCIMENTO = "1990-05-15";
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
      rg: uniqueRg(),
      dataNascimento: DEFAULT_DATA_NASCIMENTO,
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

// Cria um veículo. Exige token LOCADOR (dono) ou ADMIN — a rota de criação
// agora é protegida e o ownership é validado no service.
export async function createVeiculo(
  token: string,
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

  const res = await request(app)
    .post("/api/veiculo")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);
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

// Confirma o pagamento de uma reserva via webhook ASSINADO do gateway — o
// único caminho que altera statusPagamento agora (o cliente não pode mais setar
// via PUT). Assina o corpo cru com o mesmo HMAC-SHA256 que o gateway valida.
const WEBHOOK_HEADER: Record<string, string> = {
  mercadopago: "x-mp-signature",
  stripe: "stripe-signature",
  asaas: "asaas-signature",
};
const WEBHOOK_SECRET: Record<string, string | undefined> = {
  mercadopago: env.MERCADOPAGO_WEBHOOK_SECRET,
  stripe: env.STRIPE_WEBHOOK_SECRET,
  asaas: env.ASAAS_WEBHOOK_SECRET,
};

export function assinarWebhook(provider: string, corpo: string): string {
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET[provider] ?? "")
    .update(corpo)
    .digest("hex");
}

export async function confirmarPagamentoWebhook(
  idReserva: string,
  opts: {
    provider?: string;
    evento?: string;
    metodo?: string;
    assinatura?: string; // permite forçar assinatura inválida nos testes
  } = {},
) {
  const provider = opts.provider ?? "stripe";
  const corpo = JSON.stringify({
    idReserva,
    evento: opts.evento ?? "pagamento.sucesso",
    ...(opts.metodo ? { metodo: opts.metodo } : {}),
  });
  const assinatura = opts.assinatura ?? assinarWebhook(provider, corpo);

  return request(app)
    .post(`/api/webhooks/pagamento/${provider}`)
    .set(WEBHOOK_HEADER[provider] ?? "x-signature", assinatura)
    .set("Content-Type", "application/json")
    .send(corpo);
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
