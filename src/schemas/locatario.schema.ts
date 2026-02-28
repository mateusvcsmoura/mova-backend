import { z } from "zod";

export const createLocatarioSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter exatamente 11 números"),
  cnh: z.string().regex(/^\d{11}$/, "CNH deve conter exatamente 11 números"),
  deficiencia_id: z
    .string()
    .uuid("Deficiência ID deve ser um UUID válido")
    .optional(),
});

export const updateLocatarioSchema = z.object({
  cpf: z
    .string()
    .regex(/^\d{11}$/)
    .optional(),
  cnh: z
    .string()
    .regex(/^\d{11}$/)
    .optional(),
  deficiencia_id: z.string().uuid().optional(),
});
