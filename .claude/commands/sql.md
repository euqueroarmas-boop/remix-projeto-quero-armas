---
description: Gera o SQL pronto para colar no SQL Editor do Supabase (Lovable não aplica migrations)
---

O Lovable **não aplica as migrations** deste projeto automaticamente. Toda alteração de banco
precisa ser colada à mão no SQL Editor (Cloud → SQL editor). Este comando prepara esse bloco.

## O que fazer

Argumento recebido: `$ARGUMENTS`

1. Descubra quais migrations ainda não foram aplicadas:
   - Se `$ARGUMENTS` trouxer nomes/datas de migrations, use exatamente essas.
   - Se vier vazio, use as migrations de `supabase/migrations/` cuja data seja **posterior
     à última confirmada como aplicada** (pergunte ao usuário qual foi, se não souber).

2. Concatene o conteúdo delas **na ordem cronológica do nome do arquivo**. A ordem importa:
   correções de estrutura precisam vir antes de qualquer varredura de dados.

3. Torne o bloco seguro para reexecução, porque ele pode ser colado mais de uma vez:
   - `INSERT` → acrescente `ON CONFLICT DO NOTHING`
   - `CREATE INDEX` / `CREATE TABLE` → `IF NOT EXISTS`
   - `ALTER TABLE ... ADD CONSTRAINT` → preceda de `DROP CONSTRAINT IF EXISTS`
   - `CREATE FUNCTION` → `CREATE OR REPLACE`
   - Remova `BEGIN;`/`COMMIT;` internos e envolva **tudo** num único par, para que uma
     falha no meio não deixe o banco pela metade.

4. Escreva o resultado em `supabase/_para_colar.sql` e entregue com SendUserFile,
   além de mostrar em bloco ```sql``` na resposta para cópia rápida.

5. Diga, em uma linha, o que o bloco faz e o que o usuário deve conferir depois de rodar.

## Regras

- **Nunca** invente nome de coluna ou tabela. Se precisar de algo que não tem certeza que
  existe, peça antes uma consulta de verificação ao usuário.
- Se alguma migration depender de dado real (apelidos, backfill), avise que o resultado
  pode variar e proponha a consulta de conferência junto.
- O banco é de produção com clientes reais. Nada de `DROP TABLE`, `TRUNCATE` ou `DELETE`
  sem `WHERE` — se for necessário apagar algo, marque como `substituido`/`excluido`
  em vez de remover a linha.
