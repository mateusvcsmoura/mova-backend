import { z } from "zod";

export const createGaragemSchema = z.object({
  idLocador: z.string().uuid(),
  nome: z.string().min(2).max(255),
  endereco: z.string().min(2).max(255),
  capacidade: z.number().int().positive(),
  acessibilidade: z.boolean().optional(),
});

export const updateGaragemSchema = createGaragemSchema
  .omit({ idLocador: true }) // não pode alterar o locador responsável
  .partial();
