import { z } from "zod";
import { VeiculoStatus } from "../repositories/contracts/veiculo.contract.js";

export const veiculoStatusSchema = z.nativeEnum(VeiculoStatus);

export const createVeiculoSchema = z.object({
  id_locador: z.string().uuid(),

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

  status: veiculoStatusSchema.default(VeiculoStatus.DISPONIVEL),

  eletrico: z.boolean(),
  adaptado: z.boolean(),
});

export const updateVeiculoSchema = createVeiculoSchema
  .omit({ id_locador: true }) // não pode alterar dono
  .partial();
