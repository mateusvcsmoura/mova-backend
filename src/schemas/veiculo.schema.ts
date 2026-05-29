import { z } from "zod";
import { StatusVeiculo } from "@prisma/client";

export const veiculoStatusSchema = z.nativeEnum(StatusVeiculo);

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

  eletrico: z.boolean(),
  adaptado: z.boolean(),
});

export const updateVeiculoSchema = createVeiculoSchema
  .omit({ idLocador: true }) // não pode alterar dono
  .partial();

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
  garagemId: z.string().uuid().optional(),
  placas: z.array(z.string().min(1)).min(1, "Informe ao menos uma placa"),
});

export const updateModeloVeiculoSchema = z
  .object({
    cambio: z.string().min(1).optional(),
    capacidade: z.number().int().positive().optional(),
    eletrico: z.boolean().optional(),
    adaptado: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualização",
  });

export const updateModeloDoVeiculoSchema = z.object({
  idLocador: z.string().uuid(),
  marca: z.string().min(1),
  modelo: z.string().min(1),
  ano: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  cambio: z.string().min(1),
  capacidade: z.number().int().positive(),
  eletrico: z.boolean(),
  adaptado: z.boolean(),
});