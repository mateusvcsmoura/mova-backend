import { z } from "zod";

export const createContaSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(255),

  email: z.string().email("Email inválido").max(255),

  telefone: z
    .string()
    .regex(/^\d{10,15}$/, "Telefone deve ter entre 10 e 15 números")
    .optional(),

  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100),
});

export const updateContaSchema = z
  .object({
    nome: z.string().min(3).max(255).optional(),

    email: z.string().email().max(255).optional(),

    telefone: z
      .string()
      .regex(/^\d{10,15}$/, "Telefone deve ter entre 10 e 15 números")
      .optional(),

    senha: z.string().min(6).max(100).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Envie pelo menos um campo para atualização",
  );
