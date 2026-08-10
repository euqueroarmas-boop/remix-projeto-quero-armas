# Projeção canônica do fluxo: cliente e Equipe Quero Armas

## Diagnóstico confirmado no Mizael

Os dois prints estão lendo o mesmo processo, mas não a mesma semântica:

| Fonte | Resultado atual | Como chegou nele |
|---|---:|---|
| Área do cliente | **24 de 32**; Efetiva Necessidade **7 de 11**; **10** reconhecidos do histórico | Conta as 22 exigências obrigatórias como caminho do processo, considera aprovado/dispensado/reaproveitado/não aplicável como concluído e substitui 1 item de Efetiva Necessidade por 11 passos |
| Painel da Equipe | **8 de 16**; **16 dispensados**; fase CADASTRO | Exclui dispensados e reaproveitados do total, chama apenas `aprovado` de entregue e tenta reconstruir fase/próximo item com regex SQL própria |

No banco, o processo de Mizael possui **22 exigências**: 1 aprovada, 10 reaproveitadas, 6 dispensadas por grupo e 5 com status pendente. A Efetiva Necessidade possui **7 de 11 passos concluídos**. Portanto, na régua que o cliente vê: `22 + 10 passos extras = 32` e `17 exigências resolvidas + 7 passos = 24`.

Há ainda um erro interno no portal: “Qual a profissão do titular do comprovante?” permanece no resumo porque está `pendente`, mas sua condição exige comprovante em nome de terceiro; Mizael respondeu que o comprovante está no próprio nome. A fila visual oculta a pergunta, porém o totalizador atual não aplica o mesmo filtro.

## Princípio da correção

Não manter dois motores nem copiar o resultado visual do cliente para o admin. Criar **uma projeção canônica de leitura**, alimentada pelos dados persistidos, e fazer as duas áreas consumirem o mesmo contrato.

```text
processo + exigências + respostas + catálogo + efetiva necessidade + pré-requisitos
                                  |
                                  v
                       PROJEÇÃO CANÔNICA ÚNICA
                                  |
                 +----------------+----------------+
                 v                                 v
          Área do cliente                  Equipe Quero Armas
```

## Implementação

### 1. Definir o contrato semântico único

Para cada processo ativo, a projeção retornará:

- `total`: tamanho real do caminho exibido ao cliente, incluindo passos compostos da Efetiva Necessidade;
- `concluidos`: itens resolvidos na mesma régua do cliente;
- `documentos_pendentes`, `perguntas_pendentes` e `em_analise`;
- `reaproveitados`: somente documentos reconhecidos do histórico;
- `grupo_atual`, `grupo_total`, `grupo_concluidos`;
- `proximo_item`, `proximo_tipo` e `fase`, todos derivados do primeiro item realmente acionável;
- `bloqueado_por_prerequisito`, para processos como CRAF/GT que aguardam a Autorização de Compra;
- `ultima_atividade` e `dias_parado`.

Os nomes visíveis passam a ser **CONCLUÍDOS**, **PENDENTES**, **EM ANÁLISE** e **REAPROVEITADOS**. “Entregues” não será usado como sinônimo de concluído.

### 2. Centralizar as regras de conjunto e aplicabilidade

Uma única tabela de decisão resolverá, nesta ordem:

1. processo liberado ou bloqueado por pré-requisito;
2. item obrigatório e aplicável conforme `depende_de`, `exige_quando` e `dispensa_quando`;
3. família canônica do status: concluído, em análise, pendente ou reprovado;
4. tipo do item: documento, pergunta, pergunta composta ou etapa sintética;
5. expansão da Efetiva Necessidade em 11 passos persistidos;
6. grupo e ordem vindos do catálogo, com fallback canônico apenas quando o catálogo não definir;
7. primeiro item acionável, que determina fase e próxima ação.

Itens condicionais inativos não serão próximos passos nem perguntas pendentes. Itens já dispensados/reaproveitados continuam compondo o caminho histórico e contam como concluídos, exatamente como no portal, mas sua origem fica identificada separadamente.

### 3. Substituir a função divergente do painel

Reescrever `public.qa_painel_progresso_clientes()` como projeção da regra canônica, removendo:

- exclusão de dispensados/reaproveitados do denominador;
- contagem de apenas `aprovado` como progresso;
- regex paralela para adivinhar fase;
- prioridade baseada no prefixo do último documento;
- seleção de perguntas cuja condição não está ativa.

Preservar temporariamente os campos antigos necessários à compatibilidade, mas fazer `total_docs`/`entregues` espelharem `total`/`concluidos` até os consumidores serem migrados. A função continuará protegida para uso da equipe.

### 4. Fazer o portal consumir a mesma projeção

- Extrair o cálculo hoje embutido em `QAClientePortalPage.tsx` para um helper canônico testável.
- Aplicar a mesma resolução de visibilidade usada pela fila ao resumo do rodapé.
- Manter o comportamento transitório de voltar etapas no modal: a navegação pode limitar visualmente os passos futuros, sem alterar o progresso persistido visto pela equipe.
- Usar a projeção nos resumos de processo e no `PendenciasGuiadasPopup`, eliminando listas locais de status e cálculos paralelos.

### 5. Espelhar no painel e nos detalhes da equipe

- `DashboardProgressoClientes.tsx` exibirá os mesmos `concluidos/total`, grupo/fase e próximo item que o cliente vê.
- Para Mizael, o resultado esperado é **24/32**, grupo **EFETIVA NECESSIDADE**, **7/11** no grupo e **10 REAPROVEITADOS**; a pergunta sobre profissão do titular não poderá aparecer enquanto a condição de terceiro estiver inativa.
- O drawer/detalhe do processo usará a mesma projeção, evitando que o dashboard esteja correto e a ficha interna continue divergente.
- Processos dependentes não somem: aparecem como **AGUARDANDO ETAPA ANTERIOR**, sem poluir a fila acionável.

### 6. Alinhar alertas de inatividade

`qa-inatividade-cobranca` passará a usar `documentos_pendentes`, `perguntas_pendentes` e `proximo_item` da projeção. Assim, não enviará “faltam X documentos” usando diferença matemática que mistura perguntas, dispensas e passos compostos.

## Validação e proteção contra regressão

- Criar testes de conjunto para: aprovado, reaproveitado, dispensado por grupo, não aplicável, em análise, reprovado e pendente.
- Criar testes de condição para comprovante próprio versus imóvel de terceiro.
- Criar teste da Efetiva Necessidade com 11 passos e diferentes estados de BO.
- Criar cenário de regressão equivalente ao Mizael: **24/32**, **7/11**, **10 reaproveitados**, próxima ação da Efetiva Necessidade.
- Criar cenário de processo dependente CRAF/GT bloqueado pela Autorização de Compra.
- Comparar automaticamente a projeção retornada ao portal e ao painel para os mesmos processos.
- Verificar visualmente desktop e mobile, sem alterar o layout além dos rótulos e dados necessários.

## Resultado esperado

Cliente e Equipe Quero Armas deixam de interpretar o processo separadamente. Qualquer mudança futura em status, condição, grupo ou etapa composta altera uma única projeção e aparece igual nos dois lados.