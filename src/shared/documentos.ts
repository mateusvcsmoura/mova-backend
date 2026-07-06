// Validadores de documentos brasileiros (dígitos verificadores reais).
// Usados nas validações Zod para rejeitar números com formato válido mas
// checksum inválido (ex.: CPF "11111111111" ou sequência arbitrária).

function apenasDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function todosDigitosIguais(v: string): boolean {
  return /^(\d)\1+$/.test(v);
}

// CPF: 9 dígitos base + 2 verificadores (módulo 11).
export function isValidCpf(cpf: string): boolean {
  const c = apenasDigitos(cpf);
  if (c.length !== 11 || todosDigitosIguais(c)) return false;

  const dv = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = dv(c.slice(0, 9), 10);
  const d2 = dv(c.slice(0, 10), 11);
  return d1 === Number(c[9]) && d2 === Number(c[10]);
}

// CNPJ: 12 dígitos base + 2 verificadores (módulo 11 com pesos cíclicos).
export function isValidCnpj(cnpj: string): boolean {
  const c = apenasDigitos(cnpj);
  if (c.length !== 14 || todosDigitosIguais(c)) return false;

  const dv = (len: number): number => {
    const pesos =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(c[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = dv(12);
  const d2 = dv(13);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}

// CNH: 9 dígitos base + 2 verificadores (algoritmo do DENATRAN).
export function isValidCnh(cnh: string): boolean {
  const c = apenasDigitos(cnh);
  if (c.length !== 11 || todosDigitosIguais(c)) return false;

  let soma = 0;
  for (let i = 0, peso = 9; i < 9; i++, peso--) soma += Number(c[i]) * peso;
  let dsc = 0;
  let dv1 = soma % 11;
  if (dv1 >= 10) {
    dv1 = 0;
    dsc = 2;
  }

  soma = 0;
  for (let i = 0, peso = 1; i < 9; i++, peso++) soma += Number(c[i]) * peso;
  let dv2 = soma % 11;
  if (dv2 >= 10) dv2 = 0;
  dv2 -= dsc;
  if (dv2 < 0) dv2 += 11;

  return dv1 === Number(c[9]) && dv2 === Number(c[10]);
}
