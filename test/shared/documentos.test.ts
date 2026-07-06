import { describe, it, expect } from "vitest";
import { isValidCpf, isValidCnpj, isValidCnh } from "../../src/shared/documentos";

describe("Validadores de documentos", () => {
  describe("CPF", () => {
    it("aceita CPF válido", () => {
      expect(isValidCpf("52998224725")).toBe(true);
      expect(isValidCpf("529.982.247-25")).toBe(true);
    });
    it("rejeita checksum inválido e dígitos repetidos", () => {
      expect(isValidCpf("52998224724")).toBe(false);
      expect(isValidCpf("11111111111")).toBe(false);
      expect(isValidCpf("123")).toBe(false);
    });
  });

  describe("CNPJ", () => {
    it("aceita CNPJ válido", () => {
      expect(isValidCnpj("11444777000161")).toBe(true);
      expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
    });
    it("rejeita checksum inválido e dígitos repetidos", () => {
      expect(isValidCnpj("11444777000162")).toBe(false);
      expect(isValidCnpj("00000000000000")).toBe(false);
    });
  });

  describe("CNH", () => {
    it("aceita CNH válida", () => {
      expect(isValidCnh("64735815259")).toBe(true);
    });
    it("rejeita checksum inválido e dígitos repetidos", () => {
      expect(isValidCnh("64735815258")).toBe(false);
      expect(isValidCnh("11111111111")).toBe(false);
      expect(isValidCnh("123")).toBe(false);
    });
  });
});
