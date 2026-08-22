# PENDÊNCIAS ABERTAS — Quero Armas

> ## ✅ LEVA DAS CERTIDÕES DOS 5 ANOS — APLICADA E CONFERIDA
>
> Fechada em **21/08/2026, 21:56 BRT**. Migrations aplicadas em produção, na
> ordem: `070000`, `080000`, `090000`, `100000`, `110000`, `120000`, `130000`.
> Edge function `qa-cadastro-publico` publicada às 21:46, antes da `110000` —
> a ordem obrigatória foi respeitada.
>
> Conferido no banco, consulta a consulta:
>
> | O que | Resultado |
> |---|---|
> | trava de estado dentro do motor de reaproveitamento | presente |
> | certidões territoriais com o estado carimbado | 36 de 36 |
> | tipos aceitos no cofre | 223 |
> | gatilhos da regra vivos | os 5; o destrutivo da 1ª versão não existe |
> | colunas e gatilhos do formulário público | removidos |
> | pergunta no catálogo | 32, 33, 44, 50 — todos SINARM CAC |
> | serviços fora da regra com a pergunta | 0 |
> | a régua por serviço | 31, 59, 60 = false; os CAC = true |
> | blocos de estado anterior órfãos | 0 vazios, 0 com documento |
>
> Nada da leva está pendente. O que resta neste arquivo são **decisões**, não
> desenvolvimento.

---

# Pendências abertas — auditoria do fluxo de posse/autorização

Índice único do que ficou em aberto. Atualizado em 21/08/2026, 18:40 BRT.
**Escopo de ataque CONCLUÍDO: F1–F11 + reauditoria.**

---

## ✅ RESOLVIDA (21/08/2026) — Certidão segue o estado do cliente

Regra dada pelo titular: **o cliente recebe os links das certidões do estado
dele e as da União. Só se pede o que ele consegue emitir.** Cliente do Paraná
não tem como baixar certidão do Tribunal de Justiça Militar — esse tribunal só
existe em SP, MG e RS.

Antes disso, todo cliente de qualquer estado recebia a lista com nome e link de
São Paulo, e nos serviços 44 (CR), 50 (atirador) e 60 (posse) recebia o TJM como
exigência OBRIGATÓRIA. Quem morava fora dos três estados ficava com um item que
não tinha onde cumprir, e o checklist nunca fechava.

A regra territorial tinha sido escrita em 30/07 (`20260730160000`) e **nunca foi
aplicada** — a coluna `condicao_uf` não existia no banco. Pior: a
`20260812203000` reescreveu o montador de checklist DEPOIS, sem o filtro. Os
dois lados foram arrumados agora.

**Aplicada e conferida em 21/08 12:36 BRT** (migrations `20260821040000` e
`20260821050000`). Detalhes e conferências em `docs/DEPLOY-FUNCOES-PENDENTES.md`,
leva 16.

Duas decisões do titular ficaram registradas na migration: cliente de São Paulo
tira AS DUAS certidões federais (regional + Seção Judiciária), encerrando a
divergência com a decisão de 30/07; e a correção vale também para os processos
já abertos que ainda montam dossiê.

Junto vieram dois consertos de comportamento compartilhado, com aval explícito:
o botão "sincronizar checklist" e o painel de divergência do admin passaram a
respeitar condição profissional com vírgula, modalidade e UF — os três já
estavam errados antes desta leva, e o botão desfazia a correção territorial a
cada clique.

As sobras que a revisão apontou depois disso — aviso de vencimento e texto de
e-mail ainda dizendo São Paulo, nome do arquivo do dossiê com "TRF3", apelido
legado do TJM devolvendo o link do tribunal comum, e nenhuma trava impedindo
que linha nova de TJM nascesse sem marcação — foram fechadas na leva 17, em
21/08 18:36.

---

## ✅ RESOLVIDA (21/08/2026) — Certidão do STM com 30 dias no serviço 50

O serviço 50 nasceu em 20/08 copiando a lista do CR, que ainda tinha 30 dias
naquele momento; o alinhamento geral das certidões havia rodado em 19/08, um dia
antes, então o serviço novo nunca passou por ele. Corrigido pela migration
`20260821030000`; conferido em 21/08 09:55: serviços 44, 50 e 60 com 90 dias, e
a varredura geral de certidões fora da tabela única voltou sem nenhuma linha.

---


## ✅ Deploy — nada pendente

As 23 edge functions da auditoria estão publicadas (leva 1 às 00:08, leva 2 às
01:20, `qa-export-docx` às 11:22 BRT) e as **7 migrations** estão aplicadas e
conferidas. Histórico e comandos em `docs/DEPLOY-FUNCOES-PENDENTES.md`.

**Banco (21/08):** as QUATRO migrations do dia estão aplicadas e conferidas —
`20260821030000` (STM 90 dias), `20260821040000` (certidão segue o estado),
`20260821050000` (botão e painel pela mesma régua) e `20260821060000` (gatilho
que faz o TJM nascer marcado).

**Edge functions (21/08 18:36):** `qa-vencimentos-alertas`,
`qa-documento-cliente-notificar` e `qa-montar-juntada` publicadas — eram as que
carregavam o texto de "onde emitir" e o nome do arquivo do dossiê.

**Front (21/08):** publicado — a branch foi para a `main`. Traz quatro
melhorias no popup guiado: link resolvido por igualdade (antes, por prefixo, uma
certidão de outro estado guardada no cofre recebia o link do estado atual), UF
escrita por extenso reconhecida (senão o texto saía "TJPARANÁ"), Distrito
Federal como TJDFT, e fim do "TJ Militar/PR", tribunal que não existe. Junto
foram os textos neutros do aviso de vencimento e os rótulos do cofre sem
"TJSP".

**Correção de registro (21/08):** o quadro da leva 11 (a GRU só abre depois da
defesa aprovada) ficou marcado como 🔴 PENDENTE por engano. Conferido hoje: a
coluna `exige_peca_defesa` e o gatilho `qa_trg_trava_protocolo_sem_defesa`
existem no banco. Já estava aplicada.

---

## ✅ RESOLVIDA (20/08/2026) — Certidão não vence depois do protocolo — Lei 9.784/99

Regra dada pelo titular: **depois que o processo é protocolado, a certidão não
vence mais.** A Lei 9.784/99, que regula o processo administrativo federal, põe
a demora na conta da Administração, não do requerente. Documento juntado no
protocolo está juntado.

**Resolvida com o aval do titular, com a regra completa: o relógio para no
protocolo (SIGMA e SINARM) e SÓ volta se a delegacia obrigar — notificação ou
recurso administrativo.** Três camadas alinhadas: o cálculo SQL do prazo
crítico (migration `20260821010000`, com gatilho e acerto dos protocolados), o
robô de e-mails (`qa-vencimentos-alertas` passou a decidir pelo espelho
`instrucaoAindaExigida` — a lista local silenciava até quem estava em
exigência) e o front (recurso administrativo agora religa o relógio).

### O furo

