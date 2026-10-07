# Notas de implementação — src/infra

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/infra/email/mail-provider.ts`

**`export interface SendMailInput {`**

Camada de infraestrutura de e-mail. A regra de negócio depende apenas desta
abstração — nunca de um provedor concreto. Trocar Nodemailer por Amazon SES,
Resend, SendGrid etc. significa apenas criar outra implementação de
IMailProvider e trocar o registro no container, sem tocar nos services.

**`isEnabled(): boolean;`**

Indica se o provedor está configurado e apto a enviar. Quando false, a
camada de notificação simplesmente não tenta enviar (dev/testes).

**`send(input: SendMailInput): Promise<SendMailResult>;`**

Envia o e-mail. Deve lançar em caso de falha (SMTP indisponível, recusa
do provedor etc.) — o tratamento fica a cargo de quem chama.

## `src/infra/email/nodemailer.provider.ts`

**`export class NodemailerMailProvider implements IMailProvider {`**

Implementação de IMailProvider via SMTP (Nodemailer). Projetada para o Gmail
com App Password, mas funciona com qualquer SMTP. Quando a configuração está
incompleta, o provedor fica desabilitado (isEnabled = false) e nunca envia —
assim dev/testes rodam sem SMTP e sem enviar e-mails reais.

**`throw new Error("Provedor de e-mail não configurado (SMTP ausente).");`**

Salvaguarda: quem chama já deve checar isEnabled(), mas garantimos que
um provedor não configurado nunca tente abrir conexão SMTP.

## `src/infra/payment/gateway.ts`

**`export interface PagamentoEvento {`**

Evento de pagamento já traduzido para o domínio — o resto da aplicação nunca
vê o formato bruto do gateway. É aqui que o "fluxo interno" começa.

**`export interface PaymentGateway {`**

Abstração de gateway de pagamento. Novos provedores (Mercado Pago, Stripe,
Asaas, ...) implementam esta interface — o webhook service só depende dela.

**`verificarAssinatura(rawBody: Buffer, headers: IncomingHttpHeaders): boolean;`**

Valida a assinatura sobre o CORPO CRU (bytes exatos recebidos). Não lança:
retorna false quando inválida ou quando o segredo não está configurado.

**`export function assinarPayload(secret: string, rawBody: Buffer): string {`**

HMAC-SHA256 do corpo cru em hex. Exportado para os testes assinarem payloads
com o mesmo esquema que a verificação usa.

**`class PaymentGatewayHmac implements PaymentGateway {`**

Gateway baseado em HMAC. Provedores reais diferem só no header de assinatura
e no segredo — o esquema HMAC-SHA256 sobre o corpo cru é o denominador comum.

`não integrar gateway real`: parseEvento espera um payload canônico
`{ idReserva, providerEventId, evento, metodo? }`. `providerEventId` é a
identidade estável da entrega para idempotência, distinta dos bytes assinados.
Para um provedor real, é AQUI que se mapeia
o formato específico dele (ex.: Stripe `type`/`data.object`) — o resto da
aplicação não muda.

**`export const HEADER_ASSINATURA: Record<string, string> = {`**

Header de assinatura por provedor. Exportado para o simulador de sandbox
conseguir montar um webhook assinado usando exatamente o mesmo esquema que a
verificacao usa — nada de caminho paralelo.

**`export function construirGatewaysPagamento(): Map<string, PaymentGateway> {`**

Registro dos gateways suportados. Header de assinatura segue a convenção de
cada provedor; o segredo vem do env (gateway sem segredo rejeita tudo).

## `src/infra/payment/sandbox-audit.ts`

**`export class SandboxPaymentAudit {`**

Auditoria append-only do sandbox. O estorno é apenas uma simulação de fluxo:
nenhuma chamada de transferência, credencial financeira ou saldo é usada.

**`` await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identidade}, 0))`; ``**

O gateway aqui é o simulador determinístico do sandbox, sem chamada
externa. Manter o lock até a conclusão evita duas entregas paralelas
executarem a mesma chave idempotente.

**`return reserva?.statusPagamento !== "SUCESSO";`**

Recebimento normal já confirmado não deve virar estorno só porque o
mesmo webhook foi reenviado. Pagamento bloqueado/cancelado ainda não é
SUCESSO e precisa continuar na reconciliação sandbox.

**`` const identidade = `${providerNormalizado}:${providerEventId}`; ``**

A identidade vem do provedor (não dos bytes): reserializações assinadas
do mesmo evento continuam sendo a mesma entrega lógica.

## `src/infra/payment/sandbox.ts`

**`export const CARTAO_SANDBOX = {`**

Sandbox de pagamento.

Nenhum dinheiro é movimentado. O desfecho é decidido pelo BACKEND a partir
dos dados de teste enviados — como fazem os sandboxes reais (Stripe, Mercado
Pago), em que números de cartão específicos forçam aprovação ou recusa.

Isso é deliberado: o cliente informa os dados, nunca o resultado. Não existe
nenhum campo em que o frontend diga "aprovado".

**`export function decidirDesfechoSandbox(`**

Decide o desfecho do pagamento de teste.

- Cartão terminado em 0000 → FALHA
- Cartão terminado em 0001 → PROCESSANDO (fica pendente, sem confirmar)
- Qualquer outro cartão     → SUCESSO
- PIX / carteira digital    → SUCESSO (caminho feliz do sandbox)

Lança 400 quando o método exige cartão e ele não veio — validação de forma,
não de resultado.
