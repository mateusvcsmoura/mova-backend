# MOVA - Backend

## 1. Visão Geral

O MOVA é um backend em Node.js e TypeScript para uma plataforma de mobilidade e locação de veículos com foco em acessibilidade e organização digital do processo de aluguel.

O problema central que o backend resolve é dar suporte a um fluxo mais simples de cadastro, autenticação, consulta e administração de contas, perfis e veículos, reduzindo dependência de processos manuais e centralizando a persistência das informações em banco relacional.

O objetivo do backend, no estado atual do código, é fornecer a base técnica para autenticação, gerenciamento de perfis de usuário, catálogo de deficiências, gestão de veículos e suporte a consultas administrativas e operacionais.

## 2. Contexto de Negócio

O contexto do projeto é o de uma plataforma de mobilidade urbana voltada a locação digital. A proposta de negócio inclui veículos convencionais, executivos, adaptados e elétricos, além de apoio a usuários com necessidades de acessibilidade.

O público-alvo do sistema é composto principalmente por locatários, locadores e administradores. O código também separa responsabilidades por perfil de acesso, o que permite tratar cada tipo de usuário com regras próprias.

Os diferenciais já visíveis no backend implementado são a autenticação com JWT, a validação de entrada com Zod, o uso de Prisma com PostgreSQL e a separação clara entre conta, perfil e veículo. O domínio de acessibilidade aparece de forma concreta na entidade `Deficiencia` e no campo `adaptado` dos veículos.

## 3. Arquitetura da Aplicação

O backend foi implementado em TypeScript sobre Node.js, usando Express como framework HTTP.

As principais bibliotecas e tecnologias presentes no projeto são Prisma ORM, PostgreSQL, Zod, bcrypt, jsonwebtoken, cors, dotenv, Vitest e Supertest. O Prisma está configurado com o adaptador `@prisma/adapter-pg`, e o cliente é usado a partir do código fonte em `src/database/prisma.ts`.

A estrutura de diretórios deixa explícita a separação por camada:

- `src/app.ts` e `src/server.ts` concentram a aplicação Express e a inicialização do servidor.
- `src/routes/` organiza as rotas por domínio.
- `src/controllers/` recebe as requisições HTTP e faz a validação dos dados.
- `src/services/` concentra as regras de negócio.
- `src/repositories/` abstrai o acesso ao banco.
- `src/schemas/` reúne os schemas de validação com Zod.
- `src/middlewares/` concentra autenticação, autorização, versão da API e tratamento de erros.
- `prisma/` contém schema, migrations, seed e reset do banco.
- `test/` guarda os testes automatizados.

O padrão arquitetural predominante é uma arquitetura em camadas com separação entre transporte HTTP, validação, regra de negócio e persistência.

## 4. Estrutura do Backend

As camadas implementadas no código são:

- Rotas: definem os endpoints e conectam a aplicação aos controllers.
- Controllers: validam parâmetros e payloads com Zod e repassam a operação para os services.
- Services: aplicam regras de negócio, checam existência, duplicidade e permissões lógicas.
- Repositories: executam consultas e comandos no banco por meio do Prisma.
- Middlewares: lidam com autenticação JWT, autorização por cargo, resposta padronizada de erro e metadados da API.

O fluxo de execução segue este caminho:

`requisição HTTP -> rota -> middleware de autenticação/autorização (quando aplicável) -> controller -> service -> repository Prisma -> PostgreSQL`

O tratamento de falhas é centralizado pelo middleware de erro, o que evita duplicação de lógica de resposta nas rotas.

## 5. Modelagem de Domínio

As entidades identificadas no schema Prisma e no código são:

