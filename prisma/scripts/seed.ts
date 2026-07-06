import bcrypt from "bcrypt";
import { Cargo } from "@prisma/client";
import { prisma } from "../../src/database/prisma.js";

const DEFAULT_PASSWORD = "Mova@123";
const DEFAULT_PASSWORD_ROUNDS = 10;

// ── Quantidades pedidas ───────────────────────────────────────────────────
const LOCATARIOS = 5;
const LOCADORES = 5;
const GARAGENS_POR_LOCADOR = 5;
const MODELOS_POR_LOCADOR = 3;
const VEICULOS_POR_LOCADOR = 5;

const firstNames = [
  "Ana",
  "Beatriz",
  "Carlos",
  "Daniel",
  "Eduarda",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabela",
  "Joao",
  "Karina",
  "Lucas",
  "Mariana",
  "Nicolas",
  "Olivia",
  "Paulo",
];

const lastNames = [
  "Almeida",
  "Barbosa",
  "Carvalho",
  "Dias",
  "Ferreira",
  "Gomes",
  "Haddad",
  "Ibrahim",
  "Lima",
  "Melo",
  "Nogueira",
  "Oliveira",
  "Pereira",
  "Queiroz",
  "Ribeiro",
  "Souza",
];

const cities = [
  "Curitiba",
  "Florianopolis",
  "Porto Alegre",
  "Sao Paulo",
  "Campinas",
  "Joinville",
  "Londrina",
  "Maringa",
];

const streetNames = [
  "Avenida Brasil",
  "Rua das Flores",
  "Rua das Palmeiras",
  "Avenida Central",
  "Rua do Comercio",
  "Travessa Esperanca",
  "Rua Horizonte",
  "Avenida dos Pioneiros",
];

const companyNames = [
  "Mova Mobilidade",
  "Rota Livre Locacoes",
  "Cidade em Movimento",
  "Prime Drive",
  "Velox Car Sharing",
  "Alpha Locadora",
];

const disabilityDescriptions = [
  "Mobilidade reduzida",
  "Deficiencia visual",
  "Deficiencia auditiva",
  "Necessidade de controle manual",
];

// Catálogo inicial de serviços opcionais. Novos serviços (cadeirinha, motorista
// adicional, etc.) entram aqui como novos registros, sem alterar a Reserva.
const servicosOpcionais = [
  {
    nome: "Seguro adicional",
    descricao: "Cobertura adicional contra danos e terceiros durante a locacao.",
    valor: 49.9,
  },
  {
    nome: "Tanque cheio",
    descricao: "Devolucao do veiculo sem necessidade de reabastecer.",
    valor: 250.0,
  },
];

const vehicleBrands = [
  "Fiat",
  "Volkswagen",
  "Chevrolet",
  "Hyundai",
  "Toyota",
  "Renault",
  "Honda",
];
const vehicleModels = [
  "Argo",
  "Polo",
  "Onix",
  "HB20",
  "Corolla",
  "Kwid",
  "City",
  "T-Cross",
];
const transmissions = ["Manual", "Automatico"];

function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

function formatCpf(index: number): string {
  const base = String(10000000000 + index).padStart(11, "0");
  return `${base.slice(0, 3)}.${base.slice(3, 6)}.${base.slice(6, 9)}-${base.slice(9, 11)}`;
}

function formatCnpj(index: number): string {
  const base = String(10000000000000 + index).padStart(14, "0");
  return `${base.slice(0, 2)}.${base.slice(2, 5)}.${base.slice(5, 8)}/${base.slice(8, 12)}-${base.slice(12, 14)}`;
}

function formatCnh(index: number): string {
  return String(70000000000 + index).padStart(11, "0");
}

function formatPlaca(index: number): string {
  const letters = [
    "ABC",
    "DEF",
    "GHI",
    "JKL",
    "MNO",
    "PQR",
    "STU",
    "VWX",
    "YZA",
  ];
  return `${pick(letters, index)}${String(1000 + index).slice(-4)}`;
}

function buildFullName(index: number): string {
  return `${pick(firstNames, index)} ${pick(lastNames, index)}`;
}

