# Dispensas por categoria: carimbo legal no checklist + rota SINARM × SIGMA

## Correção do exemplo anterior

O exemplo com Guarda Civil Municipal estava errado e sai do plano. A GCM **não** é caso de dispensa automática de laudo psicológico e de capacidade técnica: o que ela tem é a **via institucional** (laudo emitido pela própria corporação) — é o modo "Alternativo", não "Dispensado".

Além disso, militar das Forças Armadas da ativa não é caso de dispensa dentro do SINARM: ele simplesmente **não registra arma no SINARM**, registra no SIGMA (Exército). Ou seja, não é "exigência dispensada", é **serviço errado** — precisa de um desvio de rota, não de um carimbo.

## Como o motor passa a raciocinar (três respostas possíveis, não duas)

Para cada exigência, dada a categoria/corporação do cliente:

```text
EXIGIDO       → passo normal, cliente entrega o documento
ALTERNATIVO   → passo normal, mas aceita a via institucional
                (ex.: GCM/PM/PC com laudo da própria corporação)
DISPENSADO    → passo aparece já cumprido, com carimbo + base legal
```

E, antes de tudo isso, uma quarta saída no nível do **serviço**:

```text
FORA DE ESCOPO (SIGMA) → o cliente não deveria estar neste processo;
                          o sistema avisa e oferece a rota correta (Exército/CR)
```

## Base legal que sustenta cada estado

- **Lei 10.826/03, art. 6º** — lista taxativa de quem tem porte funcional (PF, PRF, Polícia Ferroviária Federal, Polícia Civil, Polícia Militar, Corpo de Bombeiros Militar, Polícia Penal, agentes penitenciários, ABIN, guardas municipais nas faixas populacionais previstas, entre outros).
- **Lei 10.826/03, art. 6º, §1º-A** — os integrantes dessas instituições, para o porte, não se submetem à comprovação de capacidade técnica e de aptidão psicológica exigida do cidadão comum, porque essa aferição já é feita pela própria corporação.
- **Lei 10.826/03, art. 4º, III, e §2º** — para o cidadão comum, capacidade técnica e aptidão psicológica são atestadas por instrutor e psicólogo credenciados pela PF.
- **Portaria Conjunta / normativo de exames institucionais** — permite que o servidor de segurança pública use o laudo da própria instituição no lugar do credenciado PF (base do modo "Alternativo").
- **Lei 10.826/03, art. 3º, parágrafo único, e Decreto 11.615/23** — armas de integrantes das Forças Armadas e das instituições ali indicadas são registradas no **SIGMA (Exército)**, não no SINARM. Daí a saída "fora de escopo".
- **LC 35/79, art. 33, V (LOMAN) e Lei 8.625/93, art. 42** — porte de magistrados e membros do MP por lei orgânica, sem os exames do cidadão comum.

Nada disso é chumbado no código: **cada linha da matriz guarda a base legal em texto**, e é esse texto que vai para o carimbo. Antes de ativar, você revisa a matriz inteira em Configurações — o sistema entrega um rascunho e você confirma linha a linha.

## Parte 1 — Passo dispensado continua no checklist, com carimbo

O passo não some. Ele abre já cumprido:

```text
  EXAME DE APTIDÃO PSICOLÓGICA
  ┌──────────────────────────────────────────────┐
  │  DISPENSADO POR LEI                          │
  │  Lei 10.826/03, art. 6º, §1º-A               │
  │  Servidor de segurança pública — Polícia Civil│
  └──────────────────────────────────────────────┘
  A aferição psicológica da sua corporação supre
  esta exigência. Já marcamos como cumprido no
  seu processo — você não precisa entregar nada.

                          [  AVANÇAR  ]
```

- Carimbo no padrão visual dos carimbos já existentes, com "DISPENSADO POR LEI" + base legal + categoria que gerou a dispensa.
- Item entra no processo já cumprido: conta como concluído nas barras de progresso do cliente e do admin, sem pendência acionável.
- Botão único **AVANÇAR** — sem upload.
- Mesmo carimbo aparece na linha do tempo do admin, com a base legal e o registro de qual regra dispensou.

## Parte 2 — Passo alternativo (via institucional)

Quando o modo é "Alternativo", o passo continua exigindo entrega, mas com dois caminhos no rodapé:

```text
[  NÃO — FAZER COM CREDENCIADO DA PF  ]  [  ENTREGAR DOCUMENTO  ]
```

- "ENTREGAR DOCUMENTO": o cliente anexa o laudo da própria corporação.
- "NÃO": registra a resposta e abre, no mesmo pop-up, a lista de psicólogos e instrutores credenciados pela PF.
- Isso vale para servidor de segurança pública em geral (PM, PC, Penal, Bombeiros, GCM), não só GCM.