- `Conta`: dados principais do usuário, incluindo nome, email, telefone, senha hash, cargo, CEP e endereço.
- `Locador`: perfil do proprietário/anunciante, relacionado 1:1 com `Conta`.
- `Locatario`: perfil do usuário que aluga, também relacionado 1:1 com `Conta`.
- `Deficiencia`: catálogo de condições de acessibilidade.
- `ModeloVeiculo`: dados técnicos do modelo do veículo.
- `Veiculo`: unidade física disponível para locação.
- `Garagem`: ponto de armazenamento e retirada de veículos.
- `Reserva`: registro de locação planejada ou em andamento.
- `Localizacao`: pontos de rastreamento de veículos.
- `Avaliacao`: feedback associado a uma reserva.

Os relacionamentos realmente presentes no schema são:

- `Conta` 1:1 `Locador`
- `Conta` 1:1 `Locatario`
- `Locador` 1:N `Veiculo`
- `Locador` 1:N `Garagem`
- `Locador` 1:N `ModeloVeiculo`
- `Veiculo` N:1 `ModeloVeiculo`
- `Veiculo` N:1 `Garagem` opcional
- `Veiculo` 1:N `Reserva`
- `Veiculo` 1:N `Localizacao`
- `Reserva` 1:1 opcional `Avaliacao`
- `Locatario` N:1 opcional `Deficiencia`

O código atual não implementa fluxos completos para `Reserva`, `Localizacao`, `Avaliacao` e `Garagem`, mas essas entidades já existem no modelo de dados.

## 6. Funcionalidades Implementadas

### Conta e autenticação

Objetivo: permitir cadastro, login, consulta da conta autenticada, atualização de perfil, troca de senha e exclusão da conta.

Fluxo resumido: o controller valida os dados com Zod, o service verifica duplicidade, gera hash de senha com bcrypt, emite JWT com `jsonwebtoken` e usa o repository Prisma para persistência.

Endpoints:

- `POST /api/conta/auth/register`
- `POST /api/conta/auth/login`
- `GET /api/conta/auth/me`
- `PUT /api/conta/auth/update-profile`
- `PATCH /api/conta/auth/change-password`
- `DELETE /api/conta/auth/delete-account`
- `GET /api/admin/conta/all`
- `GET /api/admin/conta/`
- `GET /api/admin/conta/:id`
- `POST /api/admin/conta/create`
- `PUT /api/admin/conta/update/:id`
- `DELETE /api/admin/conta/delete/:id`

Componentes envolvidos: `src/controllers/conta.ts`, `src/services/conta.ts`, `src/repositories/prisma/prisma.conta.repository.ts`, `src/schemas/conta.schema.ts`, `src/middlewares/auth-middleware.ts`.

### Deficiências

Objetivo: manter um catálogo de deficiências que pode ser associado ao locatário.

Fluxo resumido: o controller valida o payload e os parâmetros, o service impede duplicidade por descrição e o repository persiste os registros via Prisma.

Endpoints:

- `GET /api/deficiencia/all`
- `GET /api/deficiencia/search`
- `GET /api/deficiencia/:id`
- `POST /api/deficiencia/`
- `PUT /api/deficiencia/:id`
- `DELETE /api/deficiencia/:id`

Componentes envolvidos: `src/controllers/deficiencia.ts`, `src/services/deficiencia.ts`, `src/repositories/prisma/prisma.deficiencia.repository.ts`, `src/schemas/deficiencia.schema.ts`.

### Locador

Objetivo: cadastrar e manter os dados do locador, incluindo empresa e CNPJ.

Fluxo resumido: o controller valida UUIDs e campos obrigatórios, o service verifica existência e evita duplicidade por CNPJ e empresa, e o repository acessa a tabela `Locador`.

Endpoints:

- `GET /api/locador/all`
- `GET /api/locador/search`
- `GET /api/locador/:id`
- `POST /api/locador/`
- `PUT /api/locador/:id`
- `DELETE /api/locador/:id`

Componentes envolvidos: `src/controllers/locador.ts`, `src/services/locador.ts`, `src/repositories/prisma/prisma.locador.repository.ts`, `src/schemas/locador.schema.ts`.

### Locatário

