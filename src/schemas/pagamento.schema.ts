import { z } from "zod";
import { MetodoPagamento } from "@prisma/client";

const cartaoSandboxSchema = z.object({
  numero: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s|-/g, ""))
    .refine((v) => /^\d{13,19}$/.test(v), "Número de cartão inválido."),
  nome: z.string().trim().min(2).max(255),
  validade: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Validade deve estar no formato MM/AA"),
  cvv: z.string().trim().regex(/^\d{3,4}$/, "CVV inválido"),
});

export const iniciarPagamentoSchema = z.object({
  metodoPagamento: z.nativeEnum(MetodoPagamento),
  cartao: cartaoSandboxSchema.optional(),
});
