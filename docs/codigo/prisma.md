# Notas de implementação — Prisma (schema e scripts)

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `prisma/schema.prisma`

**`enum CategoriaVeiculo {`**

Categoria comercial do veículo (RF07/RF16). Atributo do modelo — o locador
classifica cada ModeloVeiculo e o locatário filtra por categoria. Taxonomia
fixa; categorias personalizadas por locador seriam uma tabela própria no
futuro, sem quebrar este enum.

**`enum MetodoPagamento {`**

Forma de pagamento escolhida para a reserva. Suporte de modelagem (RF11);
a integração financeira real fica a cargo de um gateway externo.

**`enum TipoCobranca {`**

Tipo de cobrança avulsa lançada sobre uma reserva. Multa de cancelamento
tardio (RN04) e multa por atraso na devolução (RN06). O tratamento financeiro
real (estorno/cobrança) é externo.

**`enum StatusGaragem {`**

Situação operacional da garagem (RF19). Soft delete: desativar = INATIVA,
preservando o histórico. Garagens não-ATIVA não entram em novas reservas.

**`enum StatusNotificacao {`**

Status do envio de uma notificação (ex.: relatório de reserva por e-mail).
PENDENTE  -> registro criado antes da tentativa de envio.
ENVIADA   -> provedor aceitou a mensagem.
FALHA     -> provedor recusou/indisponível (mensagemErro guarda o motivo).

**`enum StatusInteresse {`**

Ciclo de vida de uma inscrição de interesse em veículo (watchlist).
ATIVO      -> aguardando o veículo voltar a DISPONIVEL.
CANCELADO  -> encerrada pelo próprio locatário (opt-out).
NOTIFICADO -> encerrada automaticamente após notificação enviada com sucesso.

**`enum TipoAlertaVeiculo {`**

Tipos de alerta gerados pelo monitoramento da frota. Extensível: novas
regras (excesso de cancelamentos, baixa utilização, manutenções etc.)
entram como novos valores sem alterar a estrutura de alertas.

**`enum MotivoBloqueio {`**

Motivos pelos quais um locatário pode ser impedido de reservar. Extensível:
novos motivos (ex.: comportamento) entram aqui sem alterar a regra de negócio.

**`anonimizadoEm DateTime?`**

LGPD: quando preenchido, os dados pessoais desta conta foram anonimizados
(direito ao esquecimento). A linha é mantida para preservar o histórico
de negócio (reservas etc.); só o PII é apagado.

**`enum TipoEventoFinanceiroSandbox {`**

Eventos financeiros exclusivamente do sandbox. São append-only: cada etapa
observável é uma linha, sem representar transferência de dinheiro real.

**`model RecuperacaoSenha {`**

Token temporário de recuperação de senha. O valor bruto nunca é persistido:
tokenHash guarda somente SHA-256 do token enviado pelo provider de e-mail.

**`enum CanalNotificacao {`**

Canais de entrega de notificação. Preparado para múltiplos meios; hoje só
EMAIL tem provedor real — PUSH/SMS são modelagem (como MetodoPagamento).

**`model PreferenciaNotificacao {`**

Preferência de notificação por conta: opt-in/opt-out de um (canal, tipo).
Ausência de linha = habilitado por padrão (opt-in). Opt-out = linha com
habilitado=false.

**`rg  String`**

Documento de identidade (RG). Não é @unique: números de RG podem se repetir
entre unidades federativas, então a unicidade fica a cargo de CPF/CNH.

**`dataNascimento DateTime @db.Date`**

Data de nascimento do locatário. Usada para validar a maioridade (>= 18)
no cadastro; armazenada como data (sem componente de fuso relevante).

**`valorDiaria  Decimal   @db.Decimal(10, 2)`**

Valor da diária. É a FONTE DE VERDADE do preço: o valorTotal da reserva é
calculado pelo backend a partir daqui, nunca aceito do cliente.

**`status StatusGaragem @default(ATIVA)`**

Situação operacional (RF19). Soft delete = INATIVA. Garagens não-ATIVA
não aparecem para novas reservas.

**`idGaragemRetirada String?  @db.Uuid`**

Local de retirada: garagem onde o veículo está hospedado no momento da
criação da reserva. Local de devolução: garagem (do mesmo locador dono do
veículo) escolhida pelo locatário para devolver o veículo ao final.

**`metodoPagamento MetodoPagamento?`**

Forma de pagamento (RF11). Nula até o locatário escolher/confirmar; passa a
ser obrigatória na confirmação do pagamento (regra no ReservaService).