Objetivo: cadastrar e manter os dados do locatário, com CPF, CNH e associação opcional a deficiência.

Fluxo resumido: o controller valida os campos com Zod, o service impede duplicidade por CPF e CNH e o repository grava a relação com `deficienciaId` quando informada.

Endpoints:

- `GET /api/locatario/all`
- `GET /api/locatario/search`
- `GET /api/locatario/:id`
- `POST /api/locatario/`
- `PUT /api/locatario/:id`
- `DELETE /api/locatario/:id`

Componentes envolvidos: `src/controllers/locatario.ts`, `src/services/locatario.ts`, `src/repositories/prisma/prisma.locatario.repository.ts`, `src/schemas/locatario.schema.ts`.

### Veículos

Objetivo: gerenciar veículos e seus modelos, incluindo criação individual, criação em lote, atualização do modelo e troca de modelo de um veículo específico.

Fluxo resumido: o controller valida os dados, o service checa duplicidade de placa e consistência do lote, e o repository faz o `upsert` do `ModeloVeiculo`, grava `Veiculo` e usa um mapper para devolver a resposta já estruturada.

Endpoints:

- `GET /api/veiculo/`
- `GET /api/veiculo/:id`
- `GET /api/veiculo/locador/:id_locador`
- `POST /api/veiculo/`
- `POST /api/veiculo/lote`
- `PUT /api/veiculo/:id`
- `DELETE /api/veiculo/:id`
- `PATCH /api/veiculo/modelos/:id_modelo`
- `PATCH /api/veiculo/:id_veiculo/modelo`

Componentes envolvidos: `src/controllers/veiculo.ts`, `src/services/veiculo.ts`, `src/repositories/prisma/prisma.veiculo.repository.ts`, `src/repositories/mappers/veiculo.mapper.ts`, `src/schemas/veiculo.schema.ts`.

### Saúde da API

Objetivo: expor um endpoint simples de verificação de disponibilidade.

Endpoint:

- `GET /api/basic/status`

Componentes envolvidos: `src/routes/basic/basic.ts`.

## 7. Banco de Dados

A tecnologia de banco é PostgreSQL, acessada pelo Prisma ORM com o adaptador `@prisma/adapter-pg`.

A estrutura do schema inclui as entidades `Conta`, `Locador`, `Locatario`, `Deficiencia`, `ModeloVeiculo`, `Veiculo`, `Garagem`, `Reserva`, `Localizacao` e `Avaliacao`, além dos enums `Cargo`, `StatusVeiculo`, `StatusReserva` e `StatusPagamento`.

Os relacionamentos e restrições já presentes no banco incluem unicidade de email, CPF, CNPJ e placa, além de relação 1:1 entre conta e perfil, e relação de veículos com modelo e garagem.

O projeto também possui migrations versionadas em `prisma/migrations`, seed em `prisma/seed.ts` e script de reset em `prisma/reset.ts`.

## 8. Segurança e Validações

A autenticação é feita com JWT. O middleware `authMiddleware` lê o token do header `Authorization`, valida a assinatura com `JWT_SECRET` e popula `req.user`.

A autorização é baseada em cargo, com os middlewares `authorize(...)` e `authorizeOwner(...)`. Eles suportam controle por perfil como `ADMIN`, `LOCADOR` e `LOCATARIO`, além de checagem de propriedade do recurso pela rota.

As senhas são protegidas com `bcrypt`, tanto no cadastro quanto na troca de senha.

As validações de entrada são feitas com Zod em todos os controllers principais, cobrindo UUIDs, emails, CEP, CPF, CNPJ, CNH, placas, enums e obrigatoriedade de campos mínimos.

O tratamento de erros é centralizado por `src/middlewares/error-handler.ts` e complementado por `HttpError`, que padroniza respostas como 400, 401, 403, 404 e 409.

## 9. Decisões Técnicas

Boas práticas encontradas no código:

