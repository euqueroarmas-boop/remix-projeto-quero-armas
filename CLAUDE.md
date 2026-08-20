# Instruções permanentes para o assistente

## Correções: cirúrgicas, nunca globais por conta própria — CANÔNICO

- Cada correção ataca SOMENTE o problema reportado. Regra compartilhada
  (validador, parser, conferência ou trava usada por vários tipos de
  documento) NÃO muda por iniciativa própria — só quando o pedido for
  explicitamente esse.
- Quando a correção do caso exigir mexer em comportamento compartilhado,
  AVISAR ANTES de aplicar: dizer o que muda para os demais documentos e
  por quê, e esperar o aval.
- "Aproveitar" a correção para endurecer/afrouxar regras vizinhas é
  proibido. Melhoria adicional é proposta, não entrega.

## Fluxo de commit e push

- Após qualquer correção de código, fazer **imediatamente** `git commit` + `git push origin main`.
- Não esperar aprovação explícita para o push — corrigiu, commitou, publicou.
- Branch de trabalho: sempre `main`.
- Mensagem de commit em português, descritiva, com o prefixo convencional (`fix:`, `feat:`, `refactor:`, etc.).

## Diagnóstico: PRIMEIRO os dados, DEPOIS a explicação — CANÔNICO

Vale para toda pergunta e toda resposta, sem exceção.

- **Não explicar nada antes de ter TODOS os dados.** Enquanto faltar o resultado de
  qualquer query, a resposta é só o pedido das queries — nada de hipótese, nada de
  "minha leitura é", nada de diagnóstico parcial. Explicação sem dado completo gera
  erro, e erro me custa tempo.
- **Pedir tudo de uma vez, na primeira mensagem.** Levantar antes o conjunto inteiro
  de queries/arquivos/informações necessárias e mandar em um bloco só. Proibido pedir
  uma query, receber, pedir outra, receber, pedir mais uma.
- **Depois que todo o SQL estiver respondido, explicar de forma RESUMIDA e para
  LEIGO.** Sem jargão, sem `arquivo.tsx:linha`, sem trecho de código, sem lista de
  defeitos numerada de dez itens. O que aconteceu, de quem é o problema, e o que
  fazer — em poucas linhas.
- **Não esticar conversa.** Nada de repetir o que já foi dito, recapitular a análise
  anterior ou reabrir ponto já fechado.
- Detalhe técnico só se eu pedir "me explica tecnicamente".

## Migrations e SQL — SEMPRE NA TELA

O Lovable **não aplica migrations**. Todo SQL precisa ser colado à mão no SQL Editor
do Supabase. Portanto:

- **Todo SQL que eu gerar vai COLADO NA RESPOSTA, em bloco ```sql```, por inteiro.**
  Isso vale para migration nova, correção de constraint, backfill, consulta de
  conferência — qualquer SQL, sem exceção.
- Salvar o arquivo (`supabase/migrations/…` ou `supabase/_para_colar.sql`) e/ou
  anexar com SendUserFile **não substitui** mostrar na tela. O arquivo é o registro;
  o bloco na resposta é o que eu de fato uso. Faça os dois, sempre.
- Nunca responder "o SQL está no arquivo X" e parar por aí. Nunca abreviar a lista
  com `...` ou "e os demais tipos" — o bloco tem que dar para copiar e colar direto,
  completo, sem eu precisar abrir arquivo nenhum.
- Se o bloco for longo, mostre mesmo assim. Tamanho não é motivo para omitir.
- Junto do bloco, diga em uma linha o que ele faz e qual consulta roda depois para
  conferir se funcionou.

## Edge functions — SEMPRE MANDAR O COMANDO DO LOVABLE

O push publica o front, mas **edge function não sai junto**. Toda vez que eu criar
ou alterar qualquer arquivo em `supabase/functions/`, a resposta tem que trazer o
**comando pronto para colar no chat do Lovable**, no mesmo lugar e com o mesmo
peso do bloco de SQL. Vale a mesma regra do SQL: mostrar na tela, por inteiro,
sem abreviar e sem mandar abrir arquivo nenhum.

O comando é um texto em bloco, endereçado ao Lovable, que:

- lista **todas** as funções tocadas, separando as **novas** (primeiro deploy)
  das **alteradas** (redeploy) — função alterada precisa de deploy igual à nova;
  esquecer disso deixa banco novo conversando com código velho;
- manda **publicar sem alterar código**, porque o Lovable tende a "melhorar" o
  que encontra pela frente;
- diz em uma linha o que quebra se aquela função não subir;
- termina pedindo a confirmação de quais funções subiram.

Modelo:

```
Faça o deploy das edge functions abaixo. NÃO altere nenhum código-fonte,
NÃO refatore e NÃO crie migrations — apenas publique as funções.

NOVAS (primeiro deploy):
- supabase/functions/<nome>/index.ts — <o que quebra sem ela>

ALTERADAS (redeploy obrigatório):
- supabase/functions/<nome>/index.ts — <o que quebra sem ela>

Ao terminar, confirme quais funções foram publicadas.
```

Se eu estiver no terminal, o equivalente é
`supabase functions deploy <nome> --project-ref ogkltfqvzweeqkfmrzts` — mas o
padrão da resposta é o comando do Lovable, que é onde eu trabalho.

Registrar a leva em `docs/DEPLOY-FUNCOES-PENDENTES.md` NÃO substitui mostrar o
comando na resposta. O arquivo é o registro; o comando na tela é o que eu uso.
