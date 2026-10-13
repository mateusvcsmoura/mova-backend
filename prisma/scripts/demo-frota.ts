// Frota extra de demonstração: fotos para os veículos do seed que não tinham imagem e veículos novos para que
// cada filtro do catálogo (Econômico, Espaçoso, Executivo, PCD, Elétrico) mostre de 4 a 7 opções.
// Usado por seed-demo.ts (reset completo) e seed-demo-frota.ts (acréscimo sem apagar dados).
// Fotos: Wikimedia Commons, licenças livres — autor e licença em prisma/assets/veiculos/CREDITOS.md.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FOTOS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/veiculos");

export type FotoDemo = { arquivo: string; alt: string };

// Veículos do seed original que ficavam sem foto.
export const FOTOS_POR_PLACA: Record<string, FotoDemo> = {
  MOV5E67: { arquivo: "byd-dolphin.jpg", alt: "BYD Dolphin branco, vista dianteira" },
  MOV6F78: { arquivo: "chevrolet-spin.jpg", alt: "Chevrolet Spin branca, vista dianteira" },
  MOV7G89: { arquivo: "fiat-mobi.jpg", alt: "Fiat Mobi prata, vista dianteira" },
  PAR1H90: { arquivo: "toyota-corolla.jpg", alt: "Toyota Corolla branco, vista dianteira" },
};

type Dono = "locador" | "parceiro";

export const GARAGENS_EXTRA: Array<{ dono: Dono; nome: string; endereco: string; capacidade: number; acessibilidade: boolean }> = [
  { dono: "locador", nome: "Garagem Juvevê", endereco: "Rua Mateus Leme, 2000 - Juvevê, Curitiba", capacidade: 6, acessibilidade: true },
  { dono: "locador", nome: "Garagem Ecoville", endereco: "Rua Professor Pedro Viriato Parigot de Souza, 3000 - Ecoville, Curitiba", capacidade: 6, acessibilidade: true },
];

export type VeiculoExtra = {
  dono: Dono;
  garagem: string; // nome da garagem (do seed ou de GARAGENS_EXTRA)
  marca: string;
  modelo: string;
  ano: number;
  cambio: string;
  capacidade: number;
  categoria: "ECONOMICO" | "ESPACOSO" | "EXECUTIVO" | "PCD";
  eletrico?: boolean;
  adaptado?: boolean;
  valorDiaria: number;
  placa: string;
  foto: FotoDemo;
};

// Adaptados ficam em garagens com acessibilidade.
export const VEICULOS_EXTRA: VeiculoExtra[] = [
  { dono: "locador", garagem: "Garagem Água Verde", marca: "Renault", modelo: "Kwid", ano: 2023, cambio: "Manual", capacidade: 5, categoria: "ECONOMICO", valorDiaria: 109.9, placa: "MOV8H12", foto: { arquivo: "renault-kwid.jpg", alt: "Renault Kwid branco, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Água Verde", marca: "Volkswagen", modelo: "Polo", ano: 2023, cambio: "Automático", capacidade: 5, categoria: "ECONOMICO", valorDiaria: 139.9, placa: "MOV9J23", foto: { arquivo: "volkswagen-polo.jpg", alt: "Volkswagen Polo cinza, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Ecoville", marca: "BYD", modelo: "Dolphin Mini", ano: 2025, cambio: "Automático", capacidade: 4, categoria: "ECONOMICO", eletrico: true, valorDiaria: 159.9, placa: "MVA1K34", foto: { arquivo: "byd-dolphin-mini.jpg", alt: "BYD Dolphin Mini verde-limão, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Ecoville", marca: "GWM", modelo: "Ora 03", ano: 2024, cambio: "Automático", capacidade: 5, categoria: "ECONOMICO", eletrico: true, valorDiaria: 189.9, placa: "MVA2L45", foto: { arquivo: "gwm-ora-03.jpg", alt: "GWM Ora 03 branco, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Juvevê", marca: "Chevrolet", modelo: "Spin", ano: 2024, cambio: "Automático", capacidade: 7, categoria: "ESPACOSO", valorDiaria: 179.9, placa: "MVA3M56", foto: { arquivo: "chevrolet-spin.jpg", alt: "Chevrolet Spin branca, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Juvevê", marca: "Jeep", modelo: "Commander", ano: 2023, cambio: "Automático", capacidade: 7, categoria: "ESPACOSO", valorDiaria: 299.9, placa: "MVA4N67", foto: { arquivo: "jeep-commander.png", alt: "Jeep Commander prata, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Juvevê", marca: "Chevrolet", modelo: "Trailblazer", ano: 2022, cambio: "Automático", capacidade: 7, categoria: "ESPACOSO", valorDiaria: 279.9, placa: "MVA5P78", foto: { arquivo: "chevrolet-trailblazer.jpg", alt: "Chevrolet Trailblazer prata, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Ecoville", marca: "Volkswagen", modelo: "Tiguan Allspace", ano: 2023, cambio: "Automático", capacidade: 7, categoria: "ESPACOSO", valorDiaria: 289.9, placa: "MVA6Q89", foto: { arquivo: "volkswagen-tiguan-allspace.jpg", alt: "Volkswagen Tiguan Allspace cinza, vista dianteira" } },
  { dono: "parceiro", garagem: "Garagem Parceira Norte", marca: "Jeep", modelo: "Compass", ano: 2023, cambio: "Automático", capacidade: 5, categoria: "EXECUTIVO", valorDiaria: 239.9, placa: "PAR2J01", foto: { arquivo: "jeep-compass.jpg", alt: "Jeep Compass prata, vista dianteira" } },
  { dono: "parceiro", garagem: "Garagem Parceira Norte", marca: "Volkswagen", modelo: "Jetta", ano: 2023, cambio: "Automático", capacidade: 5, categoria: "EXECUTIVO", valorDiaria: 219.9, placa: "PAR3K12", foto: { arquivo: "volkswagen-jetta.jpg", alt: "Volkswagen Jetta branco, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Ecoville", marca: "Volvo", modelo: "EX30", ano: 2025, cambio: "Automático", capacidade: 5, categoria: "EXECUTIVO", eletrico: true, valorDiaria: 349.9, placa: "MVA7R90", foto: { arquivo: "volvo-ex30.jpg", alt: "Volvo EX30 branco, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Centro", marca: "Chevrolet", modelo: "Spin Adaptada", ano: 2024, cambio: "Automático", capacidade: 7, categoria: "PCD", adaptado: true, valorDiaria: 189.9, placa: "MVA8S01", foto: { arquivo: "chevrolet-spin-adaptada.jpg", alt: "Chevrolet Spin adaptada para PCD, cinza, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Centro", marca: "Fiat", modelo: "Doblò Adaptado", ano: 2021, cambio: "Manual", capacidade: 5, categoria: "PCD", adaptado: true, valorDiaria: 169.9, placa: "MVA9T12", foto: { arquivo: "fiat-doblo-adaptado.jpg", alt: "Fiat Doblò adaptado para PCD, branco, vista dianteira" } },
  { dono: "locador", garagem: "Garagem Batel", marca: "Volkswagen", modelo: "Virtus Adaptado", ano: 2024, cambio: "Automático", capacidade: 5, categoria: "PCD", adaptado: true, valorDiaria: 149.9, placa: "MVB1U23", foto: { arquivo: "volkswagen-virtus-adaptado.jpg", alt: "Volkswagen Virtus adaptado para PCD, branco, vista dianteira" } },
];

export const mimeDaFoto = (arquivo: string) => (arquivo.endsWith(".png") ? "image/png" : "image/jpeg");