**`codigoDesbloqueio String?   @unique`**

Código de desbloqueio do veículo (formato XXXX-XXXX), gerado quando o
pagamento é confirmado (statusPagamento = SUCESSO). Janela de uso:
a partir de dataHoraInicio até min(dataHoraInicio + 2 dias, dataHoraFim).

**`devolvidoEm DateTime?`**

RN06: instante da devolução real do veículo. Nulo até a devolução; a partir
daí a reserva fica REALIZADA. Se > dataHoraFim, gera multa de atraso.

**`expiradaEm DateTime?`**

Task 10 (D10-03/D10-04): preenchido quando a reserva AGUARDANDO_PAGAMENTO
passa do prazo de pagamento (15 min) sem confirmação e é encerrada como
CANCELADA automaticamente. Distingue a expiração do cancelamento voluntário.

**`model CompartilhamentoReserva {`**

Compartilhamento público de uma reserva (RF13-B). O token é aleatório,
revogável e separado do ID interno da Reserva.

**`model CobrancaReserva {`**

Cobrança avulsa registrada sobre uma reserva (RN04): multa de cancelamento
tardio. Trilha financeira aditiva — o estorno/cobrança efetiva é externo.
Cancelamento dentro do prazo grava uma linha com valor = 0 (trilha completa).

**`model NotificacaoReserva {`**

Registro/auditoria dos envios de notificação de uma reserva (ex.: relatório
enviado por e-mail na confirmação do pagamento). Desacoplada da regra de
negócio: a falha no envio não impacta a reserva — apenas fica registrada aqui.
Guarda um snapshot do destinatário/assunto para auditoria posterior.

**`canal        String @default("EMAIL")`**

Canal de envio. Hoje só EMAIL; deixado como String para permitir SMS/push
no futuro sem alterar o schema.

**`model ServicoOpcional {`**

Catálogo de serviços opcionais (ex.: Seguro adicional, Tanque cheio).
Extensível: novos serviços entram como registros, sem alterar a Reserva.

**`ativo Boolean @default(true)`**

Serviço fora do catálogo deixa de poder ser contratado, mas o histórico
de quem já contratou é preservado (ver ReservaServico.valor — snapshot).

**`model ReservaServico {`**

Tabela intermediária N:N entre Reserva e ServicoOpcional. Guarda o valor
contratado como snapshot — assim, reajustes futuros no catálogo não alteram
o valor já cobrado em reservas existentes.

**`model Favorito {`**

Favorito: relacionamento N:N entre Locatario e Veiculo. Entidade própria
(não array de IDs) com PK surrogate — preparada para evoluir com novos
atributos (ordenação personalizada, categorias, listas, notificações de
disponibilidade) sem alterar Locatario/Veiculo. criadoEm já registra a data
em que o veículo foi favoritado.

**`@@unique([idLocatario, idVeiculo])`**

Um locatário não pode favoritar o mesmo veículo duas vezes. O índice
composto também acelera a listagem/verificação de favoritos por locatário.

**`model InteresseVeiculo {`**

Inscrição de interesse em veículo (watchlist de disponibilidade). Entidade
própria, desacoplada de Reserva e de Favorito: o locatário faz opt-in para
ser notificado quando o veículo voltar a DISPONIVEL.

Unicidade: o par (idLocatario, idVeiculo) é @@unique — garante no banco que
não existam duas inscrições para o mesmo par. Reinscrição após cancelamento/
notificação REATIVA a linha existente (status volta a ATIVO e optInEm é
renovado); o histórico de envios fica preservado em NotificacaoInteresse.

**`optInEm DateTime @default(now())`**

Consentimento explícito (opt-in) para receber notificações. Renovado a
cada reativação da inscrição.

**`model NotificacaoInteresse {`**

Registro/auditoria dos envios de notificação de disponibilidade (uma linha
por tentativa). Espelha NotificacaoReserva: snapshot de destinatário/assunto,
canal extensível (EMAIL hoje; push/SMS/WhatsApp no futuro) e status reusando
o enum StatusNotificacao. A falha no envio não afeta a inscrição — apenas
fica registrada aqui.

**`model VeiculoStatusHistorico {`**

Histórico de transições de status do veículo. Registrado a cada mudança de
status (VeiculoService.update); a migration faz backfill do estado atual da
frota. A linha mais recente de um veículo indica DESDE QUANDO ele está no
status atual — base da regra de inatividade do monitoramento. Imutável
(append-only), o que também habilita regras futuras (ex.: excesso de
manutenções) sem novos campos no Veiculo.

