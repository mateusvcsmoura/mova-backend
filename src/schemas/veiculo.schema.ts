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
