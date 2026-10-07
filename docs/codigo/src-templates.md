# Notas de implementação — src/templates

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/templates/alerta-veiculo.template.ts`

**`const escapeHtml = (value: string): string =>`**

Templates dos alertas de monitoramento da frota. Funções puras: recebem o
payload e devolvem o conteúdo (assunto + HTML + texto). Mantidos fora dos
services para que o HTML não seja concatenado dentro da regra de negócio.

## `src/templates/reserva-report.template.ts`

**`interface Strings {`**

Template do relatório de reserva. Função pura: recebe o payload + idioma e
devolve o conteúdo (assunto + HTML + texto). Mantido fora dos services para
que o HTML não seja concatenado dentro da regra de negócio. Para adicionar
PDF no futuro, basta um novo módulo que consuma o mesmo payload.

i18n: só o texto voltado ao usuário é traduzido (pt/en/es). Os DADOS (marca,
status, nomes, categoria) não são traduzidos — regra de negócio permanece.

HTML de e-mail: layout 100% baseado em tabelas + CSS inline, largura fixa de
600px, sem flexbox/grid/JS/webfonts/CDN. Assim renderiza de forma consistente
em Gmail (web/mobile), Outlook (Word engine) e Apple Mail; quando um cliente
ignora uma propriedade CSS, o conteúdo continua legível na ordem natural.

**`const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {`**

Rótulos de exibição de DADOS (não traduzidos — regra de negócio). Mapa único
por enum; a UI ao redor é que muda de idioma.

**`const C = {`**

Paleta (mobilidade/tecnologia): fundo neutro, container branco, azul primário
e verde de sucesso. Cores em hex para máxima compatibilidade.

**`const timeZone = env.TIMEZONE_EXIBICAO;`**

Fuso FIXO de exibição. Sem isto o formatador usaria o fuso do processo, e o
mesmo instante sairia com horas diferentes em máquinas diferentes (local
America/Sao_Paulo vs. CI em UTC). Ver auditoria/DATAS-HORARIOS.md.

**`const formatDia = (d: Date) => {`**

"01 AGO 2026" — via formatToParts para evitar separadores de locale
(pt-BR insere "de": "01 de ago. de 2026"). Junta dia/mês/ano manualmente.

**`const local = (rotulo: string, cor: string, garagem: string | null, endereco: string | ...`**

Retirada/devolução (garagem + endereço). Colunas empilham no mobile porque
são &lt;td> em uma tabela de 600px — em telas estreitas o cliente reflui.

## `src/templates/veiculo-disponivel.template.ts`

**`const escapeHtml = (value: string): string =>`**

Template da notificação de veículo disponível. Função pura: recebe o payload
e devolve o conteúdo (assunto + HTML + texto). Mantido fora dos services para
que o HTML não seja concatenado dentro da regra de negócio. Novos canais
(push/SMS/WhatsApp) consomem o mesmo VeiculoDisponivelPayload em outros
módulos — sem tocar no dispatcher.
