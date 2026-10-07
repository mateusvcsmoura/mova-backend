import "dotenv/config";
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_DATABASE = "mova_dev";
const MINIO_CONTAINER = process.env.MOVA_MINIO_CONTAINER || "mova-backend-minio-1";

if (!process.argv.includes("--confirmar")) {
  console.error(
    "Seed de demonstração NÃO executado: ele apaga todos os dados de mova_dev.\n" +
      "Rode novamente com: npm run db:seed:demo -- --confirmar",
  );
  process.exit(1);
}
if (process.env.NODE_ENV !== "development") {
  console.error(`Seed de demonstração bloqueado: NODE_ENV=${process.env.NODE_ENV ?? "(vazio)"} (esperado development).`);
  process.exit(1);
}
// Nenhum e-mail real durante o seed (o monitoramento de alertas roda no final).
process.env.SEND_REAL_EMAIL = "false";

function carregarCredenciaisMinio(): void {
  if (process.env.MEDIA_S3_ACCESS_KEY_ID && process.env.MEDIA_S3_SECRET_ACCESS_KEY) return;
  try {
    const out = execFileSync(
      "docker",
      ["inspect", "--format", "{{range .Config.Env}}{{println .}}{{end}}", MINIO_CONTAINER],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const vars = Object.fromEntries(
      out.split(/\r?\n/).filter(Boolean).map((linha) => {
        const i = linha.indexOf("=");
        return [linha.slice(0, i), linha.slice(i + 1)];
      }),
    );
    if (vars.MINIO_ROOT_USER && vars.MINIO_ROOT_PASSWORD) {
      process.env.MEDIA_S3_ACCESS_KEY_ID = vars.MINIO_ROOT_USER;
      process.env.MEDIA_S3_SECRET_ACCESS_KEY = vars.MINIO_ROOT_PASSWORD;
    }
  } catch {
    // Sem Docker/MinIO: imagens são puladas abaixo.
  }
}
carregarCredenciaisMinio();

// Imports dinâmicos: env e Prisma precisam ver as variáveis ajustadas acima.
const bcrypt = (await import("bcrypt")).default;
const { Cargo, CategoriaVeiculo, MetodoPagamento, StatusGaragem, StatusPagamento, StatusReserva, StatusVeiculo, TipoCobranca } =
  await import("@prisma/client");
const { prisma } = await import("../../src/database/prisma.js");
const { env } = await import("../../src/config/env.js");
const { isValidCpf, isValidCnh, isValidCnpj } = await import("../../src/shared/documentos.js");
const { ReservaService } = await import("../../src/services/reserva.js");
const { VeiculoImagemService } = await import("../../src/services/veiculo-imagem.js");
const { S3StorageProvider } = await import("../../src/infra/media/storage-provider.js");
const { monitoramentoVeiculoService } = await import("../../src/routes/container.js");

const SENHA = process.env.MOVA_DEMO_PASSWORD || "Mova@123";
const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;
const agora = Date.now();
const em = (ms: number) => new Date(agora + ms);
const assetsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../mova-frontend/src/assets");

// Completa a base com o menor sufixo aceito pelo validador real (DV válido, número fictício).
function documento(base: string, total: number, valido: (v: string) => boolean): string {
  for (let i = 0; i < 10 ** (total - base.length); i++) {
    const candidato = base + String(i).padStart(total - base.length, "0");
    if (valido(candidato)) return candidato;
  }
  throw new Error(`Sem documento válido para a base ${base}`);
}

// Mesmo formato/alfabeto do código real (ReservaService): XXXX-XXXX sem 0/O/1/I.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const bloco = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const codigoDesbloqueio = () => `${bloco()}-${bloco()}`;

const [{ current_database: banco }] = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
if (banco !== DEMO_DATABASE) {
  console.error(`Seed de demonstração bloqueado: conexão efetiva em ${banco} (esperado ${DEMO_DATABASE}).`);
  await prisma.$disconnect();
  process.exit(1);
}

const temMidia = Boolean(env.MEDIA_S3_ACCESS_KEY_ID && env.MEDIA_S3_SECRET_ACCESS_KEY);
const storage = new S3StorageProvider();

// Objetos de imagens antigas saem antes do TRUNCATE para não ficarem órfãos no MinIO.
if (temMidia) {
  const antigas = await prisma.veiculoImagem.findMany({ select: { objectKey: true } });
  for (const { objectKey } of antigas) {
    await Promise.allSettled([
      storage.deleteObject({ bucket: env.MEDIA_PRIVATE_BUCKET, key: objectKey }),
      storage.deleteObject({ bucket: env.MEDIA_PUBLIC_BUCKET, key: objectKey }),
    ]);
  }
}

const tabelas = await prisma.$queryRaw<Array<{ tablename: string }>>`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
await prisma.$executeRawUnsafe(`TRUNCATE ${tabelas.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

const senhaHash = await bcrypt.hash(SENHA, 10);

type CargoConta = (typeof Cargo)[keyof typeof Cargo];
const conta = (nome: string, email: string, cargo: CargoConta, telefone: string, cep: string, endereco: string) =>
  prisma.conta.create({ data: { nome, email, cargo, telefone, cep, endereco, senhaHash } });

// ── Contas ──────────────────────────────────────────────────────────────────
const locadorConta = await conta("Marina Duarte", "locadora.demo@mova.local", Cargo.LOCADOR, "41990000001", "80010000", "Rua XV de Novembro, 1000 - Centro, Curitiba");
const parceiroConta = await conta("Rafael Teixeira", "locadora.parceira@mova.local", Cargo.LOCADOR, "41990000002", "80020000", "Avenida Paraná, 500 - Cabral, Curitiba");
const anaConta = await conta("Ana Ribeiro", "ana.demo@mova.local", Cargo.LOCATARIO, "41990000003", "80030000", "Rua Chile, 200 - Rebouças, Curitiba");
const brunoConta = await conta("Bruno Carvalho", "bruno.demo@mova.local", Cargo.LOCATARIO, "41990000004", "80040000", "Rua Itupava, 300 - Alto da XV, Curitiba");
const carlaConta = await conta("Carla Nogueira", "carla.demo@mova.local", Cargo.LOCATARIO, "41990000005", "80050000", "Rua Padre Anchieta, 400 - Bigorrilho, Curitiba");

const locador = await prisma.locador.create({ data: { id: locadorConta.id, empresa: "MOVA Demo Mobilidade", cnpj: documento("112223330001", 14, isValidCnpj) } });
const parceiro = await prisma.locador.create({ data: { id: parceiroConta.id, empresa: "Parceira Locações (demo)", cnpj: documento("445556660001", 14, isValidCnpj) } });

const deficiencias = [];
for (const descricao of ["Mobilidade reduzida", "Deficiência visual", "Deficiência auditiva", "Necessidade de controle manual"]) {
  deficiencias.push(await prisma.deficiencia.create({ data: { descricao } }));
}

const locatario = (contaId: string, base: string, deficienciaId: string | null) =>
  prisma.locatario.create({
    data: {
      id: contaId,
      cpf: documento(base, 11, isValidCpf),
      cnh: documento(base, 11, isValidCnh),
      rg: base,
      dataNascimento: new Date("1992-05-14"),
      deficienciaId,
    },
  });
const ana = await locatario(anaConta.id, "529982247", deficiencias[0].id); // deficiência declarada (RN01)
const bruno = await locatario(brunoConta.id, "418362057", null);
const carla = await locatario(carlaConta.id, "307451968", null);

const seguro = await prisma.servicoOpcional.create({
  data: {
    nome: "Seguro adicional",
    descricao: "Proteção simulada opcional para a reserva.",
    detalhesCobertura: "Cobertura simulada: danos ao veículo, furto/roubo e assistência 24 h. Não é uma apólice real.",
    valor: 49.9,
  },
});
const tanque = await prisma.servicoOpcional.create({ data: { nome: "Tanque cheio", descricao: "Devolução sem necessidade de reabastecer.", valor: 250 } });

// ── Garagens ────────────────────────────────────────────────────────────────
type StatusGaragemDemo = (typeof StatusGaragem)[keyof typeof StatusGaragem];
const garagem = (idLocador: string, nome: string, endereco: string, capacidade: number, acessibilidade: boolean, status: StatusGaragemDemo = StatusGaragem.ATIVA) =>
  prisma.garagem.create({ data: { idLocador, nome, endereco, capacidade, veiculosAlocados: 0, acessibilidade, status } });
const gCentro = await garagem(locador.id, "Garagem Centro", "Rua XV de Novembro, 1000 - Centro, Curitiba", 6, true);
const gBatel = await garagem(locador.id, "Garagem Batel", "Avenida do Batel, 1500 - Batel, Curitiba", 4, true);
const gAgua = await garagem(locador.id, "Garagem Água Verde", "Avenida República Argentina, 900 - Água Verde, Curitiba", 3, false);
await garagem(locador.id, "Garagem Portão", "Rua João Bettega, 700 - Portão, Curitiba", 3, true, StatusGaragem.MANUTENCAO);
const gParceira = await garagem(parceiro.id, "Garagem Parceira Norte", "Avenida Paraná, 500 - Cabral, Curitiba", 3, true);

// ── Modelos e veículos ──────────────────────────────────────────────────────
type VeiculoDemo = {
  idLocador: string;
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  eletrico?: boolean;
  adaptado?: boolean;
  categoria: (typeof CategoriaVeiculo)[keyof typeof CategoriaVeiculo];
  valorDiaria: number;
  placa: string;
  garagemId: string | null;
  status?: (typeof StatusVeiculo)[keyof typeof StatusVeiculo];
  // Última transição de status, em dias atrás (alimenta o alerta de inatividade RN10).
  statusHaDias?: number;
  imagem?: { arquivo: string; alt: string };
};

async function veiculo(v: VeiculoDemo) {
  const modelo = await prisma.modeloVeiculo.create({
    data: {
      idLocador: v.idLocador,
      marca: v.marca,
      modelo: v.modelo,
      ano: v.ano,
      cambio: v.cambio,
      capacidade: v.capacidade,
      eletrico: v.eletrico ?? false,
      adaptado: v.adaptado ?? false,
      categoria: v.categoria,
      valorDiaria: v.valorDiaria,
    },
  });
  const status = v.status ?? StatusVeiculo.DISPONIVEL;
  const criado = await prisma.veiculo.create({
    data: { idLocador: v.idLocador, idModeloVeiculo: modelo.id, garagemId: v.garagemId, placa: v.placa, status, criadoEm: em(-60 * DIA) },
  });
  await prisma.veiculoStatusHistorico.create({ data: { idVeiculo: criado.id, status, criadoEm: em(-(v.statusHaDias ?? 60) * DIA) } });
  if (v.garagemId) {
    await prisma.garagem.update({ where: { id: v.garagemId }, data: { veiculosAlocados: { increment: 1 } } });
  }
  return { ...criado, valorDiaria: v.valorDiaria, imagem: v.imagem };
}

const onix = await veiculo({ idLocador: locador.id, marca: "Chevrolet", modelo: "Onix", ano: 2023, cambio: "Manual", capacidade: 5, categoria: CategoriaVeiculo.ECONOMICO, valorDiaria: 129.9, placa: "MOV1A23", garagemId: gCentro.id, imagem: { arquivo: "chevrolet-onix-flex.png", alt: "Chevrolet Onix, vista lateral" } });
const argo = await veiculo({ idLocador: locador.id, marca: "Fiat", modelo: "Argo", ano: 2022, cambio: "Manual", capacidade: 5, categoria: CategoriaVeiculo.ECONOMICO, valorDiaria: 119.9, placa: "MOV2B34", garagemId: gAgua.id, imagem: { arquivo: "fiat-argo-drive.png", alt: "Fiat Argo, vista lateral" } });
const hb20 = await veiculo({ idLocador: locador.id, marca: "Hyundai", modelo: "HB20 Plus Adaptado", ano: 2024, cambio: "Automático", capacidade: 5, adaptado: true, categoria: CategoriaVeiculo.PCD, valorDiaria: 139.9, placa: "MOV3C45", garagemId: gCentro.id, imagem: { arquivo: "hiunday-hb20-plus.png", alt: "Hyundai HB20 adaptado para PCD, vista lateral" } });
const civic = await veiculo({ idLocador: locador.id, marca: "Honda", modelo: "Civic", ano: 2023, cambio: "Automático", capacidade: 5, categoria: CategoriaVeiculo.EXECUTIVO, valorDiaria: 249.9, placa: "MOV4D56", garagemId: gBatel.id, imagem: { arquivo: "honda-civic-confort.png", alt: "Honda Civic, vista lateral" } });
const dolphin = await veiculo({ idLocador: locador.id, marca: "BYD", modelo: "Dolphin", ano: 2024, cambio: "Automático", capacidade: 5, eletrico: true, categoria: CategoriaVeiculo.ECONOMICO, valorDiaria: 199.9, placa: "MOV5E67", garagemId: gBatel.id });
const spin = await veiculo({ idLocador: locador.id, marca: "Chevrolet", modelo: "Spin", ano: 2023, cambio: "Automático", capacidade: 7, categoria: CategoriaVeiculo.ESPACOSO, valorDiaria: 179.9, placa: "MOV6F78", garagemId: gCentro.id, status: StatusVeiculo.MANUTENCAO, statusHaDias: 2 });
await veiculo({ idLocador: locador.id, marca: "Fiat", modelo: "Mobi", ano: 2021, cambio: "Manual", capacidade: 4, categoria: CategoriaVeiculo.ECONOMICO, valorDiaria: 99.9, placa: "MOV7G89", garagemId: null, status: StatusVeiculo.INATIVO, statusHaDias: 10 });
const corolla = await veiculo({ idLocador: parceiro.id, marca: "Toyota", modelo: "Corolla", ano: 2022, cambio: "Automático", capacidade: 5, categoria: CategoriaVeiculo.EXECUTIVO, valorDiaria: 229.9, placa: "PAR1H90", garagemId: gParceira.id });

const POSICAO_CENTRO = { latitude: -25.4296, longitude: -49.2713 };
const POSICAO_BATEL = { latitude: -25.4417, longitude: -49.2889 };
const posicoes = [
  [onix, POSICAO_CENTRO],
  [hb20, POSICAO_CENTRO],
  [civic, POSICAO_BATEL],
  [dolphin, POSICAO_BATEL],
  [argo, { latitude: -25.4561, longitude: -49.2823 }],
  [corolla, { latitude: -25.4183, longitude: -49.2622 }],
] as const;
for (const [v, p] of posicoes) {
  await prisma.localizacao.create({ data: { idVeiculo: v.id, ...p, dataHora: em(-5 * MINUTO) } });
}

// ── Reservas ────────────────────────────────────────────────────────────────
type ServicoDemo = { id: string; valor: unknown; nome: string; descricao: string; detalhesCobertura: string | null };
async function reserva(opts: {
  veiculo: { id: string; valorDiaria: number; garagemId: string | null };
  idLocatario: string;
  inicio: Date;
  fim: Date;
  status: (typeof StatusReserva)[keyof typeof StatusReserva];
  servicos?: ServicoDemo[];
  nota?: { nota: number; comentario: string };
}) {
  const servicos = opts.servicos ?? [];
  const valorServicos = servicos.reduce((total, s) => total + Number(s.valor), 0);
  const valorTotal = ReservaService.calcularValorBase(opts.veiculo.valorDiaria, opts.inicio, opts.fim) + valorServicos;
  const paga = opts.status !== StatusReserva.AGUARDANDO_PAGAMENTO;
  const usada = opts.status === StatusReserva.EM_ANDAMENTO || opts.status === StatusReserva.REALIZADA;
  const criada = await prisma.reserva.create({
    data: {
      idVeiculo: opts.veiculo.id,
      idLocatario: opts.idLocatario,
      idGaragemRetirada: opts.veiculo.garagemId,
      idGaragemDevolucao: opts.veiculo.garagemId,
      dataHoraInicio: opts.inicio,
      dataHoraFim: opts.fim,
      criadaEm: new Date(opts.inicio.getTime() - 3 * DIA),
      valorTotal,
      status: opts.status,
      statusPagamento: paga ? StatusPagamento.SUCESSO : StatusPagamento.AGUARDANDO_PAGAMENTO,
      metodoPagamento: paga ? MetodoPagamento.PIX : null,
      codigoDesbloqueio: paga ? codigoDesbloqueio() : null,
      codigoGeradoEm: paga ? new Date(opts.inicio.getTime() - 2 * DIA) : null,
      codigoUsadoEm: usada ? opts.inicio : null,
      devolvidoEm: opts.status === StatusReserva.REALIZADA ? opts.fim : null,
      servicos: {
        create: servicos.map((s) => ({ idServico: s.id, valor: Number(s.valor), nome: s.nome, descricao: s.descricao, detalhesCobertura: s.detalhesCobertura })),
      },
      // Mesmo registro que o fluxo real deixa ao pagar (lido pela consulta de pagamento/estorno).
      cobrancas: {
        create: [{
          tipo: TipoCobranca.PAGAMENTO_RESERVA,
          valor: valorTotal,
          statusPagamento: paga ? StatusPagamento.SUCESSO : StatusPagamento.AGUARDANDO_PAGAMENTO,
          metodoPagamento: paga ? MetodoPagamento.PIX : null,
        }],
      },
    },
  });
  if (opts.nota) {
    await prisma.avaliacao.create({ data: { idReserva: criada.id, nota: opts.nota.nota, comentario: opts.nota.comentario, data: opts.fim } });
  }
  return criada;
}

// Histórico concluído (relatórios RF17, avaliações e alerta de baixa avaliação do Argo).
await reserva({ veiculo: civic, idLocatario: carla.id, inicio: em(-40 * DIA), fim: em(-37 * DIA), status: StatusReserva.REALIZADA, servicos: [seguro], nota: { nota: 5, comentario: "Retirada rápida e carro impecável." } });
await reserva({ veiculo: onix, idLocatario: bruno.id, inicio: em(-30 * DIA), fim: em(-28 * DIA), status: StatusReserva.REALIZADA, nota: { nota: 4, comentario: "Tudo certo, garagem bem sinalizada." } });
await reserva({ veiculo: hb20, idLocatario: ana.id, inicio: em(-21 * DIA), fim: em(-18 * DIA), status: StatusReserva.REALIZADA, servicos: [seguro], nota: { nota: 5, comentario: "Adaptação funcionou bem, vaga acessível." } });
await reserva({ veiculo: argo, idLocatario: bruno.id, inicio: em(-15 * DIA), fim: em(-14 * DIA), status: StatusReserva.REALIZADA, nota: { nota: 2, comentario: "Carro entregue sujo." } });
await reserva({ veiculo: argo, idLocatario: carla.id, inicio: em(-9 * DIA), fim: em(-7 * DIA), status: StatusReserva.REALIZADA, servicos: [tanque], nota: { nota: 1, comentario: "Ar-condicionado não funcionava." } });
await reserva({ veiculo: dolphin, idLocatario: carla.id, inicio: em(-6 * DIA), fim: em(-5 * DIA), status: StatusReserva.REALIZADA });

// Cancelamento tardio com multa de 20 % já quitada (RN04; RN07 não bloqueia a conta).
const cancelada = await reserva({ veiculo: civic, idLocatario: bruno.id, inicio: em(-3 * DIA), fim: em(-2 * DIA), status: StatusReserva.CANCELADA });
await prisma.cobrancaReserva.create({
  data: {
    idReserva: cancelada.id,
    tipo: TipoCobranca.CANCELAMENTO,
    valor: Math.round(Number(cancelada.valorTotal) * 20) / 100,
    statusPagamento: StatusPagamento.SUCESSO,
    metodoPagamento: MetodoPagamento.PIX,
  },
});

// Reserva paga com janela de desbloqueio ABERTA agora (QR/código, RF15/RN03).
const reservaQr = await reserva({ veiculo: hb20, idLocatario: ana.id, inicio: em(-10 * MINUTO), fim: em(2 * DIA), status: StatusReserva.CONFIRMADA, servicos: [seguro] });

// Favorito e aviso de disponibilidade (RF05 / RN11).
await prisma.favorito.create({ data: { idLocatario: ana.id, idVeiculo: civic.id } });
await prisma.interesseVeiculo.create({ data: { idLocatario: ana.id, idVeiculo: spin.id } });

// ── Imagens no MinIO pelo serviço real ──────────────────────────────────────
const imagensEnviadas: string[] = [];
if (!temMidia) {
  console.warn("Aviso: credenciais do MinIO indisponíveis — veículos ficam sem imagem.");
} else {
  const service = new VeiculoImagemService(storage);
  for (const v of [onix, argo, hb20, civic]) {
    const caminho = resolve(assetsDir, v.imagem!.arquivo);
    if (!existsSync(caminho)) {
      console.warn(`Aviso: ${caminho} não encontrado — imagem pulada.`);
      continue;
    }
    await service.criar(v.id, readFileSync(caminho), "image/png", v.imagem!.alt, { id: locador.id, cargo: Cargo.LOCADOR });
    imagensEnviadas.push(v.placa);
  }
}

// ── Alertas RN10 pelo serviço real (sem e-mail: SEND_REAL_EMAIL=false) ───────
const monitoramento = await monitoramentoVeiculoService.executar();

console.log("\nSeed de demonstração concluído em mova_dev (dados fictícios).");
console.log(`Senha de todas as contas: ${process.env.MOVA_DEMO_PASSWORD ? "(valor de MOVA_DEMO_PASSWORD)" : SENHA}`);
console.log("  LOCADOR    locadora.demo@mova.local     (frota principal)");
console.log("  LOCADOR    locadora.parceira@mova.local (outro locador — isolamento)");
console.log("  LOCATÁRIO  ana.demo@mova.local          (deficiência declarada; reserva com desbloqueio liberado)");
console.log("  LOCATÁRIO  bruno.demo@mova.local        (sem deficiência — RN01 bloqueia adaptado)");
console.log("  LOCATÁRIO  carla.demo@mova.local        (histórico de reservas)");
console.log(`Reserva com desbloqueio liberado: ${reservaQr.id} (janela até ${em(2 * DIA).toISOString()})`);
console.log(`Posição do veículo para o geofence: ${POSICAO_CENTRO.latitude}, ${POSICAO_CENTRO.longitude}`);
console.log(`Imagens enviadas ao MinIO: ${imagensEnviadas.length ? imagensEnviadas.join(", ") : "nenhuma"}`);
console.log(`Alertas RN10: inatividade ${monitoramento.inatividade.candidatos}, baixa avaliação ${monitoramento.baixaAvaliacao.candidatos}`);

await prisma.$disconnect();
