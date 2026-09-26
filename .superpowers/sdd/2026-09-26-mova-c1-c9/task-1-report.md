# Task 1 — catálogo público, orçamento e PCD

Data: 2026-09-26  
Repositórios: `mova-backend` (`main`) e `mova-frontend` (`develop`)

## Entrega

- Leituras públicas de veículos, garagens e serviços opcionais agora funcionam sem sessão e retornam somente campos de catálogo/jornada. Catálogo inclui somente veículos DISPONIVEL em garagem ATIVA, garagens ATIVAS e serviços ativos.
- A leitura do detalhe de veículo distingue catálogo público de gestão autenticada: visitante/locatário recebe o DTO público apenas para veículo reservável; locador autenticado vê dados de gestão somente do próprio veículo e ADMIN mantém acesso global.
- Orçamento é público, validado por schema estrito e sem identidade do locatário; não cria reserva nem aceita dados pessoais ou valor informado pelo cliente. Criação de reserva continua protegida por JWT/RBAC.
- O predicado PCD é `categoria=PCD OR adaptado=true`; filtros independentes intersectam esse resultado. A tela envia `pcd=true`.
- Frontend não envia token para leituras públicas/orçamento; a jornada de devolução usa `veiculoId` para o backend determinar as garagens do mesmo locador sem expor seu identificador.

## TDD e verificação

RED observado antes da implementação:

- Backend, testes focados de veículos, serviços, orçamento e jornada de garagem, em Vitest serial: **12 falhas esperadas, 61 passaram (73)**.
- Frontend, testes focados de serviços, orçamento e catálogo PCD: **7 falhas esperadas, 57 passaram (64)**.

GREEN e verificações finais:

- Backend focado: 4 arquivos, **73/73** testes.
- Frontend focado: **64/64** testes; fluxo `App.flow` após atualizar o contrato de devolução: **45/45**.
- Suíte backend completa, serial, omitindo apenas o teste opt-in de envio real de email: **62 arquivos, 776/776**.
- Suíte frontend completa, serial: **118 arquivos, 672/672**.
- `mova-backend`: `npm.cmd run build` passou.
- `mova-frontend`: `npm.cmd run build -- --configLoader runner` passou. O build Vite padrão não conseguiu ler diretório ancestral bloqueado pelo sandbox; `--configLoader runner` removeu essa dependência.

## Isolamento e preocupações

- O `DATABASE_URL_TEST` foi conferido como `mova_test` e sem compartilhamento com desenvolvimento. Configuração Vitest preserva execução serial e exclusão de `.worktrees/**`.
- `test/notificacao/real-email.test.ts` é opt-in e foi ativado pelo ambiente durante uma primeira execução ampla; expirou em 30s sem retornar `messageId`. Para evitar novos efeitos SMTP, a suíte final o excluiu. Não há confirmação de aceitação de envio.
- Testes de integração exibem o aviso existente do pacote `pg` sobre chamada a `client.query()` enquanto outra query está em execução; não causou falha na suíte final.
- Nenhuma migration, worktree ou push foi criado/feito.
