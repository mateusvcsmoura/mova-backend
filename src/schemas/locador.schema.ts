import { z } from "zod";
import { isValidCnpj } from "../shared/documentos.js";

// CNPJ: comprimento (regex) + dígitos verificadores reais (checksum).
const cnpjSchema = z
  .string()
  .regex(/^\d{14}$/, "CNPJ deve conter exatamente 14 números")
  .refine(isValidCnpj, "CNPJ inválido");

export const createLocadorSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),

  empresa: z
    .string()
    .min(3, "Empresa deve ter no mínimo 3 caracteres")
    .max(255),

  cnpj: cnpjSchema,
});

export const updateLocadorSchema = z.object({
  empresa: z.string().min(3).max(255).optional(),

  cnpj: cnpjSchema.optional(),
});