function buildEmail(name: string, index: number): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${normalized}.${index + 1}@mova.local`;
}

function buildAddress(index: number): string {
  return `${pick(streetNames, index)}, ${100 + index} - ${pick(cities, index)}`;
}

async function main() {
  const passwordHash = await bcrypt.hash(
    DEFAULT_PASSWORD,
    DEFAULT_PASSWORD_ROUNDS,
  );

  const summary = await prisma.$transaction(
    async (tx) => {
      // ── Limpeza — ordem respeita as foreign keys ──────────────────────────
      await tx.avaliacao.deleteMany();
      await tx.localizacao.deleteMany();
      await tx.reservaServico.deleteMany();
      await tx.reserva.deleteMany();
      await tx.servicoOpcional.deleteMany();
      await tx.veiculo.deleteMany();
      await tx.modeloVeiculo.deleteMany();
      await tx.garagem.deleteMany();
      await tx.locatario.deleteMany();
      await tx.locador.deleteMany();
      await tx.deficiencia.deleteMany();
      await tx.conta.deleteMany();

      // ── Contas ────────────────────────────────────────────────────────────
      const contasData = [
        ...Array.from({ length: LOCADORES }, (_, index) => ({
          nome: `Locador ${buildFullName(index)}`,
          email: `locador.${index + 1}@mova.local`,
          telefone: `+55 41 9${String(70000000 + index).slice(-8)}`,
          senhaHash: passwordHash,
          cargo: Cargo.LOCADOR,
          cep: `800${String(10000 + index).slice(-5)}`,
          endereco: buildAddress(index),
        })),
        ...Array.from({ length: LOCATARIOS }, (_, index) => {
          const nome = `Locatario ${buildFullName(index + LOCADORES)}`;
          return {
            nome,
            email: buildEmail(nome, index + LOCADORES),
            telefone:
              index % 2 === 0
                ? `+55 41 9${String(71000000 + index).slice(-8)}`
                : null,
            senhaHash: passwordHash,
            cargo: Cargo.LOCATARIO,
            cep: `820${String(10000 + index).slice(-5)}`,
            endereco: buildAddress(index + LOCADORES),
          };
        }),
      ];

      const contasCriadas = [] as Array<
        Awaited<ReturnType<typeof tx.conta.create>>
      >;
      for (const conta of contasData) {
        contasCriadas.push(await tx.conta.create({ data: conta }));
      }

      const contasLocador = contasCriadas.filter(
        (c) => c.cargo === Cargo.LOCADOR,
      );
      const contasLocatario = contasCriadas.filter(
        (c) => c.cargo === Cargo.LOCATARIO,
      );

      // ── Locadores ─────────────────────────────────────────────────────────
      const locadores = [] as Array<
        Awaited<ReturnType<typeof tx.locador.create>>
      >;
      for (const [index, conta] of contasLocador.entries()) {
        locadores.push(
          await tx.locador.create({
            data: {
              id: conta.id,
              empresa: pick(companyNames, index),
              cnpj: formatCnpj(index + 1),
            },
          }),
        );
      }

      // ── Deficiências ──────────────────────────────────────────────────────
      const deficiencias = [] as Array<
        Awaited<ReturnType<typeof tx.deficiencia.create>>
      >;
      for (const descricao of disabilityDescriptions) {
        deficiencias.push(await tx.deficiencia.create({ data: { descricao } }));
      }

      // ── Serviços opcionais (catálogo) ─────────────────────────────────────
      const servicos = [] as Array<
        Awaited<ReturnType<typeof tx.servicoOpcional.create>>
      >;
      for (const servico of servicosOpcionais) {
        servicos.push(await tx.servicoOpcional.create({ data: servico }));
      }

      // ── Locatários ────────────────────────────────────────────────────────
      const locatarios = [] as Array<
        Awaited<ReturnType<typeof tx.locatario.create>>
      >;
      for (const [index, conta] of contasLocatario.entries()) {
        locatarios.push(
          await tx.locatario.create({
            data: {
              id: conta.id,
              cpf: formatCpf(index + 1),
              cnh: formatCnh(index + 1),
              rg: String(100000000 + index + 1),
              dataNascimento: new Date("1990-01-01"),
              deficienciaId:
                index < deficiencias.length
                  ? deficiencias[index].id
                  : null,
            },
          }),
        );
      }

      // ── Garagens, Modelos e Veículos por Locador ──────────────────────────
      const garagens = [] as Array<
        Awaited<ReturnType<typeof tx.garagem.create>>
      >;
      const modelos = [] as Array<
        Awaited<ReturnType<typeof tx.modeloVeiculo.create>>
      >;
      const veiculos = [] as Array<
        Awaited<ReturnType<typeof tx.veiculo.create>>
      >;

      let placaSeq = 0;

      for (const [locadorIndex, locador] of locadores.entries()) {
        // 5 garagens deste locador
        const garagensDoLocador = [] as typeof garagens;
        for (let g = 0; g < GARAGENS_POR_LOCADOR; g++) {
          const seq = locadorIndex * GARAGENS_POR_LOCADOR + g;
          const garagem = await tx.garagem.create({
            data: {
              idLocador: locador.id,
              nome: `${locador.empresa} - Unidade ${g + 1}`,
              endereco: buildAddress(seq),
              capacidade: VEICULOS_POR_LOCADOR + g,
              veiculosAlocados: 0,
              acessibilidade: g % 2 === 0,
            },
          });
          garagens.push(garagem);
          garagensDoLocador.push(garagem);
        }

        // 3 modelos deste locador — ano distinto garante a unicidade
        // [idLocador, marca, modelo, ano] mesmo com marca/modelo repetidos
        const modelosDoLocador = [] as typeof modelos;
        for (let m = 0; m < MODELOS_POR_LOCADOR; m++) {
          const seq = locadorIndex * MODELOS_POR_LOCADOR + m;
          const modelo = await tx.modeloVeiculo.create({
            data: {
              idLocador: locador.id,
              marca: pick(vehicleBrands, seq),
              modelo: pick(vehicleModels, seq + 1),
              ano: 2020 + m,
              cambio: pick(transmissions, m),
              capacidade: 4 + (m % 3),
              eletrico: m === 0,
              adaptado: m === 1,
            },
          });
          modelos.push(modelo);
          modelosDoLocador.push(modelo);
        }

        // 5 veículos deste locador — distribuídos entre modelos e garagens
        for (let v = 0; v < VEICULOS_POR_LOCADOR; v++) {
          placaSeq += 1;
          const modeloVeiculo = modelosDoLocador[v % modelosDoLocador.length];
          // v === 0 fica sem garagem, demais ocupam uma vaga
          const assignToGarage = v !== 0;
          const garagem = garagensDoLocador[v % garagensDoLocador.length];

          const veiculo = await tx.veiculo.create({
            data: {
              idLocador: locador.id,
              idModeloVeiculo: modeloVeiculo.id,
              garagemId: assignToGarage ? garagem.id : null,
              placa: formatPlaca(placaSeq),
              status: v % 4 === 0 ? "MANUTENCAO" : "DISPONIVEL",
            },
          });
          veiculos.push(veiculo);

          if (assignToGarage) {
            await tx.garagem.update({
              where: { id: garagem.id },
              data: { veiculosAlocados: { increment: 1 } },
            });
          }
        }
      }

      return {
        contas: contasCriadas.length,
        locadores: locadores.length,
        locatarios: locatarios.length,
        deficiencias: deficiencias.length,
        servicosOpcionais: servicos.length,
        garagens: garagens.length,
        modelosVeiculo: modelos.length,
        veiculos: veiculos.length,
        senhaPadrao: DEFAULT_PASSWORD,
      };
    },
    { maxWait: 10000, timeout: 30000 },
  );

  console.log("Seed concluido com sucesso.");
  console.log(`- Contas: ${summary.contas}`);
  console.log(`- Locadores: ${summary.locadores}`);
  console.log(`- Locatarios: ${summary.locatarios}`);
  console.log(`- Deficiencias: ${summary.deficiencias}`);
  console.log(`- Servicos opcionais: ${summary.servicosOpcionais}`);
  console.log(`- Garagens: ${summary.garagens}`);
  console.log(`- Modelos de veiculo: ${summary.modelosVeiculo}`);
  console.log(`- Veiculos: ${summary.veiculos}`);
  console.log(`Senha padrao usada em todas as contas: ${summary.senhaPadrao}`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
