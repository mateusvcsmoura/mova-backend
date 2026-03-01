import { z } from "zod";

export const createDeficienciaSchema = z.object({
  descricao: z.string().min(2).max(255),
});

export const updateDeficienciaSchema = z.object({
  descricao: z.string().min(2).max(255).optional(),
});
