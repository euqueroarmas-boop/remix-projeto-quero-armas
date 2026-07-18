
## Estado atual do wizard `/admin/piloto-real`

Já existe no código (auditei `QAPilotoRealPage.tsx`, 3029 linhas):

- **Passo 1 — Cliente**: busca por nome/CPF/e-mail, cartão com resumo, botão "Trocar".
- **Passo 2 — Serviço principal + itens extras** (múltiplos serviços do pacote).
- **Passo 3 — Modo do contrato** (`itens_separados` × `pacote_fechado`), `valor_final_pacote`, tipo de diferença (`ajuste_comercial` × `custo_financeiro_adquirente`), adquirente, parcelas, composição derivada com `servico_qa`, extras, custos embutidos e custo financeiro.
- **Passo 5 — Pagamento manual** com forma, parcelas, adquirente, valor bruto, comprovante.
- **Passo 6 — Contrato + upload assistido**.
- **Arquivar / Reprocessar financeiro** com `NotificacaoPolicyPicker` já plugado nas 4 ações (pagamento, upload, arquivar, reprocessar).
- **Retomada**: lista "Em andamento / Arquivados", botão "Continuar", "Voltar para pilotos em andamento", guarda `motivoBloqueioVinculo` quando venda/contrato pertencem ao admin.
- **Auditoria** via `logPilotoEvento` (19 eventos em `qa_piloto_eventos`).
- **Smoke test** já forçado a `modo_teste` + arquivar (última correção); botão isolado no topo.

## Gaps confirmados

1. **Passo 1 não bloqueia staff/admin proativamente.** Hoje a busca lista qualquer `qa_clientes` (inclusive #190 ADMIN QUERO ARMAS / `eu@queroarmas.com.br`). O bloqueio só aparece depois da venda criada.
2. **Ausência de "Composição do valor final" visível quando o modo é `itens_separados`** — a composição só renderiza para pacote fechado. O usuário pediu campo visível sempre.
3. **Faltam labels/agrupamentos explícitos** para: clube/estande, deslocamento, "outro" na lista de tipos de extras (hoje o dropdown de extras usa outra taxonomia).
4. **Passo 5 não mostra explicitamente** "valor total parcelado" e "diferença/arredondamento" derivados de `parcelas × valor da parcela`.
5. **Política de notificação** existe, mas o motivo obrigatório quando "Não" ainda não é obrigatório por form-validation em todos os 4 pickers (algumas ações permitem seguir sem motivo).
6. **Lista de pilotos em andamento** já filtra arquivados, mas smoke antigo (pré-correção de hoje) ainda pode aparecer como "em andamento" se não foi arquivado — precisa filtro extra por `motivo ILIKE '%SMOKE%'`.

## Plano de implementação

### 1. Passo 1 — Bloqueio de staff antes da seleção

- Carregar `qa_usuarios_perfis` ativos ao montar a página → `Set<user_id>` de staff.
- No resultado da busca, marcar candidatos staff com badge vermelho "STAFF — NÃO SELECIONÁVEL" e desabilitar o botão.
- Se o operador tentar setar o cliente mesmo assim, `toast.error("Staff/admin não pode ser contratante")` e não avança.
- Excluir `eu@queroarmas.com.br` da lista de candidatos.

### 2. Passo 3 — Composição sempre visível

- Renderizar o bloco "Composição do valor final" também em `itens_separados`, listando: `servico_qa`, extras (com natureza atual), custos embutidos, e total derivado.
- Adicionar taxonomia oficial na criação/edição de extras: `servico_qa`, `gru_taxa_gov`, `exame_laudo`, `clube_estande`, `despesa_operacional`, `deslocamento`, `custo_financeiro_adquirente`, `outro`. Migrar labels antigos por mapping compatível.
- Se soma da composição ≠ `valor_total_pago_cliente` em pacote fechado, banner vermelho e botão "Criar venda" desabilitado (já parcialmente feito → reforçar tolerância de 0.01 e mensagem).

### 3. Passo 5 — Resumo do parcelamento

- Campos calculados abaixo do input `valor bruto`:
  - `Parcela: R$ X × N`
  - `Total parcelado: R$ Y`
  - `Diferença vs. composição: R$ Z` (destacado se ≥ 0.01)
- Adquirente vira `Select` com opções: Stone, Rede, Cielo, Asaas, Outra (input texto quando "Outra").

### 4. Política de notificação — motivo obrigatório

- No `NotificacaoPolicyPicker`, quando `notificar === false`, tornar `motivo` obrigatório (mínimo 10 caracteres) e validar antes de disparar cada ação (pagamento, upload, arquivar, reprocessar).
- Passar a política escolhida para `logPilotoEvento` em cada ação.

### 5. Lista de pilotos — smoke fora de "em andamento"

- Na query da aba "Em andamento", adicionar filtro: `.not("motivo_arquivamento", "ilike", "%SMOKE%")` e excluir vendas com `origem_venda ILIKE 'piloto_real_smoke%'`.
- Backfill: rodar script que arquiva vendas de smoke pendentes (opcional, apenas se o usuário confirmar).

### 6. Auditoria complementar

- Emitir `logPilotoEvento` em pontos hoje não instrumentados:
  - `cliente_selecionado_bloqueado_staff` (quando tentativa é rejeitada)
  - `composicao_editada` (cada alteração de extras)
  - `politica_notificacao_definida` (para cada uma das 4 ações)

### 7. Deliverable — mapa de campos

Ao final, respondo com um mapa "onde cada campo aparece":

```text
Passo 1 · Cliente Real            → busca + card + badge STAFF
Passo 2 · Serviços do Pacote      → serviço principal + itens extras (tabela)
Passo 3 · Modo do Contrato        → radio itens/pacote
        · Valor Final Pacote      → input valor_total_pago_cliente
        · Composição do Valor     → tabela editável (sempre visível)
        · Tipo de Diferença       → radio ajuste × custo financeiro
        · Custos Operacionais     → tabela GRU/exame/clube/desloc/outro
Passo 4 · Aprovar Valor           → botão RPC
Passo 5 · Pagamento Manual        → forma, parcelas, adquirente (select),
                                    valor bruto, resumo parcelamento,
                                    comprovante, NotificacaoPolicyPicker
Passo 6 · Contrato + Upload       → link contrato, upload assinado,
                                    NotificacaoPolicyPicker
Ações · Arquivar / Reprocessar    → picker de notificação com motivo obrig.
Topo   · Smoke test               → botão isolado; nunca escreve nos states do wizard
```

## Escopo intencionalmente fora deste plano

- Reescrita do `NotificacaoPolicyPicker` para suportar WhatsApp real (hoje já grava `whatsapp_preparado`).
- Migração de dados históricos de smokes antigos (só se pedido).
- Alterações no Edge Function `qa-checkout-criar-venda` (já corrigido na conversa anterior).