- separação clara entre controller, service e repository;
- uso de interfaces de repositório para facilitar troca de implementação;
- validação antecipada com Zod antes de acessar o banco;
- retorno de respostas já mapeadas no caso de veículos;
- tratamento centralizado de erros;
- scripts separados para seed e reset do banco.

Padrões utilizados:

- arquitetura em camadas;
- injeção de dependência manual em `src/routes/container.ts`;
- RBAC por middleware;
- persistência tipada com Prisma.

A organização do projeto favorece leitura e manutenção, porque cada domínio possui seu próprio conjunto de rota, controller, service, repository e schema.

## 10. Estado Atual e Evolução

### Implementado

- cadastro, login e manutenção de conta;
- obtenção da conta autenticada;
- catálogo de deficiência com CRUD;
- CRUD de locador;
- CRUD de locatário;
- CRUD de veículo;
- criação de veículos em lote;
- atualização de modelo e troca de modelo do veículo;
- autenticação JWT;
- validação com Zod;
- persistência com Prisma e PostgreSQL;
- testes automatizados do fluxo de conta.

### Em desenvolvimento

- reservas completas;
- avaliações completas;
- localização em tempo real;
- garagem com fluxo próprio de gestão;
- regras de negócio mais específicas para locação, cancelamento e multa.

### Evoluções futuras

- implementar reserva com controle de datas e status;
- aplicar as regras de negócio do domínio, como limite de condutores adicionais, duração mínima e máxima, multa por cancelamento e bloqueio por pendências financeiras;
- ampliar testes para veículos, locador, locatário e deficiência;
- documentar a API com OpenAPI/Swagger;
- incluir rastreabilidade, auditoria e observabilidade.

## 11. Conclusão

O backend do MOVA já entrega a base técnica principal para uma plataforma de locação digital: autenticação, perfis, catálogo de acessibilidade, gestão de veículos e persistência relacional bem organizada.

O que está implementado mostra uma arquitetura consistente, com camadas separadas, validações explícitas e uso adequado de Prisma, Zod e JWT. Ao mesmo tempo, o schema já antecipa módulos futuros como reservas, avaliações, garagens e rastreamento, o que indica um backend preparado para evolução incremental.

## Roteiro Oral de Apresentação

1. A proposta do MOVA surge para resolver limitações comuns em plataformas de locação de veículos, principalmente a falta de acessibilidade, a burocracia e a pouca personalização do processo.
2. O MOVA é uma plataforma de mobilidade urbana voltada para locação digital, com atenção especial a veículos adaptados, perfis de usuário e futura integração com reservas e monitoramento.
3. O backend tem como objetivo central sustentar autenticação, perfis, catálogo de acessibilidade, veículos e persistência dos dados de forma segura e organizada.
4. A solução foi construída em Node.js com TypeScript, Express, Prisma, PostgreSQL e Zod, usando uma arquitetura em camadas para separar rota, controller, service e repository.
5. Entre as funcionalidades já implementadas, eu destacaria o cadastro e login de conta, a atualização de perfil, o catálogo de deficiência, o CRUD de locador e locatário, e o gerenciamento de veículos, inclusive criação em lote e troca de modelo.
6. As tecnologias foram escolhidas para reforçar segurança e qualidade: JWT para autenticação, bcrypt para senhas, Prisma para persistência tipada e Zod para validação dos dados recebidos.
7. Como desafio técnico, o principal ponto foi organizar o backend para crescer por módulos sem perder coesão, deixando espaço para futuras regras como reservas, cancelamentos, multas e rastreamento em tempo real.
8. Os próximos passos são implementar os fluxos de reserva, avaliação, garagem e localização, além de ampliar os testes e documentar a API com Swagger.
9. Em resumo, o backend do MOVA já oferece a base estruturada para uma solução de locação digital acessível, com boa separação de responsabilidades e espaço claro para evolução.

---

Este documento foi elaborado com base exclusivamente no código presente no repositório e diferencia o que já está implementado do que ainda está apenas modelado no schema ou descrito no contexto de negócio.
