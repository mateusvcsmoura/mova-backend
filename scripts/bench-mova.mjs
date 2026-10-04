// RNF03 — benchmark local reproduzível das operações principais (HTTP real,
// loopback, API em mova_dev com o seed de demonstração). Não grava dados:
// só leituras e a cotação de reserva.
//
//   node scripts/bench-mova.mjs [amostras=50] [saida.json]
//
// MOVA_API (padrão http://localhost:3000/api), MOVA_DEMO_PASSWORD.
import { cpus, totalmem, platform, release } from "node:os";
import { writeFileSync } from "node:fs";

const API = process.env.MOVA_API ?? "http://localhost:3000/api";
const SENHA = process.env.MOVA_DEMO_PASSWORD ?? "Mova@123";
const N = Number(process.argv[2] ?? 50);
const SAIDA = process.argv[3];
// Login usa bcrypt e tem rate limit (10/15 min por IP no .env padrão): poucas amostras.
// 2 logins de preparo + 1 de aquecimento + 6 amostras = 9 por execução.
const N_LOGIN = Math.min(N, 6);

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const inicio = performance.now();
  const res = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const corpoResposta = await res.json().catch(() => null);
  const ms = performance.now() - inicio;
  if (!res.ok) throw new Error(`${metodo} ${caminho} → ${res.status}`);
  return { ms, corpo: corpoResposta };
}

function estatisticas(amostras) {
  const ord = [...amostras].sort((a, b) => a - b);
  const p = (q) => ord[Math.min(ord.length - 1, Math.ceil(q * ord.length) - 1)];
  const media = ord.reduce((t, v) => t + v, 0) / ord.length;
  return { amostras: ord.length, mediaMs: +media.toFixed(1), p95Ms: +p(0.95).toFixed(1), maxMs: +ord.at(-1).toFixed(1) };
}

async function medir(nome, n, fn) {
  for (let i = 0; i < (n > 10 ? 3 : 1); i++) await fn(); // aquecimento
  const tempos = [];
  for (let i = 0; i < n; i++) tempos.push((await fn()).ms);
  return { operacao: nome, ...estatisticas(tempos) };
}

const login = (email) => chamar("POST", "/conta/auth/login", { corpo: { email, senha: SENHA } });
const tokenAna = (await login("ana.demo@mova.local")).corpo.result.token;
const tokenLocadora = (await login("locadora.demo@mova.local")).corpo.result.token;
const catalogo = (await chamar("GET", "/veiculo?limit=20")).corpo.result;
const veiculo = catalogo.find((v) => v.modeloVeiculo?.adaptado) ?? catalogo[0];
const inicio = new Date(Date.now() + 90 * 864e5);
const cotacao = {
  idVeiculo: veiculo.id,
  dataHoraInicio: inicio.toISOString(),
  dataHoraFim: new Date(inicio.getTime() + 2 * 864e5).toISOString(),
  idGaragemRetirada: veiculo.garagem?.id,
  idGaragemDevolucao: veiculo.garagem?.id,
};

const resultados = [
  await medir("GET /api/health", N, () => chamar("GET", "/health")),
  await medir("POST /api/conta/auth/login (bcrypt)", N_LOGIN, () => login("carla.demo@mova.local")),
  await medir("GET /api/veiculo (catálogo)", N, () => chamar("GET", "/veiculo?limit=20")),
  await medir("GET /api/veiculo?pcd=true (filtro PCD)", N, () => chamar("GET", "/veiculo?pcd=true")),
  await medir("GET /api/veiculo/:id (detalhe)", N, () => chamar("GET", `/veiculo/${veiculo.id}`)),
  await medir("POST /api/reserva/precificacao (cotação)", N, () => chamar("POST", "/reserva/precificacao", { token: tokenAna, corpo: cotacao })),
  await medir("GET /api/reserva (minhas reservas)", N, () => chamar("GET", "/reserva?limit=20", { token: tokenAna })),
  await medir("GET /api/dashboard/financeiro (locador)", N, () => chamar("GET", "/dashboard/financeiro", { token: tokenLocadora })),
  await medir("GET /api/dashboard/frota (locador)", N, () => chamar("GET", "/dashboard/frota", { token: tokenLocadora })),
];

const ambiente = {
  data: new Date().toISOString(),
  sistema: `${platform()} ${release()}`,
  cpu: `${cpus()[0]?.model?.trim()} (${cpus().length} threads)`,
  memoriaGB: +(totalmem() / 1024 ** 3).toFixed(1),
  node: process.version,
  api: API,
  observacao: "Loopback local, PostgreSQL 16 em Docker, banco mova_dev com o seed de demonstração. Não representa produção.",
};
const limiteMs = 3000;
const saida = { ambiente, limiteMs, resultados, todasAbaixoDoLimite: resultados.every((r) => r.maxMs < limiteMs) };
console.table(resultados);
console.log(`Todas as operações abaixo de ${limiteMs} ms (máximo): ${saida.todasAbaixoDoLimite}`);
if (SAIDA) writeFileSync(SAIDA, JSON.stringify(saida, null, 2));
