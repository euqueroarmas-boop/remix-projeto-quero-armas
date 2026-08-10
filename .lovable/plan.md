# Pergunta SIM/NÃO dos laudos não aparece para Segurança Pública

## O que está acontecendo

Quando o cliente escolhe a condição profissional "Segurança Pública", o sistema copia as exigências do catálogo para o processo dele — mas nessa cópia ele **descarta a configuração de pergunta**. O item "exames da instituição", que no catálogo é uma pergunta SIM/NÃO, chega no processo do cliente como se fosse mais um documento para anexar.

Resultado no portal do Anthony (processo do serviço 60):
- o passo aparece com o botão "ENTREGAR DOCUMENTO" em vez dos botões SIM / NÃO;
- os dois caminhos de laudo (instituição e credenciado PF) ficam abertos ao mesmo tempo, porque a resposta que dispensaria um deles nunca é registrada;
- por isso o grupo Laudos exibe 5 itens, sendo que só 2 laudos são entregues.

Confirmado nos dados: no catálogo (serviço 60) a linha `exames_instituicao_definir` tem `tipo: pergunta`, `chave: exames_instituicao` e as duas opções; no processo do cliente a mesma linha ficou com uma regra genérica (`exige`, `label_botao`), sem `tipo`, sem `opcoes` e sem as condições `exige_quando` / `dispensa_quando`.

## Correção proposta

1. **Preservar a regra do catálogo na criação das exigências**
   Na função que aplica a condição profissional, em vez de sobrescrever a regra de validação com um objeto fixo, mesclar: manter tudo que veio do catálogo (`tipo`, `chave`, `opcoes`, `ajuda`, `exige_quando`, `dispensa_quando`, `grupo_checklist`, `ordem_grupo_checklist`) e apenas complementar com os campos operacionais (`exige`, `label_botao`, `checklist_operador`). Também respeitar `etapa` e `ordem` do catálogo, para o item cair no grupo Laudos e na posição certa, em vez de virar "complementar / ordem 100".

2. **Corrigir os processos já criados (backfill)**
   Migração que reescreve a regra de validação das exigências já materializadas a partir do catálogo correspondente (mesmo serviço + mesmo tipo de documento), sem tocar em documentos já aprovados ou enviados. Isso conserta o Anthony e qualquer outro cliente de Segurança Pública na mesma situação.

3. **Rede de segurança no portal**
   Se a exigência do processo vier sem a configuração de pergunta, o portal passa a usar como fallback a regra do catálogo já carregada em memória (mesmo serviço + tipo). Assim, um dado antigo ou uma nova rota de criação não volta a esconder a pergunta.

4. **Contagem do grupo respeitando as duas formas de condicional**
   A contagem por grupo já deixou de somar trilhas exclusivas marcadas com `exige_quando`; incluir também `dispensa_quando` (usado pelos laudos particulares), para o grupo Laudos mostrar "0 de 2" mesmo antes da resposta.

## Detalhes técnicos

- `supabase/functions/qa-processo-set-condicao/index.ts`: `base = catalogo.map(...)` passa a carregar `regra_validacao` original, `etapa` e `ordem`; o `insert` usa `{ ...regraCatalogo, exige, label_botao, checklist_operador }` e `etapa/ordem` do catálogo com fallback para o comportamento atual.
- Migração SQL: `UPDATE qa_processo_documentos d SET regra_validacao = s.regra_validacao || jsonb_build_object(...campos operacionais atuais...)` a partir de `qa_servicos_documentos s` (join por `servico_id` do processo + `tipo_documento`, `s.ativo`), restrita a `d.status = 'pendente'`.
- `src/pages/quero-armas/QAClientePortalPage.tsx`: no cálculo de `perguntasPendentes` e das pendências, ler `regra_validacao` do doc do processo com fallback em `catalogoDocInfo` (que já é carregado com `regra_validacao`); no `resumoProcesso`, tratar `dispensa_quando` como ramo exclusivo, igual a `exige_quando`.

## Verificação

- Reconsultar o processo do Anthony: a linha `exames_instituicao_definir` deve voltar com `tipo: pergunta` e opções.
- No portal: o passo dos laudos deve mostrar os botões SIM / NÃO (sem "ENTREGAR DOCUMENTO"), e o grupo Laudos deve exibir 2 itens.
- Responder NÃO deve continuar abrindo o botão "Escolher profissional credenciado"; responder SIM deve dispensar os laudos particulares.
