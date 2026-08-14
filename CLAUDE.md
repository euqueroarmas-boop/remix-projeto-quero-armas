# Instruções permanentes para o assistente

## Fluxo de commit e push

- Após qualquer correção de código, fazer **imediatamente** `git commit` + `git push origin main`.
- Não esperar aprovação explícita para o push — corrigiu, commitou, publicou.
- Branch de trabalho: sempre `main`.
- Mensagem de commit em português, descritiva, com o prefixo convencional (`fix:`, `feat:`, `refactor:`, etc.).

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
