import bcrypt from "bcrypt";
import { Prisma, Cargo } from "@prisma/client";
import { prisma } from "../src/database/prisma.js";

const DEFAULT_PASSWORD = "Mova@123";
const DEFAULT_PASSWORD_ROUNDS = 10;

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
    .replace(/[\u0300-\u036f]/g, "")
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
      await tx.reserva.deleteMany();
      await tx.veiculo.deleteMany();
      await tx.modeloVeiculo.deleteMany(); // <- novo: limpa modelos após veículos
      await tx.garagem.deleteMany();
      await tx.locatario.deleteMany();
      await tx.locador.deleteMany();
      await tx.deficiencia.deleteMany();
      await tx.conta.deleteMany();

      // ── Contas ────────────────────────────────────────────────────────────
      const contasData = [
        ...Array.from({ length: 4 }, (_, index) => ({
          nome: `Locador ${buildFullName(index)}`,
          email: `locador.${index + 1}@mova.local`,
          telefone: `+55 41 9${String(70000000 + index).slice(-8)}`,
          senhaHash: passwordHash,
          cargo: Cargo.LOCADOR,
          cep: `800${String(10000 + index).slice(-5)}`,
          endereco: buildAddress(index),
        })),
        ...Array.from({ length: 7 }, (_, index) => {
          const nome = `Locatario ${buildFullName(index + 4)}`;
          return {
            nome,
            email: buildEmail(nome, index + 4),
            telefone:
              index % 2 === 0
                ? `+55 41 9${String(71000000 + index).slice(-8)}`
                : null,
            senhaHash: passwordHash,
            cargo: Cargo.LOCATARIO,
            cep: `820${String(10000 + index).slice(-5)}`,
            endereco: buildAddress(index + 4),
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
              deficienciaId: index < 3 ? deficiencias[index].id : null,
            },
          }),
        );
      }

      // ── Garagens ──────────────────────────────────────────────────────────
      const garagens = [] as Array<
        Awaited<ReturnType<typeof tx.garagem.create>>
      >;
      for (const [index, locador] of locadores.entries()) {
        garagens.push(
          await tx.garagem.create({
            data: {
              idLocador: locador.id,
              nome: `${locador.empresa} - Unidade ${index + 1}`,
              endereco: buildAddress(index + 8),
              capacidade: 6 + index,
              veiculosAlocados: 0,
              acessibilidade: index % 2 === 0,
            },
          }),
        );
      }

      // ── Modelos + Veículos ────────────────────────────────────────────────
      // O upsert garante que modelos com mesma combinação [idLocador, marca, modelo, ano]
      // não sejam duplicados, mesmo que o loop passe pelo mesmo locador mais de uma vez.
      const veiculos = [] as Array<
        Awaited<ReturnType<typeof tx.veiculo.create>>
      >;

      for (let index = 0; index < 10; index++) {
        const locador = locadores[index % locadores.length];
        const garagem = garagens[index % garagens.length];
        const assignToGarage = index % 3 !== 0;

        const marca = pick(vehicleBrands, index);
        const modelo = pick(vehicleModels, index + 2);
        const ano = 2020 + (index % 5);
        const cambio = pick(transmissions, index);
        const capacidade = 4 + (index % 3);
        const eletrico = index % 5 === 0;
        const adaptado = index % 4 === 1;

        // Upsert do modelo — mesmo comportamento do repository em produção
        const modeloVeiculo = await tx.modeloVeiculo.upsert({
          where: {
            idLocador_marca_modelo_ano: {
              idLocador: locador.id,
              marca,
              modelo,
              ano,
            },
          },
          update: {}, // já existe? não altera nada
          create: {
            idLocador: locador.id,
            marca,
            modelo,
            ano,
            cambio,
            capacidade,
            eletrico,
            adaptado,
          },
        });

        const veiculo = await tx.veiculo.create({
          data: {
            idLocador: locador.id,
            idModeloVeiculo: modeloVeiculo.id,
            garagemId: assignToGarage ? garagem.id : null,
            placa: formatPlaca(index + 1),
            status: index % 4 === 0 ? "MANUTENCAO" : "DISPONIVEL",
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

      return {
        contas: contasCriadas.length,
        locadores: locadores.length,
        locatarios: locatarios.length,
        deficiencias: deficiencias.length,
        garagens: garagens.length,
        modelosVeiculo: new Set(veiculos.map((v) => v.idModeloVeiculo)).size,
        veiculos: veiculos.length,
        senhaPadrao: DEFAULT_PASSWORD,
      };
    },
    { maxWait: 10000, timeout: 20000 },
  );

  console.log("Seed concluido com sucesso.");
  console.log(`- Contas: ${summary.contas}`);
  console.log(`- Locadores: ${summary.locadores}`);
  console.log(`- Locatarios: ${summary.locatarios}`);
  console.log(`- Deficiencias: ${summary.deficiencias}`);
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
