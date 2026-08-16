# Instruções permanentes para o assistente

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