O sistema calcula `qa_processos.prazo_critico_data` como a MENOR validade entre
os documentos do processo, e usa isso para alertar e cobrar renovação. Não foi
encontrado nada que desligue esse cálculo quando `protocolo_data` é preenchida.

Isso não é hipótese barata: a autorização de compra CAC leva de **5 a 8 meses**
entre protocolo e deferimento (medido nos três dossiês deferidos — Eduardo,
Rivelino e Édson). Nesse intervalo, toda certidão de antecedentes vence. O
cliente passa meses recebendo cobrança para renovar documento de um processo
que já está na mão do órgão — e a equipe perde tempo tratando exigência que a
lei não permite existir.

### Por que não foi corrigido junto

⚠️ **Comportamento compartilhado.** O prazo crítico vale para TODOS os serviços,
não só para a autorização de compra. Mudar o cálculo muda alerta, cobrança e
KPI de todo processo do sistema. Depende de aval do titular, que pediu para
registrar como pendência.

### Consulta que confirma se o furo existe

```sql
SELECT p.id, p.servico_id, p.servico_nome, p.status,
       p.protocolo_data, p.protocolo_orgao,
       p.prazo_critico_data, p.prazo_critico_doc_id
  FROM public.qa_processos p
 WHERE p.protocolo_data IS NOT NULL
   AND p.prazo_critico_data IS NOT NULL
 ORDER BY p.prazo_critico_data;
```

Se vier qualquer linha, há processo protocolado ainda com relógio de vencimento
correndo. O conserto é parar o relógio quando `protocolo_data` existe.

---

## 🟠 ANEXO C — habitualidade é por ESPÉCIE de arma, não por calibre (20/08/2026)

Regra dada pelo titular: os treinamentos são **por espécie de arma**, conforme a
**IN DG/PF 311**. O texto "por calibre" vem do art. 35 do Decreto 11.615/2023 e
não é o que vale para a conferência.

### O que já foi feito e o que falta

A migration `20260820120000_cr_templates_v2_e_link_lntd.sql` já tratou disso: o
modelo de maio tinha o texto antigo "por calibre", e por isso os cinco modelos
subiram com sufixo `_v2`, incluindo
`declaracao_compromisso_habitualidade_v2`. Os botões do sistema já apontam para
a chave nova.

**O que falta conferir** — os modelos são arquivos `.docx` no Storage
(`qa-templates` → `declaracoes/`), subidos à mão, e nenhum código garante o
conteúdo deles:

1. o `declaracao_compromisso_habitualidade_v2.docx` foi realmente subido?
2. o texto dele diz **espécie de arma**, e não "calibre"?

Evidência de que ainda circula versão errada: o dossiê deferido do Édson Campos
(julho/2026) levou um ANEXO C dizendo *"no mínimo, por calibre registrado, oito
treinamentos ou competições"* — ou seja, o arquivo de maio.

Enquanto os dois pontos não forem confirmados, existe risco de sair declaração
com a base legal errada no dossiê do cliente.

### Como conferir (5 minutos, sem SQL)

1. Supabase → **Storage** → bucket `qa-templates` → pasta `declaracoes/`.
2. Procurar `declaracao_compromisso_habitualidade_v2.docx`. **Se não estiver
   lá, o botão "baixar declaração" está quebrado** para todo mundo desde a
   migration de 20/08 — ela apontou os botões para a chave `_v2` contando com o
   upload manual.
3. Se estiver lá, baixar e ler o parágrafo do compromisso. Tem de dizer
   **espécie de arma**. Se disser "calibre", é o arquivo de maio subido com
   nome novo — e aí o texto precisa ser corrigido e resubido.

Conferência rápida de qual chave os botões usam hoje:

```sql
SELECT DISTINCT regra_validacao ->> 'template_key' AS template_key,
       count(*) AS exigencias
  FROM public.qa_servicos_documentos
 WHERE regra_validacao ->> 'template_key' ILIKE '%habitualidade%'
 GROUP BY 1;
```

Esperado: só `declaracao_compromisso_habitualidade_v2`. Se ainda aparecer a
chave sem `_v2`, sobrou exigência apontando para o modelo velho.

---

## 📌 CAC é gerido pela Polícia Federal — Exército não está atuando (20/08/2026)

Regra dada pelo titular: pela **IN DG/PF 311**, os CACs passaram para a Polícia
Federal. O Exército não está atuando desde a posse do presidente atual.

