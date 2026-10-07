# Notas de implementação — src/repositories

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/repositories/avaliacao-relatorio.repository.ts`

**`export interface IAvaliacaoRelatorioRepository {`**

Consultas analíticas de avaliações, sempre agregadas no banco. Todas recebem
o mesmo conjunto de filtros (com idLocador obrigatório) para garantir o
isolamento por locador em qualquer consulta.

**`aggregatePorVeiculo(`**

Agregado por veículo (count/avg/min/max), ordenado pela maior média. O
ranking de mais avaliados é derivado destas mesmas linhas no service.

## `src/repositories/bloqueio.repository.ts`

**`findBloqueioAtivo(`**

Primeiro bloqueio impeditivo (ativo) do locatário, ou null. Consulta
otimizada (findFirst) usada na criação/confirmação de reservas — não
carrega o histórico completo.

## `src/repositories/contracts/avaliacao-relatorio.contract.ts`

**`export type Granularidade = "dia" | "mes" | "ano";`**

Nível de agregação da evolução temporal. Mapeado para o unit do date_trunc
do Postgres no repositório (dia -> day, mes -> month, ano -> year).

**`export interface AvaliacaoRelatorioFilters {`**

Filtros aplicados a TODAS as consultas do relatório. idLocador é sempre
derivado do usuário autenticado (nunca do cliente) — garante o isolamento.

**`export interface ResumoGeral {`**

Resumo geral (Prisma aggregate). media/maior/menor são null quando não há
avaliações no recorte.

**`export interface DistribuicaoNota {`**

Uma faixa de nota e quantas avaliações a receberam. Como a nota é
Decimal(2,1), a distribuição é por valor distinto de nota (ex.: 4, 4.5, 5).

**`export interface AgregadoVeiculoRow {`**

Linha agregada por veículo (retornada pelo groupBy via SQL, já com os campos
de exibição resolvidos no mesmo JOIN — sem N+1). O service reusa estas linhas
tanto para "média por veículo" quanto para o "ranking mais avaliados".

**`export interface RelatorioVeiculo {`**

Dados do veículo expostos nos relatórios (subconjunto de VeiculoResponse,
suficiente para rótulos/gráficos no frontend).

## `src/repositories/contracts/condutor.contract.ts`

**`export interface ReservaBloqueadaParaCondutor {`**

Campos lidos da Reserva pela transação que protege RN02. A reserva já está
bloqueada por SELECT ... FOR UPDATE quando este valor chega ao service.

## `src/repositories/contracts/conta.contract.ts`

**`export interface PerfilCadastro {`**

Task 10 (M-05): perfil criado na mesma transação da Conta. O id do perfil é
sempre o id da Conta recém-criada, nunca um valor enviado pelo cliente.

## `src/repositories/contracts/favorito.contract.ts`

**`export interface FavoritoVeiculoResponse extends VeiculoResponse {`**

Veículo como retornado na listagem de favoritos: mesmo shape das demais
listagens (VeiculoResponse, com modeloVeiculo) + locador e garagem atual.

## `src/repositories/contracts/interesse.contract.ts`

**`export interface InteresseVeiculoDetalheResponse extends VeiculoResponse {`**

Veículo como retornado na listagem de interesses: mesmo shape das demais
listagens (VeiculoResponse, com modeloVeiculo) + locador e garagem atual.

**`export interface InteresseVeiculoDescobertaResponse {`**

Shape público mínimo para descoberta de veículos que podem voltar a ficar
disponíveis. Não expõe placa, idLocador ou outros dados administrativos.

**`export interface InteressadoResponse {`**

Inscrição ativa + destinatário resolvido em uma única consulta (JOIN com
Locatario -> Conta), usada pelo disparo automático. Evita N+1 ao notificar.

## `src/repositories/contracts/locador-dashboard.contract.ts`

**`export interface RelatorioReservaItem {`**

DTOs do dashboard do locador (RF17/RF18). Todos os dados são escopados aos
veículos do locador autenticado (idLocador vem do token).

**`faturamentoBruto: number;`**

Considera pagamentos confirmados de reservas não canceladas; cobranças
avulsas não são somadas novamente para evitar double count.

## `src/repositories/contracts/localizacao.contract.ts`

**`export interface CreateLocalizacaoRequest {`**

Registro de um novo ponto de localização de um veículo.
dataHora é opcional: quando omitido, o banco usa @default(now()).

## `src/repositories/contracts/monitoramento.contract.ts`

**`export interface VeiculoInativoRow {`**

Linha retornada pela consulta de veículos inativos: veículo + modelo +
locador (com a conta p/ destino do e-mail) resolvidos em uma única query.

**`inativoDesde: Date;`**

Desde quando o veículo está INATIVO (última transição de status; fallback
para a criação do veículo quando não há histórico).

**`export interface CriterioBaixaAvaliacao {`**

Critério da regra de baixa avaliação. Um veículo é candidato quando, dentro
da janela (desde):
(quantidade >= minAvaliacoes E media &lt; mediaMinima)  OU
(quantidadeNotasBaixas >= minNotasBaixas)
minAvaliacoes evita alertas baseados em uma única avaliação isolada.

## `src/repositories/contracts/notificacao-interesse.contract.ts`

**`export interface RegistrarNotificacaoInteresseRequest {`**

Dados mínimos para registrar uma tentativa de notificação de disponibilidade
(status inicial PENDENTE). O status final é definido depois via
marcarEnviada/marcarFalha.

## `src/repositories/contracts/notificacao.contract.ts`

**`export interface RegistrarNotificacaoRequest {`**

Dados mínimos para registrar uma tentativa de notificação (status inicial
PENDENTE). O status final é definido depois via marcarEnviada/marcarFalha.

## `src/repositories/contracts/reserva.contract.ts`

**`export interface ReservaServicoInput {`**

Serviço opcional já resolvido (id + valor snapshot), pronto para persistir.
Preenchido pelo ReservaService após validar os IDs contra o catálogo.

**`deficienciaId?: string;`**

Deficiência informada durante a reserva (para veículos adaptados, quando o
locatário ainda não possui uma cadastrada). Não é persistida na Reserva.

**`valorTotal: number;`**

valorTotal é CALCULADO pelo ReservaService (diária × diárias + serviços).
Nunca chega do cliente.

**`servicos?: ReservaServicoInput[];`**

Serviços resolvidos (id + valor snapshot) — preenchido pelo service e
consumido pelo repositório para criar as associações.

**`deficienciaIdParaAssociar?: string;`**

RN01: deficiência a associar ao locatário na MESMA transação da criação
(veículo PCD sem deficiência já cadastrada). undefined = nada a associar.

**`export type CreateReservaInput = Omit<`**

O que o CLIENTE pode enviar ao criar uma reserva. Não inclui valorTotal
(calculado pelo ReservaService a partir da diária do modelo) nem os campos
internos preenchidos pelo próprio service antes de chegar ao repositório.

**`export interface ReservaGaragemResponse {`**

Dados necessários para identificar os locais da jornada sem exigir uma
consulta por reserva no frontend.

**`veiculo: VeiculoResponse;`**

Veículo da reserva, já com o modelo aninhado. Mesmo formato de
GET /api/veiculo/:id — o cliente reaproveita a normalização.

**`export type ReservaVeiculoResponse = Omit<ReservaResponse, "codigoDesbloqueio">;`**

Projeção usada em consultas de gestão da frota. O código de desbloqueio é
uma credencial do locatário e não faz parte do contrato de leitura do
locador/admin por veículo.

## `src/repositories/contracts/veiculo.contract.ts`

**`modelo?: UpdateModeloVeiculoRequest;`**

Atualização coordenada do catálogo associada ao veículo. O bloco é
explícito para não confundir campos da instância com os do modelo.

## `src/repositories/interesse.repository.ts`

**`reativar(id: string): Promise<InteresseResponse>;`**

Reativa uma inscrição encerrada (CANCELADO/NOTIFICADO): status volta a
ATIVO e o opt-in é renovado. O par (locatário, veículo) é @@unique — a
reinscrição reutiliza a mesma linha.

**`findAtivosByVeiculo(idVeiculo: string): Promise<InteressadoResponse[]>;`**

Interessados a notificar quando o veículo volta a DISPONIVEL: apenas
inscrições ATIVAS, com o destinatário (nome/e-mail) já resolvido.

## `src/repositories/lgpd.repository.ts`

**`export interface DadosPessoaisExport {`**

Snapshot dos dados pessoais de um titular (portabilidade LGPD). Só campos
pessoais + registros vinculados; nunca senhaHash.

**`anonimizarConta(idConta: string): Promise<boolean>;`**

Anonimiza PII da conta e do perfil (locatário/locador), mantendo as linhas
e o histórico de negócio. Idempotente. Retorna false se a conta não existe.

## `src/repositories/mappers/reserva.mapper.ts`

**`export type ReservaComServicos = Reserva & {`**

Reserva carregada com a junção de serviços (servicos -> servico do catálogo)
e com o veículo + modelo, conforme RESERVA_INCLUDE.

**`static toLocadorResponse(`**

Projeção para respostas HTTP de gestão do locador. O objeto já foi
carregado por outro caso de uso, mas o contrato de saída continua sem a
credencial de desbloqueio.

## `src/repositories/monitoramento.repository.ts`

**`export interface IVeiculoStatusRecorder {`**

Contrato mínimo usado pelo VeiculoService para registrar transições de
status sem depender do repositório de monitoramento completo.

**`resolver(id: string, resolvidoEm: Date): Promise<AlertaVeiculoResponse>;`**

Encerra o alerta (condição deixou de valer) — permite novo alerta em
reincidência futura.

## `src/repositories/preferencia-notificacao.repository.ts`

**`export interface IPreferenciaChecker {`**

Consulta usada pelos notificadores para respeitar o opt-out. Interface enxuta
para que os notificadores dependam só disto (não do repositório inteiro).

## `src/repositories/prisma/auditoria.ts`

**`export interface AtorAuditoria {`**

RN09 — trilha de auditoria de negócio (não é log técnico).

O ator vem SEMPRE do usuário autenticado (req.user → requester), nunca do
body. O registro é gravado com o mesmo `tx` da alteração: ou os dois são
persistidos, ou nenhum. Snapshots guardam só campos operacionais (status,
garagem, placa, atributos do modelo, período/valores da reserva) e, deles,
apenas o que mudou — nada de PII, senha, token ou dados de cartão.

## `src/repositories/prisma/expiracao-reserva.ts`

**`export const reservaVencidaWhere = (agora: Date = new Date()): Prisma.ReservaWhereInput...`**

Task 10 (D10-03/D10-04): fonte única de "reserva vencida". Reserva
AGUARDANDO_PAGAMENTO sem pagamento aprovado, criada há 15 min ou mais. Toda
regra de disponibilidade exclui este conjunto, mesmo antes de ele ser
gravado como expirado (expiração preguiçosa).

**`export async function expirarReservaNoTx(`**

Expira UMA reserva dentro da transação de quem já detém o lock da reserva
(pg_advisory_xact_lock(hashtextextended(id))). A condição repete o critério
de vencimento: um pagamento aprovado antes (SUCESSO já gravado) vence a
corrida e a reserva não é tocada. Não apaga nada e não gera multa.

**`export async function expirarReservasVencidas(`**

Expiração preguiçosa: chamada antes de leituras e operações que dependem do
estado da reserva. Uma transação curta por reserva, com o mesmo lock usado
por pagamento e cancelamento. Idempotente: rodar de novo não muda nada.
ponytail: sem job/fila; a quantidade de vencidas por chamada é pequena.

## `src/repositories/prisma/prisma.avaliacao-relatorio.repository.ts`

**`const UNIT_POR_GRANULARIDADE: Record<Granularidade, string> = {`**

Mapeia a granularidade da API para o unit textual do date_trunc do Postgres.
Passado como parâmetro ($) — date_trunc aceita o unit como texto, então não
há interpolação de string na query.

**`private buildWhere(`**

Filtro para as consultas nativas do Prisma (aggregate/groupBy/findMany).
Percorre Avaliacao -> Reserva -> Veiculo para chegar ao locador.

**`private buildSqlWhere(filters: AvaliacaoRelatorioFilters): Prisma.Sql {`**

Mesmas condições, como fragmento SQL, para as consultas com JOIN manual
(agregação por veículo e evolução temporal). Aliases: a=Avaliacao,
r=Reserva, v=Veiculo.

**`const rows = await prisma.$queryRaw<`**

COUNT como int e AVG/MIN/MAX como float => o driver devolve number puro,
sem BigInt/Decimal para converter. O JOIN com ModeloVeiculo resolve os
campos de exibição na mesma consulta (evita segunda query / N+1).

## `src/repositories/prisma/prisma.avaliacao.repository.ts`

**`if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {`**

A regra de service cobre a repetição normal. A constraint única também
protege duas requisições simultâneas para a mesma reserva.

## `src/repositories/prisma/prisma.conta.repository.ts`

**`async create(data: CreateContaRequest, perfil: PerfilCadastro = {}): Promise<ContaRespo...`**

Task 10 (M-05): Conta e perfil numa única transação. Se o perfil falhar
(CPF/CNH/CNPJ duplicado, FK de deficiência, qualquer erro), a Conta é
desfeita junto: não existe Conta órfã nem perfil sem Conta.

**`return prisma.$transaction(async (tx) => {`**

A criação de reserva obtém esta mesma trava para locatário e locador.
Entre checar o histórico e apagar a conta não cabe uma nova reserva.

## `src/repositories/prisma/prisma.favorito.repository.ts`

**`const FAVORITO_INCLUDE = {`**

Carrega o veículo com modelo, locador e garagem atual em uma única consulta
(evita N+1 ao montar a resposta da listagem).

**`const where: Prisma.FavoritoWhereInput = {`**

RN08: veículo soft-deleted (INATIVO) sai da lista de favoritos — a linha
de favorito é preservada, mas não expõe um veículo removido do catálogo.

## `src/repositories/prisma/prisma.garagem.repository.ts`

**`if (filters.comVagasDisponiveis) {`**

comVagasDisponiveis compara duas colunas (veiculosAlocados &lt; capacidade),
o que o Prisma não expressa no `where`; nesse caso filtra/pagina em memória.

**`await assertGarageCapacityUpdate(tx, id, data.capacidade);`**

Toda edição serializa com alocações/movimentações na mesma linha da
garagem. Assim uma troca para MANUTENCAO/INATIVA não corre em
paralelo com uma alocação que ainda enxerga o status anterior.

**`async delete(id: string): Promise<void> {`**

Soft delete (RF19): desativa a garagem em vez de removê-la, preservando o
histórico (veículos alocados, reservas passadas). Garagem INATIVA não
aparece para novas reservas (regra no ReservaService).

## `src/repositories/prisma/prisma.interesse.repository.ts`

**`const INTERESSE_INCLUDE = {`**

Carrega o veículo com modelo, locador e garagem atual em uma única consulta
(evita N+1 ao montar a resposta da listagem).

**`const interessados = await prisma.interesseVeiculo.findMany({`**

Usa o índice composto (idVeiculo, status) e resolve o destinatário
(Locatario -> Conta) no mesmo round-trip — sem N+1 no disparo.

## `src/repositories/prisma/prisma.lgpd.repository.ts`

**`const tag = idConta;`**

Token estável e único por conta para satisfazer os @unique (email/cpf/
cnh/cnpj) sem colidir com contas reais.

**`prisma.notificacaoReserva.updateMany({`**

Task 11 (RNF05): resíduos de PII fora das tabelas de perfil. Os
snapshots de destinatário das notificações guardavam o e-mail real; os
condutores adicionais são terceiros informados pelo titular (nome, CPF,
CNH) e deixam de ter finalidade quando ele se anonimiza.

**`prisma.condutorAdicional.deleteMany({`**

Reservas em curso/confirmadas mantem os condutores (quem pode dirigir o
veiculo que esta na rua); as encerradas perdem o PII de terceiros.

## `src/repositories/prisma/prisma.locador.repository.ts`

**`id: data.id!,`**

LocadorService resolve o ID pelo JWT (ou pelo ADMIN) antes de chegar
ao repositório.

## `src/repositories/prisma/prisma.monitoramento.repository.ts`

**`` return prisma.$queryRaw<VeiculoInativoRow[]>(Prisma.sql` ``**

A última transição de status de um veículo indica desde quando ele está
no status atual. LEFT JOIN LATERAL pega apenas essa linha (usa o índice
(idVeiculo, criadoEm)); COALESCE cai para a criação do veículo quando
ainda não há histórico. Modelo, locador e conta (destinatário do e-mail)
são resolvidos na mesma consulta — sem N+1.

**`` return prisma.$queryRaw<VeiculoBaixaAvaliacaoRow[]>(Prisma.sql` ``**

Agregação inteira no banco (COUNT/AVG/FILTER + HAVING): nenhuma
avaliação é carregada em memória. COUNT::int e AVG::float fazem o driver
devolver number puro (sem BigInt/Decimal) — mesmo padrão do relatório de
avaliações.

## `src/repositories/prisma/prisma.recuperacao-senha.repository.ts`

**`` await tx.$executeRaw` ``**

Serializa solicitações simultâneas para a mesma conta: o último token
criado é o único que permanece ativo.

**`const consumido = await tx.recuperacaoSenha.updateMany({`**

A condição repetida no update torna o claim atômico: em uma corrida,
exatamente uma transação consegue marcar usadoEm.

## `src/repositories/prisma/prisma.reserva.repository.ts`

**`const RESERVA_INCLUDE = {`**

Carrega os serviços contratados junto com o serviço do catálogo, em uma
única consulta (evita N+1 ao montar a resposta).

**`veiculo: { include: { modeloVeiculo: true, garagem: { select: { id: true, nome: true, s...`**

O cliente precisa identificar o veículo da reserva (marca/modelo/placa)
sem uma segunda chamada por item de lista.

**`const RESERVA_VEICULO_SELECT = {`**

Projeção específica da listagem por veículo. A credencial de desbloqueio
não sai da query desse caso de uso; os fluxos do locatário continuam usando
RESERVA_INCLUDE para obter o código quando isso é necessário para RF15.

**`private overlapWhere(`**

Colisão clássica de intervalos para um veículo: inicio_existente &lt; fim_novo
e fim_existente > inicio_novo. Reservas canceladas não bloqueiam. Extraído
para que a checagem otimista (hasOverlapForVeiculo) e a recheca sob lock
(create) usem exatamente a mesma regra. Task 10: reserva não paga com o
prazo de 15 min vencido também não bloqueia, mesmo antes de ser gravada
como expirada.

**`return prisma.$transaction(async (tx) => {`**

Transação + advisory lock por veículo elimina a race de double-booking:
a checagem otimista no service roda antes das validações, mas duas
requisições concorrentes para o mesmo veículo/período poderiam ambas
passar e inserir. Aqui serializamos por veículo (lock liberado no fim da
transação) e recheсamos o overlap antes do insert — a última palavra.

**`const veiculoAtual = await tx.veiculo.findUnique({`**

A movimentação de garagem usa a mesma chave de advisory lock. Assim,
o snapshot de retirada não pode ser calculado antes de uma mudança e
gravado depois dela: quem perdeu a corrida revisa a reserva.

**`for (const idConta of [...new Set([data.idLocatario, veiculoAtual.idLocador])].sort()) {`**

Exclusão e criação disputam as mesmas chaves de conta. A ordem
canônica evita deadlock entre locatário e locador; a releitura cobre
uma exclusão que tenha vencido antes desta transação obter a trava.

**`const locatarioAtual = await tx.locatario.findUnique({`**

PrismaPg executa uma transação em uma conexão. Consultas paralelas
nela acionam `pg` com uma query ainda em curso e tornam a suíte
intermitente. Preserve a releitura, mas serialize as consultas.

**`if (data.deficienciaIdParaAssociar) {`**

RN01: associa a deficiência ao perfil do locatário na MESMA transação.
Se o create abaixo falhar, esta escrita é revertida (sem efeito órfão).

**`metodoPagamento: data.metodoPagamento ?? undefined,`**

status e statusPagamento usam sempre o default do schema
(AGUARDANDO_PAGAMENTO): não são entrada do cliente.

**`...(data.servicos && data.servicos.length > 0`**

Cria as associações de serviços opcionais na mesma operação,
gravando o valor contratado como snapshot.

**`if (data.idGaragemDevolucao) {`**

Task 10.1: a garagem de devolução nova é validada no service fora da
transação; aqui ela é relida sob FOR SHARE (ordem: reserva → veículo →
garagem) para não correr com a indisponibilização dessa garagem.

**`where: { id, status: { not: StatusReserva.CANCELADA } },`**

Campos de domínio ficam fora desta operação pública; apenas uma
reserva não cancelada pode alterar os dados editáveis.

**`if (await expirarReservaNoTx(tx, id, new Date())) {`**

D10-05: evento que chega depois do prazo (webhook tardio) encontra a
reserva expirada sob o mesmo lock e não a confirma. Quem chamou recebe
a reserva CANCELADA e trata como pagamento de reserva cancelada.

**`let recusa: HttpError | null = null;`**

Task 10.1 (D10.1-01/06): aprovação só vale com veículo e garagens
operacionais, verificados sob os mesmos locks de quem os altera. Se
não estiverem, a tentativa vira FALHA (nada confirmado) e o erro sobe
depois do commit; o webhook estorna o valor no sandbox.

**`const tentativaAtual = await tx.cobrancaReserva.findFirst({`**

O desfecho pertence à tentativa mais recente. Tentativas anteriores
(recusadas/expiradas) mantêm o próprio status: uma aprovação nova não
pode transformar um FALHA antigo em segunda cobrança confirmada.

**`try {`**

Cobrança + transição em uma transação: ou registra a multa E cancela, ou
nada. Grava a cobrança mesmo com valor 0 (trilha completa — RN04).

**`statusPagamento: multa > 0 && estadoAtual.statusPagamento !== StatusPagamento.SUCESSO`**

Reserva já paga: a multa é retida do estorno (PagamentoEstornoService),
então nasce quitada — senão seria cobrada duas vezes e ainda
bloquearia o locatário pela RN07.

**`return prisma.$transaction(async (tx) => {`**

Cobrança + mudança de estado na mesma transação: ou registra e marca
PROCESSANDO, ou não faz nem uma coisa nem outra.

**`const recusa = await verificarReservaOperacional(tx, atual);`**

Task 10.1 (D10.1-02): veículo/garagens indisponíveis → 409 antes de
existir qualquer cobrança. Fica ANTES de escrever na reserva: a ordem
de locks é reserva (advisory) → veículo → garagens → linhas de reserva;
travar a linha da reserva antes do veículo causaria deadlock com a
troca de status do veículo (que trava veículo → linhas de reserva).

**`NOT: reservaVencidaWhere(),`**

D10-02/D10-03: nova tentativa só dentro do prazo da reserva; a
tentativa nunca sobrevive à reserva que ela paga.

**`data: { codigoUsadoEm: usadoEm, ...(status ? { status } : {}) },`**

codigoUsadoEm e status mudam na MESMA escrita: nunca existe reserva
com código usado que continue CONFIRMADA (nem o inverso).

## `src/repositories/prisma/prisma.veiculo.repository.ts`

**`const withModelo = {`**

A listagem do catálogo precisa identificar a garagem efetiva do veículo.
Selecionar esses campos na mesma query evita GET /garagem/:id por card.

**`private async upsertModelo(`**

Upsert interno do modelo
Busca o modelo pelo unique [idLocador, marca, modelo, ano].
Se não existir, cria. Se existir, retorna o existente sem alterar.

**`garagem: { status: StatusGaragem.ATIVA },`**

Catálogo reservável: só há oferta quando existe um ponto operacional
real e a garagem está ATIVA. Veículo em preparação sem garagem fica
visível apenas na frota privada do locador.

**`status: { in: [StatusVeiculo.RESERVADO, StatusVeiculo.MANUTENCAO] },`**

RESERVADO e MANUTENCAO são indisponíveis agora, mas podem voltar a
DISPONIVEL. INATIVO é desativação administrativa e não entra aqui.

**`if (data.garagemId !== undefined) {`**

Task 11: a movimentacao trava garagens -> linhas de reserva; a checagem de
compromisso trava linhas de reserva. Mover ANTES mantem a ordem global
(veiculo -> garagens -> reservas) tambem no PUT que muda status + garagem.

**`const atualizado = await tx.modeloVeiculo.upsert({`**

A identidade do catálogo é única por locador. Se ela mudou,
associa o veículo ao modelo correspondente; se não mudou, o
update explícito mantém a semântica de modelo compartilhado.

**`try {`**

RN08: soft delete — marca INATIVO (espelha garagem). Preserva histórico
(evita cascade destrutivo) e tira o veículo de buscas (filtro DISPONIVEL)
e de novas reservas (create rejeita status != DISPONIVEL).

**`if (atual.status === StatusVeiculo.INATIVO) return;`**

Task 11: exclusão lógica repetida é no-op — não grava um segundo
registro EXCLUSAO na auditoria (RN09 registra só o que mudou).

**`},`**

marca, modelo, ano intencionalmente fora — mudar isso
quebraria o @@unique e a identidade do modelo

## `src/repositories/prisma/vehicle-garage-allocation.ts`

**`` await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${veiculoId}, 0))`; ``**

Reserva.create usa esta mesma chave. Ela impede que uma reserva obtenha o
snapshot da garagem antes de uma movimentação e seja criada depois dela.

**`` const reservas = await tx.$queryRaw<LockedReservation[]>(Prisma.sql` ``**

O lock de todas as reservas do veículo serializa a decisão com confirmação,
desbloqueio e cancelamento, que atualizam a mesma linha de Reserva.

**`export async function assertSemCompromissoParaIndisponibilizar(`**

Compromisso válido com o locatário: reserva paga (CONFIRMADA, ou aprovada e
ainda gerando o código) que não terminou, ou em andamento. Não cancela nem
remaneja nada: recusa a mudança e o locador resolve a reserva antes.

**`await lockVehicleAllocation(tx, veiculoId);`**

Mesmo lock da criação de reserva + lock das linhas (padrão da alocação):
serializa com nova reserva e com confirmação de pagamento em curso.

**`export async function verificarReservaOperacional(`**

Task 10.1 (D10.1-01..06): o pagamento só pode ser aceito/confirmado se o
veículo e as garagens da reserva estiverem operacionais. Chamado sob o lock
da reserva; ordem de locks do projeto: reserva (advisory) → veículo
(advisory, o mesmo da criação de reserva e da troca de status) → garagens
(linha, FOR SHARE, por id). Quem indisponibiliza o veículo/garagem espera
estes locks e passa a ver a reserva paga como compromisso protegido.
Devolve o erro em vez de lançar: no webhook a tentativa é gravada como
FALHA na mesma transação antes de o erro subir.

**`export async function assertGaragemSemCompromissoParaIndisponibilizar(`**

Task 10.1 (D10.1-07/08, Bug B): garagem ainda necessária a uma reserva
confirmada não vai para MANUTENCAO/INATIVA. Necessidade FUTURA:
- retirada: reserva paga (CONFIRMADA, ou aprovada gerando o código) com fim
futuro — o veículo ainda vai sair dali;
- devolução (idGaragemDevolucao, ou a de retirada quando não informada):
a mesma reserva paga futura, ou EM_ANDAMENTO (o veículo ainda vai voltar,
inclusive com atraso).
EM_ANDAMENTO não protege a retirada (já aconteceu). REALIZADA, CANCELADA,
expirada e não paga não protegem. Locks: linha da garagem (FOR UPDATE) →
linhas de reserva (FOR UPDATE, por id), na transação da própria alteração.

**`for (const id of uniqueIds) {`**

Todas as operações que envolvem duas garagens usam a mesma ordem. Isso
evita deadlock quando duas movimentações opostas acontecem simultaneamente.

**`export async function reserveGarageCapacityForNewVehicles(`**

Reserva vagas para veículos que ainda serão criados na mesma transação.
O lock da linha da garagem torna o check de capacidade atômico.

**`export async function moveVehicleInTransaction(`**

Aloca, move ou desaloca um veículo. A linha do veículo e as linhas das
garagens envolvidas ficam bloqueadas na mesma transação; portanto o vínculo
e os contadores nunca passam por um estado parcialmente persistido.

**`if (veiculo.garagemId === destinoGaragemId) {`**

Repetir a mesma alocação é um no-op idempotente. Isso também permite
manter um veículo histórico numa garagem que foi desativada sem bloquear
uma operação que não muda o estado.

**`const garagens = await lockGarages(tx, [veiculo.garagemId, destinoGaragemId]);`**

Task 11: ordem global reserva → veículo → garagens (linha) → linhas de
reserva. As garagens vêm ANTES das linhas de reserva; a ordem inversa
formava ciclo com a indisponibilização de garagem (garagem → reservas) e
com a troca de garagem de devolução da reserva.

## `src/repositories/reserva.repository.ts`

**`registrarPagamentoIniciado(`**

Registra a cobrança da reserva e marca o pagamento como PROCESSANDO.
O valor vem da própria reserva — nunca do cliente.

**`marcarCodigoComoUsado(`**

Marca o código como usado (desbloqueio efetivado) e aplica o status da
transição (desbloqueio → EM_ANDAMENTO), na mesma escrita.

**`cancelar(id: string, multa: number, provider?: string, ator?: AtorAuditoria): Promise<R...`**

RN04: cancela a reserva de forma atômica — registra a cobrança de multa
(valor 0 quando dentro do prazo) e transiciona status para CANCELADA.

**`devolver(`**

RN06: registra a devolução — grava devolvidoEm, transiciona para REALIZADA
e, quando valorCobranca > 0, lança a cobrança de atraso (transacional).

## `src/repositories/servico-opcional.repository.ts`

**`findByIds(`**

Busca serviços por uma lista de IDs. Por padrão, apenas os ativos
(disponíveis para contratação) são retornados.
