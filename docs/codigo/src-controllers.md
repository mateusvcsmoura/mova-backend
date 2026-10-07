# Notas de implementação — src/controllers

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/controllers/lgpd.ts`

**`private resolverTitular(req: Parameters<Handler>[0]): string {`**

Titular = :id quando informado (rota ADMIN/titular), senão o próprio autor
autenticado (rotas /meus-dados, /anonimizar, /acessos).

## `src/controllers/monitoramento.ts`

**`export class MonitoramentoController {`**

Acionamento manual da rotina de monitoramento (uso administrativo/dev). A
execução periódica em si acontece via MonitoramentoScheduler no boot — este
endpoint apenas reaproveita o mesmo service.

## `src/controllers/pagamento-webhook.ts`

**`handle: Handler = async (req, res, next) => {`**

O corpo chega como Buffer (express.raw na rota) para preservar os bytes
exatos usados na verificação da assinatura.

## `src/controllers/reserva.ts`

**`iniciarPagamento: Handler = async (req, res, next) => {`**

POST /api/reserva/:id/pagamento — inicia o pagamento.

Não confirma nada: registra a cobrança, deixa PROCESSANDO e entrega o
desfecho ao simulador de gateway, que devolve um webhook ASSINADO.

## `src/controllers/servico-opcional.ts`

**`const filters = { ativo: true };`**

Esta rota é o catálogo público: parâmetros não podem reexpor itens
inativos ou campos de gestão.
