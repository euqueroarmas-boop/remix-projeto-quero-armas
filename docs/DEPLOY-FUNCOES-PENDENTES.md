# Deploy das edge functions — auditoria do fluxo de posse/autorização

**Gerado em 18/08/2026.** Referente aos commits `d55dd5d` → `168dfba` na `main`.

O push para a `main` publica o front. **Edge function não sai junto** — precisa de
Publish no Lovable (ou `supabase functions deploy` pelo CLI). Este arquivo existe
para a lista não se perder e para o deploy ser conferível.

---

## Ordem obrigatória

1. **SQL primeiro.** As migrations `20260818110000` (colunas `protocolo_*`) e
   `20260818120000` (tabela `qa_processo_juntadas`). O front já lê as duas: sem
   elas o painel de processos e o card da juntada quebram no `select`.
2. **Depois as 13 funções, de uma vez só.** Publicar em pedaços cria janela de
   inconsistência — ver "Por que tudo junto" no fim.
3. **Por último, a conferência.**

---

## Comando para o Lovable

Cole isto no chat do Lovable:

```
Faça o deploy das edge functions abaixo. Elas já estão no repositório (branch
main, commits d55dd5d..168dfba, sincronizados via GitHub) — o código NÃO deve
ser alterado, apenas publicado.

Alteradas diretamente:
- qa-efetiva-aprovar
- qa-manifestacao-analisar
- qa-montar-juntada
- qa-processo-checar-conclusao-checklist
- qa-processo-doc-upload
- qa-processo-doc-validar-ia

Nova (primeiro deploy):
- qa-exigencia-pf-checar

Precisam ser republicadas porque um arquivo de _shared que elas importam mudou
(o bundle de deploy embute o _shared, então a versão antiga continua rodando a
lógica antiga):
- qa-processo-prazo-alertas          (_shared/prazosProcessuais.ts)
- qa-processo-dispensas              (_shared/pendenciasGrupos.ts)
- send-transactional-email           (registry de templates)
- preview-transactional-email        (registry de templates)
- qa-enviar-email-template           (registry de templates)
- qa-send-all-templates-preview      (registry de templates)

São 13 no total. Publique todas na mesma leva.

Restrições:
- Não altere nenhum arquivo em supabase/functions/, src/ ou supabase/migrations/.
- Não crie migration nova. O SQL já foi aplicado à mão no SQL Editor.
- qa-exigencia-pf-checar não precisa de entrada no config.toml: ela usa
  requireQAStaff internamente e o padrão verify_jwt = true serve.

Ao terminar, me diga quais funções foram publicadas e o horário de cada uma.
```

## Alternativa pelo Supabase CLI

Se preferir sem passar pelo Lovable (exige `supabase login` e Docker):

```bash
supabase functions deploy \
  qa-efetiva-aprovar \
  qa-manifestacao-analisar \
  qa-montar-juntada \
  qa-processo-checar-conclusao-checklist \
  qa-processo-doc-upload \
  qa-processo-doc-validar-ia \
  qa-exigencia-pf-checar \
  qa-processo-prazo-alertas \
  qa-processo-dispensas \
  send-transactional-email \
  preview-transactional-email \
  qa-enviar-email-template \
  qa-send-all-templates-preview \
  --project-ref ogkltfqvzweeqkfmrzts
```

---

## Conferência depois do deploy

**1. O template novo existe?** Abra o preview de e-mails da equipe e procure
`exigencia-pf-respondida` ("Exigência da PF respondida (equipe)"). Se não
aparecer, o `send-transactional-email` não subiu — e todo aviso de exigência da
PF vai falhar em runtime por template não encontrado.

**2. A juntada passa a registrar.** Abra um processo em `pronto_para_protocolar`,
clique em MONTAR JUNTADA e confira no SQL Editor:

```sql
SELECT processo_id, versao, paginas,
       jsonb_array_length(itens_json)     AS documentos,
       jsonb_array_length(ignorados_json) AS fora,
       montada_em
  FROM public.qa_processo_juntadas
 ORDER BY montada_em DESC
 LIMIT 5;
```

Voltou linha → o `qa-montar-juntada` novo está no ar e o card aparece no painel.

**3. O alarme falso do recurso parou.** É o item mais visível para quem recebe os
e-mails. Confira que nenhum processo com recurso protocolado ainda tem prazo
aberto:

```sql
SELECT iv.id, iv.servico_id,
       iv.data_indeferimento, iv.data_recurso_administrativo,
       iv.data_indeferimento_recurso
  FROM public.qa_itens_venda iv
 WHERE iv.data_recurso_administrativo IS NOT NULL
   AND iv.data_indeferimento_recurso IS NULL;
```

As linhas que voltarem aqui NÃO devem mais gerar alerta de prazo vencido. O cron
`qa-processo-prazo-alertas` roda 07:00 BRT — a confirmação real é no dia
seguinte, ou disparando a função à mão com `dry_run: true`.

---

## Por que tudo junto

Publicar em pedaços quebra em três pontos:

- `qa-manifestacao-analisar` e os avisos de exigência referenciam o template
  `exigencia-pf-respondida`. Se subirem sem o `send-transactional-email`, o envio
  falha por template inexistente.
- O front já está na `main` e espera linha em `qa_processo_juntadas`. Enquanto o
  `qa-montar-juntada` não subir, o PDF é gerado mas o card não aparece — e a
  trava nova barra o protocolo, obrigando a equipe ao escape "entregue fora do
  sistema".
- `qa-processo-doc-upload` e `qa-processo-doc-validar-ia` importam o mesmo
  `notificarExigenciaPF.ts`. Uma sem a outra deixa metade dos avisos mudos.
