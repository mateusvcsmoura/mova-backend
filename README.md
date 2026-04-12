# Mova Backend

API backend em Node.js + TypeScript para gerenciamento de contas, locadores, locatários, veículos e deficiências.

## Stack

- Node.js
- TypeScript
- Express
- Prisma ORM

## Estrutura do projeto

Arquitetura em camadas:

- `routes/`: definição das rotas HTTP
- `controllers/`: entrada das requisições
- `services/`: regras de negócio
- `repositories/`: acesso a dados
- `schemas/`: validações
- `prisma/`: schema e configuração de banco

## Pré-requisitos

- Node.js 18+
- PostgreSQL

## Configuração inicial

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env` com base no `.env.example`.

3. Gere o build do projeto:

```bash
npm run build
```

4. Inicie a API:

```bash
npm start
```

## Scripts

- `npm run build`: compila o projeto TypeScript
- `npm run start`: inicia a API compilada

## Observações

- A versão da API é exposta via middleware (`v1.0.0`).
