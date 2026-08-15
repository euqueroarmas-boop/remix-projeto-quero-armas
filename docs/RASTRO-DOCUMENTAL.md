# Rastro documental — regra canônica

Definida em 2026-08-15. Vale para todo documento que entra ou tenta entrar no Hub
Documental, por qualquer caminho: portal do cliente, lançamento da equipe, Arsenal,
autoinsert e edge functions.

**Regra de leitura:** o repositório **não** é fonte da verdade deste projeto. Antes de
implementar qualquer item daqui, confirme a estrutura viva no banco (`pg_policies`,
`pg_proc`, `information_schema.columns`, `pg_constraint`).

---

## A regra

> **Toda tentativa de entrega de documento gera histórico — do cliente ou da equipe,
> aceita ou recusada. Nenhuma recusa acontece só na tela. O histórico sobrevive à
> exclusão do documento.**

Três consequências que não são negociáveis:

1. **Recusa silenciosa não existe.** Se o sistema disse "não" ao usuário, existe uma
   linha registrando o quê, quem, quando e por quê.
2. **Tentativa recusada não vira documento.** O acervo (`qa_documentos_cliente`) guarda
   o que vale; a trilha guarda o que foi tentado. Misturar os dois transforma o Hub num
   depósito de lixo e quebra os contadores do checklist.
3. **Apagar o documento não apaga a história dele.** Exclusão lógica ou física do
   documento preserva a trilha — é ela que responde "o cliente entregou ou não?" meses
   depois.

## Por que a regra existe

Hoje várias recusas acontecem apenas no navegador, e não deixam nada para trás. O modal
do Hub barra e devolve o usuário sem gravar linha nenhuma em cinco situações:
documento em duplicidade de tipo, certidão incorreta para o slot, titular divergente,
grupo do checklist ainda bloqueado, e — na correção em curso — arquivo repetido detectado
por eTag.

O efeito prático é conhecido: o cliente afirma que enviou, a equipe não encontra registro,
e ninguém consegue reconstituir o que aconteceu. Quando a recusa é justa, falta a prova;
quando é um falso positivo do sistema, falta o sintoma para corrigir a regra.

## O que conta como tentativa

Conta toda ação em que o usuário concluiu o gesto de entregar — anexou o arquivo e mandou
salvar — independentemente do desfecho:

| desfecho | grava no acervo? | grava na trilha? |
|---|---|---|
| aceito e aprovado | sim | sim |
| aceito e reprovado pela análise | sim | sim |
| barrado antes de gravar (as cinco situações acima) | **não** | **sim** |
| erro técnico (upload falhou, edge fora do ar) | não | sim |

Não conta: abrir o modal, trocar o tipo, anexar e desistir sem salvar.

## Onde o rastro vive

**Reuso obrigatório — não criar tabela nova.**

- **`qa_documentos_cliente_eventos`** — trilha de ações sobre documento do Hub. É o lugar
  canônico das tentativas, inclusive as barradas.
- **`qa_status_eventos`** — transições de status (aprovado/reprovado pela equipe). Já
  alimentada por `docsAprovacao.ts`; permanece como está.
- **`qa_documento_acessos`** — leitura e download pela equipe. Fora do escopo desta regra.
- **`logs_sistema`** — telemetria de infraestrutura. **Não** é trilha do cliente e não
  serve para cumprir esta regra: é volátil, some no expurgo e ninguém consulta por cliente.

## Contrato do evento

Toda tentativa registra, no mínimo:

| campo | conteúdo |
|---|---|
| `acao` | `upload` quando aceita; `tentativa_bloqueada` quando barrada |
| `ator_tipo` | `cliente`, `admin` ou `sistema` |
| `ator_user_id` | quem estava logado |
| `qa_cliente_id` + `customer_id` | **os dois**, sempre que ambos existirem |
| `documento_id` | preenchido quando virou documento; nulo quando barrada |
| `detalhes` | motivo legível, tipo pretendido, tipo lido, exigência alvo, e a identificação do arquivo: nome, mime, tamanho e eTag |
| `created_at` | automático |

O `detalhes` precisa bastar sozinho: quem lê a trilha seis meses depois não terá o arquivo
nem a tela. O motivo vai em português, no mesmo texto que o usuário viu — não em código
interno.

Preencher **os dois vínculos** de cliente é obrigatório e tem causa concreta: o acervo já
nasceu partido em dois trilhos (documento da equipe só com `qa_cliente_id`, documento do
portal só com `customer_id`), e qualquer consulta que use um lado só perde metade da
história.

## Estado da implementação

As cinco recusas do modal do Hub gravam na trilha (15/08/2026):

