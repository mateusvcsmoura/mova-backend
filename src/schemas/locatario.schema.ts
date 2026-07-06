import { z } from "zod";
import { isValidCpf, isValidCnh } from "../shared/documentos.js";

// CPF/CNH: comprimento (regex) + dígitos verificadores reais (checksum).
const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, "CPF deve conter exatamente 11 números")
  .refine(isValidCpf, "CPF inválido");

const cnhSchema = z
  .string()
  .regex(/^\d{11}$/, "CNH deve conter exatamente 11 números")
  .refine(isValidCnh, "CNH inválida");

const IDADE_MINIMA = 18;
const IDADE_MAXIMA = 120;

// Calcula a idade completa (em anos) na data de hoje.
function idadeEmAnos(nascimento: Date): number {
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// RG: normaliza (remove pontos/traços/espaços, uppercase) e valida o formato
// geral — 6 a 14 caracteres terminando em dígito ou X (dígito verificador).
// Não força máscara de UF específica, mas garante um documento plausível.
const rgSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[.\-\s]/g, "").toUpperCase())
  .refine(
    (s) => /^[0-9]{5,13}[0-9X]$/.test(s),
    "RG inválido (use apenas números, com dígito verificador opcional X)",
  );

// Data de nascimento: aceita ISO string/Date, exige data no passado e idade
// entre 18 e 120 anos.
const dataNascimentoSchema = z.coerce
  .date({ message: "Data de nascimento inválida" })
  .refine((d) => d < new Date(), "Data de nascimento deve estar no passado")
  .refine(
    (d) => idadeEmAnos(d) >= IDADE_MINIMA,
    `O locatário deve ter ao menos ${IDADE_MINIMA} anos`,
  )
  .refine(
    (d) => idadeEmAnos(d) <= IDADE_MAXIMA,
    "Data de nascimento inválida",
  );

export const createLocatarioSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  cpf: cpfSchema,
  cnh: cnhSchema,
  rg: rgSchema,
  dataNascimento: dataNascimentoSchema,
  deficiencia_id: z
    .string()
    .uuid("Deficiência ID deve ser um UUID válido")
    .optional(),
});

export const updateLocatarioSchema = z.object({
  cpf: cpfSchema.optional(),
  cnh: cnhSchema.optional(),
  rg: rgSchema.optional(),
  dataNascimento: dataNascimentoSchema.optional(),
  deficiencia_id: z.string().uuid().optional(),
});
