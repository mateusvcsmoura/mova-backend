import { z } from "zod";
import { CategoriaVeiculo, StatusVeiculo } from "@prisma/client";

export const veiculoStatusSchema = z.nativeEnum(StatusVeiculo);
export const categoriaVeiculoSchema = z.nativeEnum(CategoriaVeiculo);

export const createVeiculoSchema = z.object({
  idLocador: z.string().uuid(),

  placa: z
    .string()
    .min(7)
    .max(8)
    .transform((v) => v.toUpperCase()),

  marca: z.string().min(2).max(255),
  modelo: z.string().min(1).max(255),

  ano: z.number().int().min(1900).max(2100),

  cambio: z.string().min(3).max(255),

  capacidade: z.number().int().positive(),

  status: z.nativeEnum(StatusVeiculo).default(StatusVeiculo.DISPONIVEL),

  // Veículos em preparação podem ficar sem garagem, mas uma garagem
  // informada precisa passar pela regra de ownership/capacidade do domínio.
  garagemId: z.string().uuid().nullable().optional(),

  eletrico: z.boolean(),
  adaptado: z.boolean(),
  categoria: z.nativeEnum(CategoriaVeiculo).optional(),

  // Preço da diária: o backend calcula o valor da reserva a partir daqui.
  valorDiaria: z.number().positive(),
});

export const updateVeiculoSchema = z
  .object({
    placa: createVeiculoSchema.shape.placa.optional(),
    status: z.nativeEnum(StatusVeiculo).optional(),
    garagemId: z.string().uuid().nullable().optional(),
    // Os dados do catálogo são aninhados para deixar explícita a fronteira
    // entre a instância física e o ModeloVeiculo. Campos como `marca` no
    // nível raiz devem ser rejeitados, nunca descartados silenciosamente.
    modelo: z
      .object({
        marca: z.string().min(2).max(255).optional(),
        modelo: z.string().min(1).max(255).optional(),
        ano: z.number().int().min(1900).max(2100).optional(),
        cambio: z.string().min(3).max(255).optional(),
        capacidade: z.number().int().positive().optional(),
        eletrico: z.boolean().optional(),
        adaptado: z.boolean().optional(),
        categoria: z.nativeEnum(CategoriaVeiculo).nullable().optional(),
        valorDiaria: z.number().positive().optional(),
      })
      .strict()
      .refine((data) => Object.values(data).some((v) => v !== undefined), {
        message: "Informe ao menos um campo do modelo para atualização",
      })
      .optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualização",
  });

export const createVeiculoLoteSchema = z.object({
  idLocador: z.string().uuid(),
  marca: z.string().min(1),
  modelo: z.string().min(1),
  ano: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  cambio: z.string().min(1),
  capacidade: z.number().int().positive(),
  eletrico: z.boolean(),
  adaptado: z.boolean(),
  categoria: z.nativeEnum(CategoriaVeiculo).optional(),
  valorDiaria: z.number().positive(),
  garagemId: z.string().uuid().nullable().optional(),
  placas: z.array(z.string().min(1)).min(1, "Informe ao menos uma placa"),
});

export const updateModeloVeiculoSchema = z
  .object({
    cambio: z.string().min(1).optional(),
    capacidade: z.number().int().positive().optional(),
    eletrico: z.boolean().optional(),
    adaptado: z.boolean().optional(),
    categoria: z.nativeEnum(CategoriaVeiculo).nullable().optional(),
    valorDiaria: z.number().positive().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualização",
  });

export const updateModeloDoVeiculoSchema = z
  .object({
    idLocador: z.string().uuid(),
    marca: z.string().min(1),
    modelo: z.string().min(1),
    ano: z.number().int().min(1900).max(new Date().getFullYear() + 1),
    cambio: z.string().min(1),
    capacidade: z.number().int().positive(),
    eletrico: z.boolean(),
    adaptado: z.boolean(),
    categoria: z.nativeEnum(CategoriaVeiculo).optional(),
    valorDiaria: z.number().positive(),
  })
  .strict();