| recusa | código na trilha | arquivo chegou a subir? |
|---|---|---|
| arquivo repetido (mesmo eTag) | `arquivo_repetido` | sim — e é apagado |
| documento em duplicidade de tipo | `duplicidade_tipo` | não |
| certidão incorreta para o slot | `certidao_incorreta` | não |
| titular divergente / parentesco | `titular_divergente` | não |
| grupo do checklist bloqueado | `grupo_bloqueado` | não |

Só a primeira acontece **depois** do upload: ela compara o conteúdo do arquivo,
o que exige o arquivo no bucket. As outras quatro são decididas durante a
leitura, antes de qualquer envio — por isso `arquivo_apagado: false` nelas.

Motor: `src/lib/quero-armas/rastroTentativas.ts`, ligado em
`ClienteDocsHubModal.tsx`.

## Obstáculos atuais

A regra **não é cumprível hoje** sem estas três mudanças de estrutura em
`qa_documentos_cliente_eventos` (criada em `20260623225220`):

1. **`documento_id uuid NOT NULL`** — tentativa barrada não tem documento para apontar.
   Precisa aceitar nulo.
2. **`REFERENCES qa_documentos_cliente(id) ON DELETE CASCADE`** — apagar o documento apaga
   a trilha junto, o oposto do que a regra determina. Precisa virar `ON DELETE SET NULL`.
3. **`CHECK (acao IN (...))`** — a lista atual não prevê tentativa barrada. Precisa aceitar
   `tentativa_bloqueada`.

Sem isso, todo registro de tentativa recusada falha na inserção — silenciosamente, se quem
gravar usar `.then(() => {}, () => {})`, que é o padrão em uso hoje.

## Regras de contorno

- **Gravação nunca bloqueia o fluxo.** Falha ao registrar a trilha não impede o documento
  de ser salvo nem a recusa de ser exibida. Mas falha ao gravar **é** logada.
- **A trilha é somente-inserção.** Sem `UPDATE`, sem `DELETE`. Correção se faz com evento
  novo, nunca reescrevendo o anterior.
- **Tentativa barrada não gera notificação ao cliente.** Ele já viu o carimbo na tela; o
  e-mail duplicaria o aviso.
- **O texto do motivo é o mesmo mostrado ao usuário.** Se a tela diz "esse documento já
  consta aprovado", a trilha diz o mesmo. Divergência entre os dois é bug.

## Decisões pendentes

Duas escolhas de negócio ficam em aberto — a implementação não começa sem elas:

1. **Destino do arquivo barrado.** Ele já subiu ao storage quando a recusa acontece.
   Apagar na hora mantém o bucket limpo e é o mais seguro sob LGPD, mas tira da equipe a
   possibilidade de conferir o que o cliente tentou enviar. Reter por prazo curto em
   quarentena resolve o suporte e cria dever de guarda.
   *Recomendação: apagar, e guardar na trilha a identificação do arquivo — nome, tamanho e
   eTag bastam para provar que foi o mesmo arquivo de antes.*
2. **Visibilidade da trilha para o cliente.** As tentativas barradas aparecem no portal
   dele, ou só no painel da equipe?
   *Recomendação: só para a equipe, num primeiro momento. Expor ao cliente uma lista das
   próprias recusas exige texto cuidadoso, ou vira motivo de atrito.*

## Como conferir

Depois de implementada, a regra se verifica assim — tentativas de um cliente, aceitas e
barradas, em ordem:

```sql
select e.created_at,
       e.acao,
       e.ator_tipo,
       e.documento_id,
       e.detalhes->>'motivo'         as motivo,
       e.detalhes->>'tipo_pretendido' as tipo_pretendido,
       e.detalhes->>'tipo_lido'       as tipo_lido,
       e.detalhes->>'arquivo_nome'    as arquivo
  from public.qa_documentos_cliente_eventos e
 where e.qa_cliente_id = :cliente_id
    or e.customer_id   = :customer_id
 order by e.created_at desc;
```

E a estrutura, que é o pré-requisito:

```sql
select a.attname                                as coluna,
       a.attnotnull                             as obrigatoria,
       pg_get_constraintdef(c.oid)              as constraint
  from pg_attribute a
  left join pg_constraint c
    on c.conrelid = a.attrelid and a.attnum = any(c.conkey)
 where a.attrelid = 'public.qa_documentos_cliente_eventos'::regclass
   and a.attname in ('documento_id', 'acao')
   and a.attnum > 0;
```

Esperado depois da correção: `documento_id` com `obrigatoria = false` e FK
`ON DELETE SET NULL`; `acao` com `tentativa_bloqueada` na lista do CHECK.
