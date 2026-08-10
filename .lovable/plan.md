# Laudos: botão dividido (NÃO / Entregar) + matriz de dispensas por profissão

## Parte 1 — Por que a pergunta SIM/NÃO não aparece hoje

Quando o cliente escolhe a condição profissional "Segurança Pública", o sistema copia as exigências do catálogo para o processo dele, mas descarta a configuração de pergunta. O item "exames da instituição", que no catálogo é uma pergunta SIM/NÃO, chega no processo como se fosse mais um documento para anexar.

Confirmado nos dados: no catálogo do serviço 60 a linha `exames_instituicao_definir` tem `tipo: pergunta`, `chave: exames_instituicao` e as duas opções; no processo do Anthony a mesma linha ficou com uma regra genérica, sem `tipo`, sem `opcoes` e sem as condicionais. Por isso aparece "ENTREGAR DOCUMENTO" e os dois caminhos de laudo ficam abertos ao mesmo tempo (5 itens em vez de 2).

Correções:
1. Na função que aplica a condição profissional, preservar a regra do catálogo (`tipo`, `chave`, `opcoes`, `ajuda`, `exige_quando`, `dispensa_quando`, grupo e ordem do grupo), complementando apenas com os campos operacionais. Respeitar também etapa e ordem do catálogo.
2. Backfill dos processos já criados: reescrever a regra das exigências pendentes a partir do catálogo correspondente, sem tocar em documentos aprovados ou já enviados.
3. Rede de segurança no portal: se a exigência vier sem configuração de pergunta, usar como fallback a regra do catálogo já carregada em memória.

## Parte 2 — Rodapé com dois botões

No passo dos laudos, o rodapé do pop-up guiado passa a ter dois botões lado a lado:

```text
[  NÃO — FAZER COM CREDENCIADO DA PF  ]  [  ENTREGAR DOCUMENTO  ]
```

- "NÃO" registra a resposta `exames_instituicao = nao` e, no mesmo pop-up, abre a lista de psicólogos e instrutores credenciados pela PF mais próximos (componente de agendamento que já existe), sem navegar para outra tela.
- "ENTREGAR DOCUMENTO" mantém o fluxo atual: registra a resposta SIM e segue para o envio dos atestados da instituição.
- Depois de respondido, o rodapé volta ao botão único do documento correspondente — o resto do fluxo permanece igual.

Visibilidade: esse rodapé duplo só aparece quando a exigência é da trilha de segurança pública e a corporação do cliente é Guarda Civil Municipal. Para as demais corporações (PM, PC, Penal, Bombeiros, SSP) e para o cidadão comum, o comportamento continua o de hoje. A corporação sai do cadastro do cliente; se ela não estiver preenchida, o pop-app mantém o rodapé padrão para não esconder caminho de ninguém.

## Parte 3 — Configurações: matriz "Profissão × Grupos dispensados"

Nova aba **Dispensas por profissão** em Configurações, ao lado de "Checklist" e "Simulador".

Como funciona, na prática:
- Uma tabela com as categorias profissionais nas linhas (Guarda Civil Municipal, Polícia Militar, Polícia Civil, Polícia Penal, Bombeiros, SSP, Militar das Forças Armadas, Magistrado/MP, Cidadão comum) e os grupos do checklist nas colunas (Identificação, Endereço, Ocupação, Idoneidade, Habitualidade, Efetiva necessidade, Laudos, Arma, Requerimento).
- Cada cruzamento tem três estados: **Exigido** (padrão), **Dispensado** (o grupo inteiro sai do checklist daquela profissão) e **Alternativo** (o grupo continua, mas aceita a via institucional — é o caso dos laudos da GCM).
- Filtro por serviço no topo, porque uma dispensa pode valer só para posse e não para porte. Existe também a opção "vale para todos os serviços".
- Cada linha marcada pede uma **base legal** em texto curto, que é o mesmo texto exibido ao cliente no pop-up guiado explicando por que aquele grupo não é pedido.
- Botão "Simular" abre o Simulador de Checklist já com a profissão escolhida, mostrando o checklist final antes de salvar.

Efeito no cliente: ao definir a condição profissional, o processo passa a marcar como não aplicáveis os grupos dispensados dessa profissão, com registro em auditoria de qual regra dispensou o quê. Nada é apagado — os itens ficam com status de dispensa e a justificativa legal fica anexada ao processo.

## Detalhes técnicos

- `supabase/functions/qa-processo-set-condicao/index.ts`: mesclar `regra_validacao` do catálogo no insert (`{ ...regraCatalogo, exige, label_botao, checklist_operador }`) e usar `etapa`/`ordem` do catálogo; aplicar as dispensas da nova matriz marcando os itens dos grupos dispensados com `status = 'nao_aplicavel'` e motivo.
- Migração: tabela `public.qa_dispensas_profissao` (`servico_id` nullable = todos, `condicao_profissional`, `grupo_id`, `modo` em exigido/dispensado/alternativo, `base_legal`, `ativo`), com GRANTs para `authenticated`/`service_role`, RLS de leitura para autenticados e escrita só para administradores. Migração de dados separada para o backfill de `regra_validacao` nos processos pendentes.
- `PendenciasGuiadasPopup.tsx`: rodapé condicional com dois botões quando `active.kind === "pergunta"` e `perguntaChave === "exames_instituicao"` e a corporação do cliente for GCM; "NÃO" chama `onResponder("nao")` e abre `AgendarExameModal` inline.
- `QAClientePortalPage.tsx`: passar a corporação/condição do cliente ao pop-up; fallback de `regra_validacao` via `catalogoDocInfo`; no `resumoProcesso`, tratar `dispensa_quando` como ramo exclusivo (hoje só `exige_quando` é tratado), para o grupo Laudos contar 2 e não 5.
- `QAConfiguracoesPage.tsx` + novo componente de matriz, reaproveitando os grupos de `pendenciasGrupos.ts` e as condições profissionais já usadas no catálogo.

## Verificação

- Processo do Anthony volta a ter `tipo: pergunta` na linha dos exames e o grupo Laudos mostra 2 itens.
- Cliente GCM: rodapé com NÃO + ENTREGAR; ao clicar NÃO, a lista de credenciados abre no mesmo pop-up.
- Cliente de outra corporação: rodapé inalterado.
- Marcar um grupo como Dispensado em Configurações e simular: o grupo some do checklist daquela profissão, com a base legal exibida.
