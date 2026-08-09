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

Formato: blocos curtos, um por ideia, no visual do pop-up guiado, com destaque apenas na frase do prazo de 6 meses. Rodapé com "Anterior" e "Entendi, quero registrar o BO" levando ao passo seguinte.

## Comportamento

- O passo é **informativo**: conclui ao ser visto, não trava a fila e não pede resposta.
- Fica entre "Revisão e geração" e "Registrar o BO" — aparece junto com os passos de BO (quando o texto de BO foi gerado).
- A contagem do grupo passa de 10 para 11 passos e continua acompanhando o passo em tela ao voltar.
- Campo opcional na mesma tela: "Nome e CPF de quem te preocupa (se souber)" — o que for escrito é anexado ao texto do BO exibido no passo seguinte. Em branco, nada muda.

## Detalhes técnicos

- `EfetivaNecessidadeModal.tsx`: novo `PassoTipo` `"entender_bo"`, item no topo de `PASSOS_BO`, rótulo em `TRILHA_ROTULO` ("Entenda o BO"), corpo próprio no switch de renderização, `concluido` sempre verdadeiro.
- Texto da tela em constante nova `src/lib/quero-armas/boExplicacao.ts` (fonte única, reaproveitável na Central de Ajuda / Klal depois).
- `src/lib/quero-armas/efetivaNecessidadePassos.ts`: incluir `entender_bo` em `PASSOS_BO` e em `EFETIVA_PASSO_ROTULO`; passo informativo não segura o contador.
- Campo opcional de nome/CPF: grava em `qa_efetiva_necessidade_acrescimos` (origem `pessoas_bo`), sem nova coluna e sem alterar prompts das edge functions; o passo "Registrar o BO" concatena essa linha ao final do texto exibido, respeitando o limite de 500 caracteres.
- Sem migração de banco, sem mudança em `qa-efetiva-narrativa` / `qa-efetiva-aprovar`.