Isso corrige uma leitura minha ao analisar os dossiês deferidos. Os três trazem
o mesmo formulário do SisGCorp ("Autorização para Aquisição de PCE no Comércio
Nacional"), mas com órgãos diferentes no cabeçalho:

| dossiê | órgão no papel | assinou | autorização nº | fornecedor identificado por |
|---|---|---|---|---|
| Eduardo Rizek | Exército / DFPC | SFPC/DPF/SJK/SP | 99234025002588 | Nº Registro SIGMA |
| Rivelino Pereira | Exército / DFPC | SFPC/DPF/SJK/SP | 99234025002548 | Nº Registro SIGMA |
| Édson Campos | **Polícia Federal** | SFPC/SR/PF/SP | 99181025026558 | **CNPJ** |

**Os dois do Exército são legado, não são o caminho atual.** O processo novo
deve nascer com `protocolo_orgao = 'POLICIA_FEDERAL'`, que é o padrão que o
front já usa. Não criar bifurcação de órgão no checklist da autorização de
compra: se um dia o Exército voltar a atuar, aí sim se trata.

Fica registrado o que muda no papel entre os dois, para quem for ler um dossiê
antigo e estranhar: o Exército identifica a loja pelo **nº de registro SIGMA**,
a PF pelo **CNPJ**. E o prefixo do número da autorização muda junto (9923 =
Exército, 9918 = PF).

---

## 📌 Processos antigos de autorização de compra: excluir e só gerenciar (20/08/2026)

Decisão do titular sobre os clientes que contrataram ANTES do contrato novo e
do checklist novo:

- **não mexer** nos processos deles — nem reexplodir, nem completar;
- esses processos serão **excluídos** depois;
- para esses clientes, o sistema vai guardar apenas o **certificado da arma
  (CRAF)** e as **GTEs** — só gestão de acervo, sem ciclo de documentos;
- o ciclo completo (checklist novo de 28 itens + 8 certidões) vale **somente
  para processos criados daqui pra frente**.

Quando a exclusão for feita, usar o caminho normal de exclusão de processo
(que preserva os documentos do cliente na Central) — os CRAFs e GTEs entram
pelo Arsenal / hub documental.

---

## 🟠 Autorização de Compra CAÇADOR (serviço 51) continua pela metade (20/08/2026)

O serviço 50 (atirador) foi montado a partir de três dossiês deferidos
(migration `20260820220000`). O **51 (caçador) não foi tocado** e continua com
**4 linhas**: `rg_com_cpf`, `comprovante_residencia`, `habilitacao_cacador_ibama`
e `laudo_capacidade_tecnica`.

Não foi montado junto de propósito: os três dossiês entregues são todos de
**atirador desportivo**. Copiar o checklist do 50 para o 51 seria chute — o
caçador tem o documento do Ibama e provavelmente não tem a mesma exigência de
treinamentos/competições.

**Para destravar:** um dossiê de autorização de compra de CAÇADOR já deferido.
Com ele em mãos, o trabalho é a mesma migration do 50 apontada para o 51.

Enquanto isso, quem contratar o 51 anda com checklist de 4 itens e chega ao
protocolo faltando quase tudo.

---

## ✅ RESOLVIDA (20/08/2026) — Escolha da loja e da arma entram pelo checklist

**Resolvida — decisão do titular: perguntas no checklist.** A migration
`20260821020000` põe no serviço 50 a pergunta "você já fechou com a loja a
arma que vai comprar?" e, para quem responde SIM, o upload do contrato/pedido
da loja (dados da arma + CNPJ) — que é de onde a equipe tira o que precisa
para abrir o pedido no SINARM CAC. Quem responde NÃO define com a equipe.

Nos três dossiês deferidos, o **fornecedor sai impresso na autorização** — razão
social e endereço, identificado por CNPJ (PF) ou por nº de registro SIGMA
(Exército, legado). Ou seja: **a loja é dado de entrada do pedido, não resultado
dele.** Sem ela escolhida, não dá para abrir o pedido no sistema.

O checklist do serviço 50 não tem onde registrar isso. Não foi criado junto
porque exigiria um tipo de documento novo no vocabulário fechado, e o
`tipo_documento` tem CHECK em `qa_documentos_cliente` — mexer nele é trava
compartilhada, atinge todo tipo de documento do sistema.

**Opções, a decidir com o titular:**
1. uma pergunta no checklist (`pergunta_*`), com a lista das lojas usadas;
2. um campo no processo, fora do checklist;
3. deixar fora do sistema, como é hoje, e a equipe combina por fora.

Mesma pergunta vale para o **modelo da arma** (marca, modelo, calibre), que
também sai impresso na autorização e hoje não é coletado em lugar nenhum do
processo.

---

## 🟠 Colecionador não tem Autorização de Compra no catálogo (20/08/2026)

Descoberto ao ligar o portão do 2º endereço. Ficou registrado aqui para ser
lido quando o ciclo de compra do CAC for atacado.

### O que existe hoje

Autorização de Compra existe para **dois** dos três fundamentos CAC:

| serviço | nome | slug |
|---|---|---|
| 50 | Autorização de Compra de Arma de Fogo — Atirador Esportivo (CAC) | `autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac` |
| 51 | Autorização de Compra de Arma de Fogo para Caçador (CAC) | `autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac` |

**Colecionador não tem nada.** Não é só o item de catálogo que falta: não há
sigla de protocolo, não há anexo de contrato e não há checklist de documentos.
Criar o serviço é o trabalho dos três — não é uma linha.

### O que fazer quando ele entrar

1. Criar o item em `qa_servicos_catalogo` espelhando o 50/51 (preço, sigla de
   protocolo, anexo de contrato, checklist de documentos).
2. **Ligar o portão do 2º endereço nele** — esta é a linha:

```sql
UPDATE public.qa_servicos_catalogo
   SET admite_segundo_endereco = true, updated_at = now()
 WHERE slug = '<slug-do-servico-novo>';
```

Sem esse UPDATE, o colecionador contrata a autorização de compra e **não
consegue declarar o 2º endereço de guarda do acervo** — o bloco não aparece no
formulário público nem no cadastro interno, e o portal recusa os campos. Não dá
erro nenhum; simplesmente não funciona, e ninguém percebe até o dossiê chegar
incompleto ao protocolo.

### Por que não deixei automático

A regra atual abre o portão por `servico_id IN (50, 51)`. Existe uma segunda
cláusula que pegaria qualquer Autorização de Compra CAC pela modalidade — mas
os serviços 50 e 51 estão com `modalidade_cac` **em branco** no catálogo, então
um serviço novo criado do mesmo jeito também não seria pego por ela. Afrouxar a
regra para reconhecer pelo nome/slug é mudança de comportamento compartilhado e
depende de aval do titular; enquanto isso, é o UPDATE acima, explícito.

Migration de referência: `20260820200000_segundo_endereco_cr_e_autorizacao_cac.sql`.
Regra no front: `src/lib/quero-armas/segundoEndereco.ts`.

---

## 🟠 Defesa por tipo de serviço — regra do titular (20/08/2026)

Definição dada pelo titular ao fechar o furo da GRU (ver
`docs/DEPLOY-FUNCOES-PENDENTES.md`, leva 11):

- **CAC / SIGMA (Exército): NÃO tem defesa.** Concessão e renovação de CR,
  apostilamento, acervo, guia de tráfego especial, autorização de compra de
  atirador e de caçador. Ficam com `exige_peca_defesa = false`.
- **SINARM (Polícia Federal): TEM defesa, sempre.** Algumas são simples, mas
  existem. Ficam com `exige_peca_defesa = true`.

Os dois serviços que puxam o volume de defesa: **autorização de compra / posse**
e **porte de arma de fogo para cidadão comum**.

### PENDENTE — defesa simplificada para cargos com prerrogativa

O porte funcional (magistrado, Ministério Público e demais cargos com
prerrogativa legal) tem defesa **bem mais simples** que a do cidadão comum: a
prerrogativa já está na lei, não há o que provar sobre necessidade. Hoje esses
processos passam pelo mesmo caminho de peça dos demais.

**A decidir com o titular:** que forma essa peça simplificada toma — modelo
próprio, versão curta do modelo atual, ou dispensa de aprovação do cliente.
Enquanto não for decidido, o serviço segue exigindo peça como os outros; nada
trava por causa disso, só dá mais trabalho à equipe do que precisaria.

### Dois serviços SINARM que NÃO têm defesa

A regra "SINARM tem defesa" tem duas exceções, decididas pelo titular em
20/08/2026:

- **Segunda via de CRAF digital** — é download ou requerimento pedindo cópia.
  Não há mérito a sustentar.
- **Transferência de propriedade** — a defesa é de quem **recebe** a arma, e
  ela entra pelo serviço de autorização de compra/posse do recebedor. Quem
  transfere não defende nada.

Ambas isentas por slug, não por categoria. **TRAVADO no banco em 20/08/2026**:
a migration `20260820160000_trava_isencao_defesa.sql` criou a coluna
`defesa_isencao_travada` + gatilho que mantém `exige_peca_defesa = false`
nessas linhas (e nos dois cursos de pistola) mesmo se um UPDATE em massa
tentar religar. Para ligar de propósito: destravar primeiro, ligar depois.

### Guia de Trânsito ≠ Guia de Tráfego Especial

Confusão que já custou uma classificação errada no catálogo (corrigida em
20/08/2026), e que erra de novo em qualquer leitura apressada dos dois nomes:

- **Guia de Tráfego Especial** — é do **CAC**, vive no SIGMA (Exército).
  Sem defesa.
- **Guia de Trânsito (GT)** — é do **SINARM / Polícia Federal**. A primeira
  serve para retirar a arma da loja e levá-la para casa; depois dela ainda há
  GT no SINARM para situações específicas: levar a arma ao estande num treino
  agendado, levar ao armeiro, e outras. Tem defesa, como todo serviço SINARM.

### Registro do que a defesa precisa sustentar (cidadão comum)

Duas portas de entrada, ambas com as provas do padrão atual da casa:

1. **Ameaça ou grave ameaça** — o fato concreto e a prova dele.
2. **Exercício profissional de risco** — o enquadramento da atividade.

## 🟠 CAC — o que ficou fora do fechamento do CR

Aberto em 19/08/2026. Decisão do titular: **fecha o CR primeiro; nada disso
entra agora.**

### 1. Autorização de Compra não recebe modalidade CAC

Os serviços 50 (atirador esportivo) e 51 (caçador) já são vendidos separados por
atividade, mas estão com `qa_servicos_catalogo.modalidade_cac` em branco. O
gatilho `qa_trg_processo_modalidade_do_catalogo` já existe e funcionaria neles
sem nenhuma linha de código nova — basta marcar a atividade de cada um.

**Por que não foi feito agora:** marcar a atividade muda o que os processos
NOVOS desses dois serviços vão pedir, porque o checklist deles pode ter
exigências presas à modalidade. Antes de marcar é preciso olhar o checklist dos
dois, com o número na mão, e decidir. Não é conserto de uma linha às cegas.

**Quando for a hora:**

```sql
SELECT servico_id, tipo_documento, nome_documento, obrigatorio, ativo,
       condicao_modalidade, condicao_profissional
  FROM public.qa_servicos_documentos
 WHERE servico_id IN (50, 51)
 ORDER BY servico_id, ordem;
```

### 2. Prazo de exigência da PF no CR é de 30 dias, não 10

IN DG/PF 311/2025, art. 76: o interessado tem **trinta dias corridos** para se
manifestar sobre as correções apontadas, sob pena de indeferimento. Na posse o
prazo é de 10 dias, e é esse que o motor de prazos conhece hoje.

**Risco enquanto isso não for ajustado:** o cliente de CR é cobrado com urgência
de 10 dias quando na verdade tem 30 — alarme falso, não perda de prazo. Erra
para o lado seguro, por isso não é urgente.

**O que falta para ajustar:** ver como `qa_prazos_procedimentos` está preenchida
hoje (colunas `tipo_peca`, `procedimento_servico`, `base_calculo`,
`tipo_contagem`, `evento_base`) antes de inserir a linha do CR. Não dá para
chutar configuração de produção.

```sql
SELECT id, tipo_peca, procedimento_servico, prazo_dias, base_calculo,
       tipo_contagem, evento_base, janela_alerta_dias, prioridade, ativo
  FROM public.qa_prazos_procedimentos
 WHERE ativo
 ORDER BY procedimento_servico NULLS FIRST, tipo_peca;
```

### 3. Insumos do CR que dependem da operação

Atualizado em 19/08/2026, depois dos 4 zips de dossiês deferidos (Rivelino,
Wellington, Augusto e Fabrício — todos atirador, todos com o CR emitido):

| Insumo | Situação |
|---|---|
| Dossiês de CR deferidos | ✅ **entregues** — 4 dossiês completos; corrigiram a DEGA (sempre exigida) e a declaração do 2º endereço (migration `20260819080000`) |
| Modelos para treinar a IA | 🟡 **material em mãos** — os zips têm 2+ versões de cada declaração (DSA, DEGA, compromisso em 5 clubes, responsável imóvel, 2º endereço, inquérito) nas pastas "Documentos para preencher", mais as versões assinadas reais. Falta a equipe subir na Biblioteca (Configurações), 2 por documento. DECORE já subiu (1 modelo, det+ia ✅ — subir o 2º quando aparecer) |
| Telas do Sinarm-CAC | 🟢 **rebaixado — não bloqueia mais nada.** O titular confirmou (19/08) que o protocolo é feito pela EQUIPE com a senha GOV do cliente; o cliente não opera o Sinarm-CAC, então não existe roteiro guiado de cliente a montar. O fluxo confirmado está em `mem://features/quero-armas/concessao-cr-fluxo` e virou o checklist (migration `20260819100000`). Prints das telas seguem bem-vindos apenas para a Base de Conhecimento/treino de equipe nova |

Fora do escopo do CR, registrado nesta sessão: DECORE **não** vira exigência de
serviço até um cliente precisar (decisão do titular, 19/08); arquivos de senha
GOV dentro dos zips são ignorados em qualquer processamento.

---

## 🔴 Conferência dos templates de e-mail — CINCO, numa tela só

**Como conferir:** abrir o painel de preview de e-mails e procurar os cinco.

| Template | Quem recebe |
|---|---|
| Exigência da PF respondida (equipe) | equipe |
| Petição pronta para aprovação (cliente) | cliente |
| Petição decidida pelo cliente (equipe) | equipe |
| Recurso protocolado (cliente) | cliente |
| Processo deferido — documento entregue (cliente) | cliente |

As funções que carregam o registry já estão todas publicadas — é uma olhada só,
numa tela só.

**Por que importa:** é o item que quebra em SILÊNCIO. Os templates vivem no
registry, que é embutido no bundle de `send-transactional-email`. Se o registry
não pegou, o envio falha em runtime por template inexistente — sem erro visível
para quem clicou. Só se descobre no disparo real: quando a PF notifica um
cliente, quando a equipe devolve uma petição, quando um processo é deferido.

**Se algum não estiver lá:** republicar `send-transactional-email`,
`preview-transactional-email`, `qa-enviar-email-template` e
`qa-send-all-templates-preview`.

---

## ✅ Furos 1 e 2 da terceira auditoria — fechados em 18/08

| Furo | Situação |
|---|---|
| 1. A petição aprovada não entrava no dossiê da PF | ✅ vira PDF (via do órgão + via lacrada) e entra no checklist · publicado 12:19 |
| 2. Responder a notificação não fechava o prazo de 10 dias | ✅ `qa-manifestacao-responder` + coluna nova · publicado 12:54 |
| — Achado ao conferir o 2: prazo alarmava caso já deferido | ✅ o motor passou a aceitar os dois vocabulários de status |
| — Achado ao conferir o 2: a coluna nova não era lida por leitor nenhum | ✅ ligada nos cinco leitores, com teste que trava a lista |
| 3. O protocolo aceitava dossiê velho | ✅ trava + aviso do que mudou desde a montagem |
| 4. Nada encerrava o serviço depois da entrega | ✅ o cliente confirmar o recebimento leva a `concluido` → `finalizado` |

**Os quatro furos da terceira auditoria estão fechados.** Os furos 3 e 4 não
exigem SQL: o 3 é front, o 4 é a edge do deferimento mais o gatilho de espelho
que já está no ar.

---

## 🔴 O prazo do recurso parou de alarmar de verdade?

A consulta de conferência (`supabase/_conferencia_pos_deploy.sql`, seção A)
devolveu **"PRAZO FECHADO (correto)"** para Edmar Souza Zeferino (indeferido
25/05, recurso 03/06). Mas aquela consulta é a regra **reescrita em SQL**: ela
prova que o dado está na forma em que a correção se aplica, **não** que o código
publicado está calculando assim.

**Prova definitiva — qualquer uma das duas:**

- Abrir o painel de prazos no dashboard e ver o processo do Edmar sair do
  vermelho.
- Invocar `qa-processo-prazo-alertas` com `{"dry_run": true}`. Ele devolve o que
  enviaria, sem mandar e-mail nenhum. Se o Edmar não aparecer na lista, está
  resolvido.

**Contexto:** desde 04/06 o painel mostrava o processo dele como vencido e saiu
alarme para ele e para a equipe, num processo que estava correto — o recurso foi
protocolado um dia antes do fim do prazo.

---

## 🟡 Sem caso real para testar (não é falha)

Na conferência de 18/08 as seções B, C e D voltaram vazias:

- **Nenhum processo em `pronto_para_protocolar`.** A juntada não pôde ser
  testada ponta a ponta. Do lado bom: a trava nova do protocolo não está
  travando ninguém.
- **Nenhuma exigência da PF viva no sistema.** A F8 (reabertura de exigência
  repetida + avisos à equipe) se prova na próxima notificação que a equipe colar.

Repetir a conferência quando qualquer um dos dois aparecer:
`supabase/_conferencia_pos_deploy.sql`.

**Passivo do deferimento:** os 3 processos já deferidos estão sem documento
entregue — são exatamente os dois clientes legados da pendência abaixo. Não é
caso novo: some junto com a exclusão.

---

## 🟡 Deferidos anteriores à automação, presos no checklist — TRÊS clientes

Levantamento completo em **`docs/PENDENCIA-EXCLUSAO-SERVICOS-LEGADOS.md`**.

**Eduardo Rizek Elias (183) e Wilker Soares Fonseca (164):** exclusão dos
serviços já decidida pelo titular. Aguarda três decisões-limite: exames (4),
procuração (1), CR + assinaturas do Arsenal (3). E uma quarta sobre auditoria
(8 eventos de status, 3 acessos à senha GOV, 1 documento-modelo da IA) — a
recomendação é manter tudo.

**Gilberto Raimundo da Silva Neto — decisão em aberto.** Apareceu em 18/08 na
conferência do furo 2. O item da venda dele está DEFERIDO desde 29/06, mas o
processo no sistema segue em `aguardando_documentos`, com 18 itens de checklist
abertos e um cron reexplodindo essa lista duas vezes por dia desde 10/08. Se ele
entrar na área do cliente, vê 18 pendências de um serviço já concedido. O alarme
de prazo não o atinge mais.

Duas saídas: fechar o processo pelo fluxo novo (`qa-processo-deferir`, exige o
documento do deferimento em mãos) ou excluir os serviços, como nos outros dois.

---

## 🔴 TERCEIRA AUDITORIA (18/08, tarde) — quatro furos novos, no FIM do fluxo

Os 18 originais e os 4 da reauditoria continuam fechados (reconferidos). Esta
passada olhou só o trecho protocolo → decisão → entrega, e achou quatro.

### 1. A petição que o cliente aprova não entra no dossiê da PF

O ciclo novo funciona: a equipe envia, o cliente lê, ajusta, aprova. E acaba
ali. O PDF único que vai para a delegacia é montado a partir dos DOCUMENTOS do
processo, e a petição aprovada não é um documento — vive só na tabela de
gerações. Não há botão que a transforme em peça do dossiê, e o tipo
`peticao_efetiva_necessidade` existe apenas no mapa de ordenação: nenhum
documento do sistema pode nascer com ele.

Consequência: ou alguém baixa o DOCX, converte e sobe à mão como "documento
complementar", ou o processo é protocolado sem a petição — depois de o cliente
ter aprovado uma peça que nunca foi usada.

### 2. Responder a notificação da PF não desliga o alarme de 10 dias

O contador só é fechado por `data_recurso_administrativo`. Responder a uma
notificação não é recurso — é o caminho MAIS COMUM — e não escreve nada. Então,
depois de a equipe responder no prazo, o painel segue mandando "prazo VENCIDO
há N dias", todo dia, para o cliente e para a equipe.

É exatamente o caso do Edmar (fechado na 1ª auditoria), no outro ramo: lá o
gatilho era o indeferimento, aqui é a notificação. O ramo do indeferimento foi
consertado; o da notificação, não.

### 3. O protocolo aceita dossiê velho

A trava exige que EXISTA uma juntada. Não exige que ela seja a mais recente.
Documento aprovado depois da montagem — ou petição aprovada depois — não
invalida o PDF já montado, e o botão de protocolar continua liberado. Vai para
a PF o dossiê da versão anterior, sem aviso.

### 4. Nada encerra o serviço depois da entrega

Deferido + documento entregue + cliente confirmou o recebimento = fim real do
serviço. Mas `concluido` (processo) e `finalizado` (solicitação) só são
alcançáveis por alguém clicando à mão. Na prática todo processo entregue fica
eternamente em "DEFERIDO" — e o cliente nunca vê o serviço fechar.

---

## ✅ SEXTA AUDITORIA (18/08, noite) — o dossiê vencia sem aviso prévio

Reconferência de tudo: 18 originais + 4 da reauditoria + 4 da terceira + 2 da
quarta + 2 da quinta. Todos fechados. Esta passada auditou o código da leva 8
(classificação do requerimento, escrito em outra sessão) e o ciclo de validade
dos documentos.

### O que foi conferido e está CERTO

- **Leva 8 / requerimento.** O tipo novo entra no grupo `requerimento` do
  checklist, está nas 18 listas por serviço, ocupa o lugar 1.0 do dossiê e tem
  entrada no catálogo do Hub. A conferência campo a campo roda no
  `ClienteDocsHubModal` em `mode="portal"` — ou seja, **alcança o cliente**, não
  só a equipe. Cheguei a suspeitar do contrário e conferi: está correto.
- **Condição profissional.** Profissão não reconhecida gera o item
  `renda_definir_condicao` em vez de omitir a comprovação de renda.
- **Falha da IA.** Erro ou resposta vazia manda o documento para revisão
  humana, nunca deixa preso em análise.

### O furo: aviso de vencimento só existia para o Hub

A rotina de alertas de vencimento olhava `qa_documentos_cliente` (o Hub) e
**nunca** `qa_processo_documentos` (o checklist do processo). Os dois únicos
pontos que enxergam validade no processo são REATIVOS:

- `qa-montar-juntada` recusa montar o dossiê e reabre as linhas;
- `qa-processo-checar-conclusao-checklist` barra a promoção.

Os dois disparam no clique de montar a juntada — no momento em que o processo
deveria estar indo para a delegacia. O cliente era mandado reemitir certidão
exatamente ali.

Certidão de antecedentes e comprovante de residência vivem ~30 dias. Processo
que demora dois meses juntando laudo e exame de tiro chega ao protocolo com
metade da papelada fora do prazo.

**Corrigido:** a rotina ganhou a fonte `DOSSIE`. Avisa na virada de faixa, com o
mesmo texto do documento comum e a frase de onde emitir a via nova. Só processo
antes do protocolo, só documento que de fato entra no dossiê, e com trava para
o mesmo papel não avisar duas vezes (Hub + checklist). As travas reativas
continuam de pé — o aviso não substitui a trava.

---

## ✅ QUINTA AUDITORIA (18/08, noite) — a fila destravada não fechava o ciclo

Reconferência de tudo: 18 furos originais + 4 da reauditoria + 4 da terceira + 2
da quarta. Todos fechados. Esta passada foi atrás do risco que a própria
correção anterior criou.

### Ligar um caminho que nunca rodou expõe o que ele nunca fez

A quarta auditoria destravou a Fila de Conferência. Só que
`qa-doc-acao-equipe` — a função que a fila chama — aprovava o documento e
parava ali. O painel do processo, ao aprovar na mão, já disparava duas coisas
que ela não disparava:

1. **`qa-exigencia-pf-checar`** — quando a última exigência de uma notificação
   é cumprida, alguém precisa saber que a delegacia pode ser respondida. Corre
   prazo de 10 dias.
2. **`qa-processo-checar-conclusao-checklist`** — aprovar o último documento é
   o que torna o processo `pronto_para_protocolar`. Sem a chamada, o checklist
   fica 100% e o processo parado, esperando um clique que ninguém sabe que
   precisa dar.

Enquanto a fila estava morta isso era inofensivo — ninguém nunca aprovou nada
por ali. Ligada a fila, viraria buraco vivo no caminho que a equipe mais usa.
Corrigido nos dois caminhos de aprovação (`aprovar` e `aprovar_e_modelar`),
best-effort para não derrubar uma aprovação já gravada.

### Pedir reenvio não avisava o cliente

`rejeitar` mandava e-mail; `solicitar_novo_envio` não — sendo que, para o
cliente, os dois significam a mesma coisa. O item voltava para a fila do guiado
com o motivo escrito, mas só quem entrasse no portal por conta própria
descobriria. Agora avisa.

---

## ✅ QUARTA AUDITORIA (18/08, tarde) — o status fantasma

Reconferência dos 18 furos originais, dos 4 da reauditoria e dos 4 da terceira:
todos fechados. Esta passada olhou o lado da EQUIPE — a fila de conferência — e achou
um furo que estava aberto desde sempre.

### A fila de conferência estava vazia por construção

Quando a IA não tem confiança para decidir, ela grava o documento como
`revisao_humana`. A **Fila de Conferência** — a tela em que a equipe revisa
exatamente isso — filtrava `em_revisao_humana`, com prefixo. **Nenhum código do
sistema escreve essa grafia.** A fila nunca mostrou um único documento.

**Por que passou tanto tempo:** o dicionário de exibição traduz as duas grafias
para "em análise". O documento aparecia certo em toda tela que mostra rótulo. O
erro só existia onde alguém comparava a string crua — e string crua não tem
rótulo para denunciar.

**O efeito era um ponto cego perfeito:**

- o cliente não vê o documento como pendência (correto — a bola não é dele);
- a equipe não o vê em fila nenhuma (a fila estava vazia);
- o checador de conclusão o conta como NÃO cumprido, então o processo nunca
  vira `pronto_para_protocolar`.

Ninguém tem o que fazer e nada anda. Só se descobria abrindo o processo certo e
olhando documento por documento.

**Mesmo defeito em outros quatro lugares:** o contador de "em revisão" do
guiado, o KPI da página de processos, o rótulo da seção de processos do cliente
e o filtro da auditoria — todos comparavam a grafia fantasma e davam sempre
zero.

### O segundo ponto cego: validação de IA que morre no meio

`qa-processo-doc-validar-ia` marca `em_analise` + `processando` **antes** de
chamar o modelo. Se o runtime derruba a função por tempo (PDF grande, modelo
lento), o `catch` que mandaria o documento para revisão humana nunca roda — e a
linha fica `processando` para sempre, no mesmo ponto cego.

A fila passa a mostrar esses casos também, com etiqueta própria
(`VALIDAÇÃO TRAVADA`), separados de "a IA pediu ajuda": ali ninguém decidiu
nada, e aprovar ou rejeitar às cegas seria pior que deixar na fila.

### O que fecha isso para sempre

`src/lib/quero-armas/statusRevisaoHumana.ts` passa a ser o único lugar que sabe
as grafias, e um teste varre `src/` procurando comparação crua com a grafia
fantasma. Se voltar, a suíte quebra.

---

## 🟡 Passivo dos furos 3 e 4 (não é falha — é caso real que falta)

- **Furo 3 sem caso para testar:** hoje não há processo em
  `pronto_para_protocolar`, então a trava do dossiê velho não pôde ser vista em
  operação. Ela se prova no primeiro protocolo real: montar a juntada, aprovar
  qualquer documento depois, e o botão de protocolar tem que recusar.
- **Furo 4 e os três deferidos antigos:** o encerramento automático só dispara
  quando o cliente confirma o recebimento pelo pop-up guiado. Os 3 processos
  deferidos antes da automação (Eduardo, Wilker, Gilberto) não têm documento de
  deferimento registrado, logo não têm o que confirmar — eles se resolvem pela
  pendência de exclusão/fechamento acima, não por este fluxo.

---

## ✅ Reauditoria de 18/08 — o que foi encontrado e fechado

Reconferência dos 18 furos originais: **todos fechados**. A reauditoria achou
mais quatro, dois deles criados pelas próprias correções:

| Achado | Situação |
|---|---|
| DOCX exportava `minuta_gerada`, ignorando a correção do cliente (criado pela F9) | ✅ corrigido |
| Aprovar o último documento não promovia o processo na hora | ✅ corrigido |
| **Segunda verdade:** processo avança e `status_servico` da solicitação fica parado | ✅ gatilho + backfill (`20260818150000`) · conferência voltou **zero linhas** em 18/08 |
| `qa_geracoes_own` era `FOR ALL` — usuário logado podia inserir peça | ✅ `20260818160000` · conferido: 5 policies, sem INSERT/DELETE para `authenticated` |

**Fechado sem código — não era furo:** o `etapaDoTipo` manda tipo desconhecido
para a etapa 1. Conferido na reauditoria: a fila do guiado **não filtra por
etapa**, então o item continua visível ao cliente, e o checador de conclusão
conta todos os obrigatórios independentemente da etapa. Não há travamento nem
invisibilidade — é imprecisão do contador de etapas, cosmética.

---

## ✅ Escopo de ataque — concluído

As 11 frentes foram entregues entre 17 e 18/08/2026. O que resta neste arquivo
são conferências e uma decisão do usuário, não desenvolvimento.

---

## Regras firmadas durante a auditoria

- **Pop-up guiado é o canal do cliente.** Toda comunicação e toda exigência
  passa por ele. Ver mem://constraints/quero-armas-popup-guiado-canal-do-cliente.
- **Deploy de edge function não sai no push.** Lista e comando em
  `docs/DEPLOY-FUNCOES-PENDENTES.md`. Mudança em `_shared` obriga a republicar
  todas as funções que importam o arquivo.

---

## 21/08/2026 — Certidões dos estados dos últimos 5 anos

Regra do titular: quem mudou de estado no período apresenta as certidões de
**cada** estado onde morou (SINARM CAC / SIGMA). Entregue em três migrations
mais o front.

### Decisões que ficaram registradas

- **Código próprio por estado, não a mesma linha com um campo de UF.** Existe
  índice único em `qa_processo_documentos (processo_id, tipo_documento)` desde
  07/08 — o mesmo código duas vezes no mesmo processo é impossível. É também o
  precedente da casa (`comprovante_endereco_ano_2025`).
- **Nada é destruído quando o cliente muda de estado.** O estado antigo vira
  residência anterior e a certidão já entregue é **movida** para a exigência
  daquele estado, com arquivo, datas e status. Fica pendente só a certidão do
  estado novo.
- **O bloco só nasce onde já havia a exigência equivalente.** Serviço que não
  pede certidão estadual não passa a pedir; estado sem Tribunal de Justiça
  Militar não ganha TJM.
- **A federal regional é por REGIÃO.** Estado anterior na mesma região do atual
  não gera certidão extra.

### Comportamento COMPARTILHADO que mudou (avisado antes de aplicar)

| O que | Efeito nos demais documentos |
|---|---|
| `qa_doc_hub_satisfaz_exigencias_processo` passa a usar `qa_processo_relogio_parado` | documento do cofre deixa de reescrever dossiê já protocolado; notificação e recurso religam o relógio |
| botão "Sincronizar checklist em lote" e painel de divergência param de dispensar linha **semeada** | corrige defeito que já existia: os `comprovante_endereco_ano_YYYY` dos serviços 31/44/50/51 deixam de virar "não aplicável" |
| `qa_guard_pergunta_sem_resposta` conhece a pergunta nova | acréscimo puro, um tipo a mais na lista |
| CHECK `qa_doc_cliente_tipo_check` ganha 117 códigos | acréscimo puro: nenhum tipo existente sai |

### Conferido em produção — 21/08/2026, 19:25–19:52 BRT

As três migrations aplicadas, e as sete conferências:

| Conferência | Resultado |
|---|---|
| trava de estado dentro do motor de reaproveitamento | 1 ✅ |
| certidões espelhadas no cofre pelo backfill | **0 — correto**: existem só 2 certidões aprovadas no checklist e as 2 já estavam no cofre, com o mesmo arquivo e o mesmo tipo. Vieram do cofre para o processo, não o contrário — não havia o que espelhar. O espelho passa a valer para o que o cliente subir a partir de agora |
| pergunta no catálogo | serviços 31, 44, 50 e 60. O 51 ficou de fora porque não tem certidão estadual no catálogo — a trava "só onde a exigência já existia" funcionou |
| patches textuais (exploder, botão, painel) | as 3 funções ✅ |
| pergunta nos processos abertos | 50 → 1, 60 → 9. Bate exatamente com os processos existentes (50: 2, sendo 1 com relógio andando; 60: 10, sendo 9). Não existe processo de 31, 44 ou 51 |
| carimbo de estado nas certidões já entregues | 36 de 36 ✅ |
| tipos aceitos no cofre | 223 ✅ |
| gatilhos | os 7 novos existem e o destrutivo (`qa_trg_mudanca_de_estado_reabre_certidoes`) sumiu ✅ |
| edge function `qa-cadastro-publico` | publicada 19:52 BRT ✅ |

**Defeito próprio encontrado na conferência e corrigido** (`20260821100000`): a
pergunta nasceu com `depende_de: {documento: 'comprovante_residencia'}`, mas o
motor do checklist só entende `depende_de: {chave, valor}` — a chave era inerte
e nunca escondeu nada. Retirada. A ordem "comprovante primeiro, pergunta depois"
continua garantida pela ordem dentro do grupo endereço (40 → 45), pelo popup
guiado que apresenta um item por vez, e pela ordem física das etapas do
formulário público.

### Correção de rumo — 21/08/2026, 20:30 BRT

O titular reviu onde a pergunta mora: **não é no formulário público**. Aquele é
o formulário do CHECKOUT e é o único que existe, então já carrega tudo; pedir
ali o histórico de endereços dos últimos cinco anos, antes de a pessoa ser
cliente e antes de qualquer comprovante, é fora de hora. A regra é: a pergunta
vem **depois que o cliente manda o comprovante de endereço**, e vale para
**clientes CAC**.

Removido (`20260821110000` + front + edge function):
- o bloco da pergunta e da lista de estados no formulário público;
- as duas chaves no Zod de `qa-cadastro-publico`;
- as duas colunas de `qa_cadastro_publico` e os dois gatilhos que as copiavam.

A migration confere antes de remover e ABORTA se alguma ficha já tiver resposta
gravada — as colunas viveram menos de uma hora e estão vazias.

Continua de pé, intacto: a tabela `qa_cliente_enderecos_anteriores`, a resposta
em `qa_clientes.residiu_mesmo_endereco_5_anos`, o semeador dos blocos por
estado, a pergunta no checklist e os cinco gatilhos da regra.

### A porta da equipe — 21/08/2026

*"Pode pendurar isso no admin também para nós podermos cumprir essas exigências
para o cliente caso seja necessário."*

`ClienteEnderecosAnteriores` entra no cadastro do cliente, logo abaixo de
"Endereço Principal": a equipe marca se o cliente morou sempre no mesmo
endereço e, quando não, lança os estados e cidades. Gravar dispara o gatilho que
semeia as certidões nos processos abertos — a tela não monta nada por conta
própria.

Duas regras que a tela respeita, e que têm teste:
- a identidade da linha é a mesma do índice único do banco (cliente, UF, cidade
  normalizada), senão salvar apagaria a linha errada;
- marcar "sempre o mesmo endereço" retira o que foi **declarado** e preserva o
  que o sistema registrou numa mudança de endereço real — mudança é fato,
  declaração é o que a pessoa disse. É a mesma regra do gatilho do checklist.

### O alcance da regra, fechado — 21/08/2026

*"Autorização de compra / posse de arma de fogo não usa comprovante de 5 anos de
endereço. Só o atual."*

Serviço **60** é exatamente esse, e ele nunca esteve na regra: o semeador
`qa_seed_endereco_5_anos` cobre apenas 31, 44, 50 e 51 desde junho. Na leva 18 eu
coloquei a pergunta em todo serviço que pedisse certidão estadual, e isso
alcançou o 60 por engano — nove processos abertos receberam pergunta que não
deviam.

`20260821120000` fecha o alcance e o torna explícito:
- `qa_servico_usa_residencia_5_anos(servico_id)` diz a lista por extenso, e o
  semeador das certidões e o catálogo passam a ler a MESMA função;
- a pergunta sai do catálogo e dos processos do 60;
- linha intocada é apagada (nasceu de engano); linha com qualquer rastro vira
  `nao_aplicavel` com a razão escrita — nunca se apaga o que alguém tocou;
- bloco de certidão que já carrega documento entregue **permanece**: apagar
  seria jogar fora certidão do cliente. A conferência (D) lista os que
  sobrarem, para a equipe decidir caso a caso.

**Ponto de manutenção:** a lista existe em dois lugares — aqui e dentro de
`qa_seed_endereco_5_anos`. A conferência (E) da migration compara as duas e
acusa se divergirem.

### O critério virou a categoria do serviço — 21/08/2026

A conferência contra o banco derrubou a lista `IN (31, 44, 50, 51)` que eu tinha
escrito em `20260821120000`, por dois motivos independentes:

- **o serviço 31 não existe.** Não há linha dele em `qa_servicos_catalogo` — só
  sobraram documentos de catálogo órfãos apontando para esse id;
- **a lista viva de `qa_seed_endereco_5_anos` é `(31, 44)`,** não
  `(31, 44, 50, 51)`. Ancorei numa função que está desatualizada em produção.

`20260821130000` troca a régua pela coluna que o catálogo já tem:
`categoria = 'SINARM CAC'` contra `'POLÍCIA FEDERAL'`. Não envelhece, não vive
em dois lugares, e é literalmente o que o titular disse ("clientes CACs").

A dupla trava se mantém: além de ser CAC, o serviço precisa **já** pedir a
certidão estadual de antecedentes. Alcance conferido antes de aplicar — 32 e 33
entram, 34 e 45 se excluem sozinhos, 44 e 50 continuam, 31/59/60 saem.

### Três achados que NÃO foram corrigidos (não é o que foi pedido)

| Achado | Situação |
|---|---|
| **Serviço 31 não existe** no catálogo, mas tem documentos de catálogo órfãos apontando para ele | a pergunta dos 5 anos saiu de lá; o resto dos órfãos continua |
| **A migration `20260618050000` nunca chegou ao banco.** A lista viva de `qa_seed_endereco_5_anos` é `(31, 44)` — os serviços **50 e 51** não recebem os cinco comprovantes de endereço por ano desde junho, só o atual | intocado |
| **O serviço 51 (Autorização de Compra Caçador) não pede certidão estadual de antecedentes**, sendo o gêmeo do 50, que pede | intocado — por isso ele não entrou na regra dos 5 anos |

### Decisões e correções que esperam VOCÊ (não são bugs, são escolhas)

| # | Assunto | O que se sabe | Por que não mexi |
|---|---|---|---|
| 1 | **Serviço 31 não existe** no catálogo, mas deixou documentos de catálogo órfãos apontando para esse id | a pergunta dos 5 anos já saiu de lá pela `130000`; os outros documentos órfãos continuam | limpar catálogo órfão é faxina de escopo próprio, não foi pedido |
| 2 | ~~**A migration `20260618050000` nunca chegou ao banco** — 50 e 51 sem os cinco anos~~ | **RESOLVIDA em 22/08** pela `20260822020000`: lista vira `(44, 50, 51)` e o ano corrente não é semeado onde o catálogo já pede o comprovante atual | — |
| 3 | **Serviço 51 — Autorização de Compra Caçador (SINARM CAC) — não pede certidão estadual de antecedentes**, sendo o gêmeo do 50, que pede | por isso ele não entrou na regra dos 5 anos, mesmo sendo CAC | é buraco no catálogo do 51; corrigir acrescenta exigência a processos vivos |
| 4 | **Serviço 59 — CRAF e GT / Posse (Polícia Federal) — está com checklist VAZIO** — qualquer processo dele nasce sem exigência nenhuma | achado de 21/08, antes desta leva | depende de você dizer o que aquele serviço deve pedir |
| 5 | **O cliente que JÁ é cliente não tem tela para listar os estados** onde morou. Ele responde sim/não no checklist do portal; a lista de estados só existe no admin, para a equipe | componente pronto e reutilizável: `EnderecosAnterioresLista` | falta decidir se o cliente declara sozinho ou se a equipe lança sempre |

### 22/08/2026 — o catálogo órfão do serviço 31 foi apagado

Decisão do titular: "Apagar". Era o catálogo antigo de POSSE DE ARMA DE FOGO
(dossiê civil pela PF), substituído pelo 60 e pelo 59. Estava órfão de verdade:
sem linha em `qa_servicos_catalogo` e sem nenhum processo apontando para ele.

`20260822010000` apaga só a CONFIGURAÇÃO (o desenho do serviço) e **aborta** se
encontrar qualquer registro transacional — processo, item de venda, protocolo,
procuração, solicitação ou rascunho — apontando para o 31. Também aborta se o
serviço voltar a existir no catálogo. História não se apaga por engano.

### 22/08/2026 — os 5 anos de endereço chegam à Autorização de Compra CAC

Item 2 da lista de decisões, atacado a pedido do titular. `20260822020000`.

O achado se confirmou e ficou pior do que parecia: a lista viva de
`qa_seed_endereco_5_anos` é `(31, 44)`; o **31 foi apagado ontem** e o **44 não
tem processo nenhum**. Ou seja, o semeador dos cinco anos **nunca rodou para
cliente nenhum** — é código morto em produção desde maio.

Trocar só a lista não bastava. O 50 e o 51 pedem `comprovante_residencia`
("Comprovante de residência atual") no próprio catálogo; o 44 não pede. Semear
os cinco anos sem mais nada faria o cliente do 50/51 ver o comprovante do ano
corrente **duas vezes**.

Por isso o semeador mudou em dois pontos — e os dois são **comportamento
compartilhado**, avisados antes de aplicar:

- a lista passa de `(31, 44)` para `(44, 50, 51)`;
- o ano corrente **não é semeado** quando o processo já exige
  `comprovante_residencia`. Isso nunca tira documento de ninguém: só impede que
  o mesmo comprovante nasça duas vezes. O 44 não tem essa linha no catálogo e
  segue recebendo os cinco anos, o corrente inclusive.

Alcance medido em 21/08: **um** processo vivo de serviço 50 ganha quatro anos
anteriores. O outro processo do 50 está com o relógio parado e não é tocado. Os
serviços 44 e 51 não têm processo.

Provado em PostgreSQL 16 local antes de entregar: lista nova; 44 com cinco anos
incluindo o corrente; 50 e 51 com quatro anos sem o corrente; relógio parado,
cliente LGPD, cliente excluído, serviço fora da lista e processo sem checklist
intocados; zero duplicata do ano corrente; gatilhos religados e sem disparo no
backfill; reexecução não cria nada; e aborto se a lista viva não for a esperada.

### Ainda aberto

- **Onde o cliente que já é cliente declara os estados.** O formulário público
  já tem a pergunta e a lista. No portal, a pergunta
  `pergunta_residencia_5_anos` aparece no checklist, mas a lista de estados
  ainda não tem tela própria — hoje a equipe lança em
  `qa_cliente_enderecos_anteriores`. Componente pronto e reutilizável:
  `src/components/quero-armas/EnderecosAnterioresLista.tsx`.
- **Serviço 59 — CRAF e GT / Posse (Polícia Federal) — segue com checklist vazio** — decisão do titular,
  aberta desde 21/08.
