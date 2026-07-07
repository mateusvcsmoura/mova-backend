# Relatório de Cobertura de Testes

Gerado por `npm run test:coverage` (Vitest + provider v8). Suíte: **371 testes, 37 arquivos, todos passando**.

## Totais

| Métrica     | Cobertura | Coberto/Total |
|-------------|-----------|---------------|
| Statements  | **81.03%** | 2384 / 2942 |
| Branches    | **67.84%** | 920 / 1356 |
| Functions   | **90.83%** | 575 / 633 |
| Lines       | **83.56%** | 2314 / 2769 |

Excluídos do cálculo: `*.d.ts`, `src/server.ts` (bootstrap) e `src/routes/container.ts` (fiação de DI).

## Como gerar

```bash
npm run test:coverage
```

Relatório HTML navegável em `coverage/index.html`; resumo em máquina em `coverage/coverage-summary.json`. O diretório `coverage/` é ignorado pelo git.

## Onde a cobertura é menor (candidatos a testes futuros)

Concentra-se em camadas de repositório Prisma e mappers exercitados indiretamente (integração usa o banco real, então parte do código de mapeamento não é medido por unidade):

- `repositories/mappers/*.mapper.ts` — mappers de alerta/interesse/notificação (0%)
- `repositories/prisma/prisma.notificacao*.repository.ts` — 0%
- `repositories/prisma/prisma.monitoramento.repository.ts` — ~4%
- `repositories/prisma/prisma.interesse.repository.ts` — ~5%
- `controllers/interesse.ts`, `controllers/monitoramento.ts` — baixa cobertura de branches de erro

As regras de negócio (services) e os fluxos de API principais têm boa cobertura; o déficit está sobretudo em ramos de erro de infraestrutura e em mapeamento de dados.