**`enum EntidadeAuditada {`**

Alerta de monitoramento da frota, gerado pela rotina periódica. Auditável:
guarda o indicador no momento da geração (descricao), o snapshot do
destinatário/assunto e o resultado do envio (reusa StatusNotificacao).

Deduplicação: um alerta é "ativo" enquanto resolvidoEm IS NULL. A rotina não
gera novo alerta do mesmo tipo para o mesmo veículo enquanto houver um ativo;
quando a condição deixa de valer, o alerta é resolvido automaticamente —
permitindo novo alerta se o problema reincidir.
RN09: trilha de auditoria de negócio (append-only) das alterações feitas por
Locadores (e ADMIN) em veículos e reservas. Sem FK de propósito: o registro
sobrevive à exclusão/anonimização dos envolvidos. `antes`/`depois` guardam só
os campos operacionais que mudaram — nunca PII, senha, token ou cartão.

**`descricao String`**

Resumo humano do indicador no momento da geração
(ex.: "Inativo há 9 dias", "Média 2.3 em 5 avaliações").

**`tentativas   Int               @default(0)`**

Nº de tentativas de envio. A rotina para de retransmitir (dead-letter)
ao atingir o teto, evitando reprocessar indefinidamente falhas de SMTP.

**`model CondutorAdicional {`**

Condutor adicional de uma reserva (RF12): pessoa autorizada a dirigir o
veículo além do locatário titular. Entidade própria (1:N com Reserva),
escalável — novos atributos (validade da CNH, categoria, etc.) entram aqui
sem alterar a Reserva. A unicidade (idReserva, cnh) impede duplicidade do
mesmo condutor na mesma reserva.

**`latitude  Decimal @db.Decimal(10, 8)`**

latitude  ∈ [-90, 90]   -> 2 dígitos inteiros cabem em Decimal(10, 8)
longitude ∈ [-180, 180] -> 3 dígitos inteiros exigem Decimal(11, 8)

**`model BloqueioLocatario {`**

Bloqueio de um locatário. Entidade própria, desacoplada de Reserva e
Pagamento: a criação/confirmação de reservas apenas consulta esta tabela.
O histórico é preservado — bloqueios não são removidos, apenas revogados
(revogadoEm) ou expirados (expiraEm). Um bloqueio é "ativo/impeditivo"
quando revogadoEm IS NULL e (expiraEm IS NULL OU expiraEm > agora).

**`@@index([idLocatario, revogadoEm, expiraEm])`**

Acelera a verificação de bloqueio ativo por locatário (consulta crítica
executada a cada criação/confirmação de reserva).

## `prisma/scripts/seed-demo.ts`

**`import "dotenv/config";`**

Dados FICTÍCIOS de demonstração do TCC para o banco mova_dev.

`npm run db:seed:demo -- --confirmar`

DESTRUTIVO: apaga todas as tabelas de mova_dev (exceto _prisma_migrations)
antes de popular. Por isso só roda com --confirmar, NODE_ENV=development e
conexão efetiva em mova_dev. Nenhum outro script o chama.

Imagens: usa o serviço real de mídia (MinIO local). Sem credenciais em
MEDIA_S3_ACCESS_KEY_ID/SECRET, tenta lê-las do container MinIO local; se não
conseguir, segue sem imagens (o catálogo mostra o fallback "sem foto").

**`const POSICAO_CENTRO = { latitude: -25.4296, longitude: -49.2713 };`**

Última posição conhecida (GPS simulado) perto de cada garagem. Com o simulador
desligado (padrão do start-mova.ps1) a posição fica fixa e o geofence do
desbloqueio (RN03, raio de 100 m) é reproduzível na demonstração.

## `prisma/scripts/seed.ts`

**`const servicosOpcionais = [`**

Catálogo inicial de serviços opcionais. Novos serviços (cadeirinha, motorista
adicional, etc.) entram aqui como novos registros, sem alterar a Reserva.

**`await tx.cobrancaReserva.deleteMany();`**

Mesma ordem de test/setup.ts: cobranças e eventos financeiros da
sandbox (Task 7) e tabelas filhas de Reserva/Conta vêm antes.

**`const modelosDoLocador = [] as typeof modelos;`**

3 modelos deste locador — ano distinto garante a unicidade
[idLocador, marca, modelo, ano] mesmo com marca/modelo repetidos
