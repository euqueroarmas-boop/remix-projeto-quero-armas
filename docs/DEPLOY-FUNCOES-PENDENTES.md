# Deploy — auditoria do fluxo de posse/autorização

**Versão final, 18/08/2026.** Cobre os commits `d55dd5d` → `HEAD` na `main`
(escopo de ataque F1–F11, concluído).

O push para a `main` publica o front. **Edge function não sai junto** — precisa
de Publish no Lovable (ou `supabase functions deploy` pelo CLI).

---

## Estado atual

| | |
|---|---|
| **Migrations** | 5 criadas · **5 aplicadas** · nada pendente |
| **Leva 1** | 13 funções · **publicada** em 18/08 às 00:08 BRT |
| **Leva 2** | 9 funções · **pendente** ← é o que este documento entrega |

### Migrations — todas já aplicadas

| Arquivo | O que faz | Conferido |
|---|---|---|
| `20260818100000` | Fecha o acesso anônimo a `qa_geracoes_pecas` | ✅ 4 policies, zero `anon` |
| `20260818110000` | Colunas `protocolo_*` em `qa_processos` | ✅ 6 colunas |
| `20260818120000` | Tabela `qa_processo_juntadas` | ✅ 2 policies |
| `20260818130000` | Ciclo de aprovação da peça | ✅ 2 peças, ambas `nao_enviada` |
| `20260818140000` | Colunas de deferimento em `qa_processos` | ✅ 3 deferidos, 0 não confirmados |

**Não há SQL pendente.** Pode publicar as funções direto.

---

## Leva 2 — 9 funções

**Novas (4)** — primeiro deploy:

| Função | Chamada por | Ator |
|---|---|---|
| `qa-peca-enviar-cliente` | painel da equipe | equipe |
| `qa-peca-aprovar-cliente` | portal do cliente | cliente |
| `qa-recurso-protocolar` | painel da equipe | equipe |
| `qa-processo-deferir` | painel + portal | equipe e cliente |

**Alterada (1):**

- `qa-processo-checar-conclusao-checklist` — ganhou o gate que impede o processo
  de virar `pronto_para_protocolar` com petição aguardando ou devolvida. (Já foi
  publicada na leva 1 com o gate da efetiva necessidade; esta é a segunda
  alteração.)

**Arrastadas pelo registry (4)** — quatro templates novos
(`peca-pronta-aprovacao`, `peca-decidida-equipe`, `recurso-protocolado`,
`processo-deferido`). O registry é embutido no bundle de cada uma:

- `send-transactional-email`
- `preview-transactional-email`
- `qa-enviar-email-template`
- `qa-send-all-templates-preview`

> **Só o registry mudou em `_shared` depois da leva 1.** Nenhum outro módulo
> compartilhado foi tocado, então nenhuma outra função precisa ser republicada.

---

## Comando para o Lovable

```
Faça o deploy das edge functions abaixo. Elas já estão no repositório (branch
main) — o código NÃO deve ser alterado, apenas publicado.

Novas (primeiro deploy):
- qa-peca-enviar-cliente
- qa-peca-aprovar-cliente
- qa-recurso-protocolar
- qa-processo-deferir

Alterada:
- qa-processo-checar-conclusao-checklist

Precisam ser republicadas porque o registry de templates mudou (quatro templates
novos: peca-pronta-aprovacao, peca-decidida-equipe, recurso-protocolado,
processo-deferido). O registry é embutido no bundle de cada uma:
- send-transactional-email
- preview-transactional-email
- qa-enviar-email-template
- qa-send-all-templates-preview

São 9 no total. Publique todas na mesma leva.

Restrições:
- Não altere nenhum arquivo em supabase/functions/, src/ ou supabase/migrations/.
- Não crie migration nova. Todo o SQL já foi aplicado à mão no SQL Editor.
- Nenhuma das novas precisa de entrada no config.toml: todas fazem a própria
  guarda (requireQAStaff nas de equipe; dono do processo via qa_clientes.user_id
  ou cliente_auth_links nas do cliente), e o padrão verify_jwt = true serve.

Ao terminar, me diga quais funções foram publicadas e o horário de cada uma.
```

## Alternativa pelo Supabase CLI

```bash
supabase functions deploy \
  qa-peca-enviar-cliente \
  qa-peca-aprovar-cliente \
  qa-recurso-protocolar \
  qa-processo-deferir \
  qa-processo-checar-conclusao-checklist \
  send-transactional-email \
  preview-transactional-email \
  qa-enviar-email-template \
  qa-send-all-templates-preview \
  --project-ref ogkltfqvzweeqkfmrzts
```

---

## Conferência depois do deploy

### 1. Os quatro templates novos estão no ar

Abra o preview de e-mails e confirme que aparecem:

- **Petição pronta para aprovação (cliente)**
- **Petição decidida pelo cliente (equipe)**
- **Recurso protocolado (cliente)**
- **Processo deferido — documento entregue (cliente)**

É o item que quebra em silêncio: se o registry não pegou, os envios falham em
runtime por template inexistente, e só se descobre na hora do disparo real.

### 2. As pontas do fluxo, com um caso real

Não há como conferir por SQL antes de alguém usar. Quando usar, esta consulta
mostra se cada ponta gravou — seção vazia significa "ainda não usado", com linha
significa "funcionando":

```sql
SELECT 'A PECA'::text AS secao, id::text AS item,
       status_cliente AS detalhe,
       COALESCE(aprovada_cliente_em::text, enviada_cliente_em::text, '—') AS valor
  FROM public.qa_geracoes_pecas WHERE status_cliente <> 'nao_enviada'
UNION ALL
SELECT 'B RECURSO', id::text, status,
       COALESCE(numero_protocolo, '—')
  FROM public.qa_processo_recursos WHERE status = 'protocolado'
UNION ALL
SELECT 'C DEFERIMENTO', p.id::text, COALESCE(p.deferimento_numero, '—'),
       COALESCE(p.deferimento_data::text, '—')
  FROM public.qa_processos p WHERE p.deferimento_documento_id IS NOT NULL
UNION ALL
SELECT 'D JUNTADA', j.processo_id::text, 'v' || j.versao || ' · ' || j.paginas || ' pág',
       to_char(j.montada_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
  FROM public.qa_processo_juntadas j
ORDER BY 1, 2;
```

### 3. Ainda pendente da leva 1

Duas conferências continuam abertas — ver `docs/PENDENCIAS-ABERTAS.md`:

- template `exigencia-pf-respondida` no ar (mesma checagem do item 1 acima);
- prova definitiva de que o prazo do recurso parou de alarmar (painel de prazos
  ou `qa-processo-prazo-alertas` com `{"dry_run": true}`).

---

## Por que tudo junto

- As quatro funções novas referenciam os templates novos. Sem o
  `send-transactional-email` na mesma leva, o envio falha por template
  inexistente e o e-mail some — sem erro visível para quem clicou.
- O front já está na `main` e já chama as quatro. Enquanto não subirem, os
  botões existem e devolvem erro de função não encontrada.
- O gate da petição vive em `qa-processo-checar-conclusao-checklist`. Publicar
  `qa-peca-enviar-cliente` sem ela deixa a petição na fila do cliente **sem**
  travar o protocolo — o pior dos dois mundos.
