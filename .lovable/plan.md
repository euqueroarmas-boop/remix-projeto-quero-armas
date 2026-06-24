# Auto-preenchimento inteligente do cadastro a partir de documentos já enviados

## Objetivo
Quando o cliente abrir o modal de cadastro progressivo, a plataforma varre os documentos que ele já enviou (RG, CIN, CNH, comprovante de residência, etc.) em `qa_documentos_cliente`, extrai os campos via IA e **preenche o cadastro automaticamente**, com a regra:

- **IA sobrescreve dados digitados manualmente** — documento oficial é a fonte da verdade.
- **IA NÃO sobrescreve campos que o cliente corrigiu DEPOIS de uma sugestão da IA** — se o cliente alterou o que a IA propôs, é sinal de que algo está errado no documento ou na extração, e a correção humana prevalece.

## Como vai funcionar

### 1. Marcação de origem por campo
Cada campo do cliente passa a ter um "selo" de origem, guardado num único JSON em `qa_clientes.campo_origens`:

```text
{
  "rg_numero":          { "source": "ai",     "doc_id": "...", "at": "..." },
  "rg_orgao_emissor":   { "source": "ai",     "doc_id": "...", "at": "..." },
  "endereco_logradouro":{ "source": "manual_override_ai", "at": "..." },
  "telefone":           { "source": "manual", "at": "..." }
}
```

Valores de `source`:
- `manual` → digitado pelo cliente, **nunca veio da IA**. Pode ser sobrescrito pela IA (doc é fonte da verdade).
- `ai` → veio de extração de documento. Pode ser re-sobrescrito por uma extração mais nova.
- `manual_override_ai` → cliente editou um valor que a IA havia sugerido. **Trancado para a IA**.

### 2. Detector de override no front
No `ClienteCadastroProgressivoModal`, quando um input muda:
- Se o campo estava marcado como `ai` e o novo valor difere, marcar como `manual_override_ai`.
- Se estava `manual` ou vazio, manter `manual` ao salvar.
- Se IA preencheu agora, marcar `ai`.

### 3. Pipeline de auto-prefill ao abrir o modal
Novo hook `useAutoPrefillFromDocs(clienteId)`:
1. Busca em `qa_documentos_cliente` os documentos do cliente classificados como `rg`, `cin`, `cnh`, `comprovante_residencia`, `cr`, `craf` que ainda não foram usados para prefill (`prefill_consumed_at IS NULL`).
2. Para cada um, chama a edge function existente `qa-cliente-prefill` (já extrai os campos).
3. Consolida o resultado: para cada campo extraído,
   - se `campo_origens[campo].source === 'manual_override_ai'` → **ignora** (cliente já corrigiu, IA não toca).
   - caso contrário → aplica o valor da IA e marca `source: 'ai'`.
4. Mostra um banner discreto no topo do modal: *"Preenchemos N campos automaticamente a partir de M documentos seus. Revise abaixo."* com botão "Desfazer este preenchimento" (reverte para os valores anteriores, guardados num snapshot local).
5. Marca cada documento processado com `prefill_consumed_at = now()` para não reprocessar (a menos que um novo upload aconteça).

### 4. Re-execução em novo upload
Quando o cliente faz upload de um novo documento dentro ou fora do modal, dispara `qa-cliente-prefill` para esse doc específico aplicando a mesma regra de sobrescrita.

### 5. UI
- Banner azul claro (paper canônico, sem dark) no topo do modal: ícone de raio + texto + ação "Desfazer".
- Cada input que veio da IA ganha um micro-selo `IA` no canto (cinza, 9px) para o cliente identificar.
- Quando o cliente edita um campo IA, o selo muda para `EDITADO` (vermelho bordô `#7A1F2B`) — sinal visual da regra `manual_override_ai`.

## Mudanças técnicas

| Camada | Arquivo | Mudança |
|---|---|---|
| DB | migração | adiciona `campo_origens jsonb default '{}'` em `qa_clientes`; adiciona `prefill_consumed_at timestamptz` em `qa_documentos_cliente` |
| Edge | `qa-cliente-prefill` (já existe) | nenhuma mudança na extração; o consumidor passa o conjunto de campos travados |
| Lib | novo `src/lib/quero-armas/campoOrigem.ts` | helpers `markFieldOrigin`, `canAiOverwrite`, `applyAiExtraction` |
| Hook | novo `src/hooks/useAutoPrefillFromDocs.ts` | orquestra busca + extração + consolidação + persistência |
| UI | `src/components/quero-armas/portal/ClienteCadastroProgressivoModal.tsx` | banner, badges por campo, detector de override no `onChange`, integração com o hook |

## Fora de escopo
- Não mexe em outros fluxos de upload (checklist, processos) — apenas lê o que já existe.
- Não muda a UI/estilo visual do modal já aplicada (v12 arsenal mapeado).
- Não altera o pipeline de ingestão / KB.
