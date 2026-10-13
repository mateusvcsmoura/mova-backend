// Organiza a aba Suites do Allure: parentSuite = grupo (ator, entidade ou
// segmento), suite = describe de topo, subSuite = describes aninhados.
// O grupo sai do arquivo exato ou, na falta dele, da pasta dentro de test/.
const GRUPOS: Record<string, string[]> = {
  "Ator: Administrador": ["admin"],
  "Ator: Locador": ["locador", "dashboard"],
  "Ator: Locatário": ["locatario"],
  "Entidade: Auditoria": ["auditoria"],
  "Entidade: Avaliação": ["avaliacao"],
  "Entidade: Bloqueio de locatário": ["bloqueio"],
  "Entidade: Cobrança": ["cobranca"],
  "Entidade: Compartilhamento de reserva": ["compartilhamento"],
  "Entidade: Condutor adicional": ["condutor"],
  "Entidade: Conta": ["conta", "lgpd", "recuperacao", "re-review/blocker-c01-c02", "security/cargo-privilege"],
  "Entidade: Deficiência": ["deficiencia"],
  "Entidade: Favorito": ["favorito"],
  "Entidade: Garagem": ["garagem", "re-review/blocker-h04"],
  "Entidade: Interesse em veículo": ["interesse"],
  "Entidade: Localização": ["localizacao", "reserva/rastreamento-locatario"],
  "Entidade: Notificação": ["notificacao"],
  "Entidade: Pagamento": ["pagamento"],
  "Entidade: Reserva": [
    "reserva",
    "seguro",
    "repositories",
    "re-review/blocker-h01",
    "re-review/blocker-h02",
    "security/reserva-integridade",
    "security/reserva-veiculo-ownership",
  ],
  "Entidade: Serviço opcional": ["servico-opcional"],
  "Entidade: Veículo": ["veiculo", "monitoramento", "re-review/blocker-h03"],
  "Segmento: Autenticação e segurança": ["security"],
  "Segmento: Contrato da API": ["contrato"],
  "Segmento: Infraestrutura": ["basic", "concurrency", "config", "health", "shared/retry"],
  "Segmento: Internacionalização": ["i18n"],
  "Segmento: Jornadas ponta a ponta": ["e2e"],
  "Segmento: Validação de dados": ["shared/documentos"],
};

const GRUPO_POR_CAMINHO = new Map(
  Object.entries(GRUPOS).flatMap(([grupo, caminhos]) => caminhos.map((c) => [c, grupo] as const)),
);
const ROTULOS_DE_SUITE = new Set(["parentSuite", "suite", "subSuite"]);

export function grupoDoArquivo(arquivo: string): string | undefined {
  const relativo = arquivo.replace(/^(.*\/)?test\//, "").replace(/\.test\.ts$/, "");
  return GRUPO_POR_CAMINHO.get(relativo) ?? GRUPO_POR_CAMINHO.get(relativo.split("/")[0]);
}

type ResultadoAllure = { titlePath?: string[]; labels: Array<{ name: string; value: string }> };

// Listener beforeTestResultWrite do allure-vitest.
export function organizarSuites(resultado: ResultadoAllure): void {
  const partes = resultado.titlePath ?? [];
  const iArquivo = partes.findIndex((p) => p.endsWith(".test.ts"));
  if (iArquivo < 0) return;
  const [suite = partes[iArquivo], ...aninhados] = partes.slice(iArquivo + 1);
  resultado.labels = resultado.labels.filter((l) => !ROTULOS_DE_SUITE.has(l.name));
  resultado.labels.push(
    { name: "parentSuite", value: grupoDoArquivo(partes.slice(0, iArquivo + 1).join("/")) ?? "Sem grupo" },
    { name: "suite", value: suite },
  );
  if (aninhados.length) resultado.labels.push({ name: "subSuite", value: aninhados.join(" > ") });
}
