# Tela "Por que abrir o BO" antes de mandar o cliente na delegacia

Hoje, depois da revisão, o cliente cai direto no passo "Registrar o boletim na delegacia" com o texto pronto e o link da Polícia Civil. Falta o que você explica no atendimento: o que é (e o que não é) um BO, que ele não acusa ninguém, o prazo de 6 meses para representar, e por que um BO antigo não serve.

Entra um passo novo, imediatamente antes de "Registrar o BO", só de explicação — sem formulário obrigatório.

## O que a tela diz

- **O BO não envolve a pessoa.** É uma comunicação sua à delegacia dizendo que você teme pela sua segurança. Nada acontece com o outro por causa do BO.
- **Representar é outra coisa.** No rodapé do BO consta que você tem 6 meses para representar. Representar é pedir à delegacia que investigue — só aí um inquérito é instaurado e a pessoa é envolvida. É por isso que se diz "a polícia não faz nada": sem representação, ela não pode agir.
- **Por que isso te protege.** O BO registra hoje, com data, que aquela pessoa te ameaçou. Se no futuro você precisar se defender, a investigação encontra esse registro anterior — legítima defesa, art. 25 do Código Penal (repelir injusta agressão, atual ou iminente, com meios moderados). Ameaça é crime (art. 147 do CP) e o caminho legal contra ela é o BO e a representação, nunca a arma.
- **BO antigo não vale.** O prazo legal de representação é de 6 meses. BO de anos atrás não sustenta ameaça atual — por isso pedimos um novo registro dizendo que o fato ainda prevalece.
- **Recomendação forte:** informe nome e CPF de quem está te deixando preocupado, se você souber. Isso não gera nada contra a pessoa e dá força ao registro.
- **Nota de contexto:** hoje a lei (Estatuto do Desarmamento) exige efetiva necessidade; não existe autorização por "defesa pessoal" pura — esta etapa é exatamente a que sustenta seu pedido.

Formato: blocos curtos, um por ideia, no visual do pop-up guiado, com destaque apenas na frase do prazo de 6 meses.

## Parte 1 — Área do cliente

- O passo entra entre "Revisão e geração" e "Registrar o BO", aparecendo junto com os passos de BO. A contagem do grupo passa de 10 para 11.
- Ao final da explicação, **caixa de ciência obrigatória**:
  "Li e entendi. O boletim de ocorrência é uma comunicação minha, feita por mim, à autoridade policial, com fatos que eu mesmo declaro. A Quero Armas apenas me orientou e organizou meu relato — não registra o boletim em meu nome nem responde pelo conteúdo declarado."
- Enquanto a caixa não for marcada, o botão "Entendi, quero registrar o BO" fica desabilitado. Marcou, grava na hora (não depende de avançar) e o passo conclui.
- Ao marcar, o cliente vê uma confirmação discreta: "Ciência registrada em DD/MM/AAAA às HH:MM (BRT)" — e o texto assinado fica visível para releitura.
- Desmarcar não apaga o registro anterior: cada marcação é um evento novo (histórico, nunca sobrescrito).
- Campo opcional na mesma tela: "Nome e CPF de quem te preocupa (se souber)" — anexado ao texto do BO exibido no passo seguinte. Em branco, nada muda.

## Parte 2 — Admin: nova aba "Ciências e aceites"

Nova aba no cadastro do cliente (ao lado de "Efetiva necessidade"), permanente e somente leitura:

- Lista cronológica de tudo que o cliente declarou ciência ou entregou, cada linha com: data/hora BRT, título do termo, versão do texto, processo vinculado e o **carimbo de conexão** (IP, sistema, navegador, idioma, user-agent, hash do texto).
- Clique na linha abre o texto exato que o cliente leu naquela data — prova de conteúdo, não só de clique.
- Ação "Baixar comprovante" gera um PDF com o termo + carimbo de conexão no mesmo padrão dos contratos e procurações.
- Nada é editável nem apagável pela interface; a aba serve à auditoria.

## Detalhes técnicos

### Cliente
- `EfetivaNecessidadeModal.tsx`: novo `PassoTipo` `"entender_bo"` no topo de `PASSOS_BO`, rótulo em `TRILHA_ROTULO` ("Entenda o BO"), corpo próprio no switch; `concluido` = existe ciência registrada para este processo.
- Texto da tela e do termo em `src/lib/quero-armas/boExplicacao.ts`, com `VERSAO_TERMO_BO` — fonte única, reaproveitável na Central de Ajuda / Klal.
- `src/lib/quero-armas/efetivaNecessidadePassos.ts`: incluir `entender_bo` em `PASSOS_BO` e em `EFETIVA_PASSO_ROTULO`; o passo só conclui com a ciência marcada.
- A gravação chama a edge function nova `qa-registrar-ciencia` (jamais insert direto do browser), que resolve IP e cabeçalhos do request e monta o carimbo com o `_shared/carimboConexao.ts` já existente.
- Campo opcional de nome/CPF: grava em `qa_efetiva_necessidade_acrescimos` (origem `pessoas_bo`); o passo "Registrar o BO" concatena a linha ao texto exibido, respeitando o limite de 500 caracteres.

### Banco
- Nova tabela `public.qa_cliente_ciencias`: `cliente_id`, `processo_id` (nulo permitido), `termo_codigo` (`bo_efetiva_necessidade`), `termo_versao`, `termo_texto`, `termo_hash`, `aceito_em`, `ip`, `user_agent`, `accept_language`, `referer`, `origem`, timestamps.
- GRANTs: `authenticated` só leitura das próprias ciências; escrita apenas por `service_role` (edge function). RLS ligada; sem update/delete por ninguém além de `service_role`.
- Genérica de propósito: serve para os próximos termos e para carimbar outras entregas do cliente na auditoria.

### Admin
- Novo componente `src/components/quero-armas/clientes/ClienteCienciasAuditoria.tsx` e nova `TabsContent value="ciencias"` em `QAClientesPage.tsx`, ao lado de "efetiva".
- PDF do comprovante reaproveita `desenharCarimbo` de `supabase/functions/_shared/carimboConexao.ts` (mesmo rodapé de contrato/procuração), via edge function `qa-ciencia-comprovante`.
- Sem mudança em `qa-efetiva-narrativa` / `qa-efetiva-aprovar`; o dossiê passa apenas a citar a ciência registrada (data + hash).