## Separação Contrato × Procuração

**Regra:** Contrato = documento da transação → aba **Processos**. Procuração = documento do cliente → **Hub Documental**.

### O que fazer

1. **Hub Documental → Jurídico → Procurações**
   - Garantir categoria "Procurações" ativa no Hub (já existe bridge canonical de assinaturas — reaproveitar).
   - Listar procurações vigentes do cliente com badge de vigência (verde/âmbar/vermelho) usando o motor de `validadeDocumento.ts`.
   - Validade padrão: 1 ano a partir da emissão (parametrizável).
   - Botão **"Reaproveitar neste processo"** dentro do fluxo de novo pedido → pergunta *"Usar procuração vigente ou emitir nova?"*.
   - Se vencida → motor de pendências pede renovação automaticamente.

2. **Aba Processos**
   - Manter apenas o **Contrato assinado** (card + botão *Baixar PDF* + selo IP/sessão já existente).
   - Remover a Procuração da listagem de documentos do processo.
   - Adicionar chip discreto **"Procuração vigente até dd/mm/aaaa ✓"** com link que abre o Hub na procuração correspondente.

3. **Migração de dados**
   - Mover procurações existentes (bridge canonical) para a categoria Jurídico → Procurações no Hub.
   - Preservar vínculo `processo_id` original apenas como *referência de origem*, sem duplicar.

### Detalhes técnicos

- **Frontend:** ajustar `ClienteDocsHubModal.tsx` (subcategoria Procurações + botão reaproveitar), `QAClienteProcessoPage` (remover card procuração, adicionar chip cruzado).
- **Backend:** atualizar `trg_qa_bridge_hub_to_canonical_signatures` para escrever procurações na categoria correta do Hub; adicionar RPC `qa_procuracao_vigente_do_cliente(cliente_id)` para o chip cruzado e para o reaproveitamento.
- **Motor de pendências:** `pendenciasExplicacoes.ts` — quando processo exigir procuração, checar se já existe vigente no Hub antes de pedir nova.
- **Validade:** `validadeDocumento.ts` — adicionar regra `procuracao: emissao + 365 dias`.
- **Zero regressão:** contrato mantém fluxo atual intacto.