## Parte 3 — Saída "fora de escopo" (SIGMA)

Se a categoria for militar das Forças Armadas da ativa (ou outro caso marcado como SIGMA) e o serviço contratado for de SINARM (posse/porte na PF), o pop-up guiado abre uma tela de aviso antes do checklist explicando que o registro daquela arma corre no Exército, com a base legal e o encaminhamento para o serviço de CR/SIGMA. O processo não é apagado — fica sinalizado para a equipe.

## Parte 4 — Configurações: matriz "Categoria × Exigência"

Nova aba **Dispensas e exigências por categoria**.

- Linhas: as categorias já existentes no sistema (cidadão comum, servidor de segurança pública com desdobramento por corporação, magistrado/MP, militar das FFAA, PJ) — a corporação vem do cadastro do cliente.
- Colunas: os grupos/exigências do checklist (Identificação, Endereço, Ocupação, Idoneidade, Habitualidade, Efetiva necessidade, Laudos, Arma, Requerimento).
- Cada cruzamento: **Exigido / Alternativo / Dispensado**, e no nível da categoria um marcador **Registro: SINARM ou SIGMA**.
- Toda célula marcada como Dispensado ou Alternativo exige o texto de **base legal**, que é exatamente o que o cliente lê no carimbo.
- Filtro por serviço (uma dispensa pode valer para posse e não para porte) e opção "vale para todos".
- Botão **Simular** abre o Simulador de Checklist já com a categoria escolhida, mostrando o resultado final antes de salvar.

## Parte 5 — Correção da pergunta SIM/NÃO dos laudos

Confirmado nos dados: no catálogo do serviço 60 a linha `exames_instituicao_definir` tem `tipo: pergunta`, `chave: exames_instituicao` e as duas opções; no processo do Anthony a mesma linha ficou com regra genérica, sem `tipo` e sem as condicionais. Por isso aparece "ENTREGAR DOCUMENTO" e as duas trilhas de laudo contam juntas (5 itens em vez de 2).

1. A função que aplica a condição profissional passa a preservar a regra do catálogo (`tipo`, `chave`, `opcoes`, `ajuda`, `exige_quando`, `dispensa_quando`, etapa e ordem).
2. Backfill dos processos já criados, sem tocar em documentos aprovados ou já enviados.
3. Fallback no portal: exigência sem configuração de pergunta usa a regra do catálogo carregada em memória.

## Detalhes técnicos

- Migração: `public.qa_regras_categoria` (`servico_id` nullable, `categoria`, `corporacao` nullable, `grupo_id`/`tipo_documento`, `modo` em exigido/alternativo/dispensado, `base_legal`, `registro` em sinarm/sigma, `ativo`), com GRANTs para `authenticated` e `service_role`, RLS de leitura para autenticados e escrita só para administradores. Seed em rascunho, inativo até revisão.
- `supabase/functions/qa-processo-set-condicao/index.ts`: mesclar `regra_validacao` do catálogo (`{ ...regraCatalogo, exige, label_botao, checklist_operador }`), respeitar `etapa`/`ordem`, e aplicar a matriz gravando `status = 'dispensado'` + `regra_validacao.dispensa = { base_legal, categoria }` nos itens dispensados; registrar em `qa_processo_eventos`.
- Migração de dados separada para o backfill de `regra_validacao` nos processos pendentes.
- `PendenciasGuiadasPopup.tsx`: novo estado de passo dispensado (carimbo + AVANÇAR) reusando `DocResultadoCarimbo`; rodapé duplo no modo alternativo abrindo `AgendarExameModal` inline; tela de aviso SIGMA antes do checklist.
- `QAClientePortalPage.tsx`: contar itens dispensados como cumpridos, tratar `dispensa_quando` como ramo exclusivo (hoje só `exige_quando`), passar categoria/corporação ao pop-up.
- `src/components/quero-armas/clientes/categoriaTitular.ts`: a matriz fixa atual vira fallback; a fonte passa a ser a tabela. Hoje esse arquivo marca `seguranca_publica` como dispensada de laudo e exame — o que a matriz vai refinar por corporação e por serviço.
- `QAConfiguracoesPage.tsx` + novo componente de matriz, reaproveitando `pendenciasGrupos.ts` e `CONDICOES_CHECKLIST`.

## Verificação

- Cliente de Polícia Civil: laudos aparecem dispensados, com carimbo e base legal, e o progresso fecha sem pendência.
- Cliente GCM: rodapé com NÃO + ENTREGAR; ao clicar NÃO, credenciados PF abrem no mesmo pop-up.
- Militar da ativa em serviço SINARM: tela de aviso SIGMA antes do checklist.
- Cidadão comum: nada muda.
- Processo do Anthony volta a ter `tipo: pergunta` e o grupo Laudos mostra 2 itens.
