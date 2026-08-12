# O furo do checklist do Fábio: ordem por grupo não é travada

## Diagnóstico (dados reais do processo dele)

```text
06/08 20:22  checklist explodido — grupo 3 OCUPAÇÃO nasce com a pergunta-pivot
             "Defina sua condição profissional" (renda_definir_condicao), pendente
11/08 14:05  cliente entrega Antecedentes Eleitoral   (grupo 6 — IDONEIDADE)
11/08 14:13  cliente entrega Antecedentes Militar     (grupo 6 — IDONEIDADE)
11/08 18:02  cliente responde "autônomo/MEI" → placeholder é apagado e nasce
             a exigência CCMEI (grupo 3) → o "próximo passo" volta ao grupo 3
```

Ou seja: a pergunta do grupo 3 estava aberta desde 06/08 e mesmo assim ele entregou documentos do grupo 6. Não é falha do motor de próximo passo — ele sempre apontou a pergunta do grupo 3. Os furos são três:

1. **Não existe trava de ordem por grupo.** O pop-up guiado só é obrigatório para contrato/procuração e para cadastro incompleto (`bloqueante`); na fila do checklist documental o cliente navega livre por Anterior/Próximo, e os cards/Hub aceitam upload de qualquer grupo.
2. **A pergunta-pivot não bloqueia nada.** Ela define quais documentos existirão nos grupos seguintes, mas fica na fila como um item comum.
3. **A resposta não é gravada no questionário do processo.** `qa-processo-set-condicao` grava `qa_processos.condicao_profissional` e apaga o placeholder, mas não escreve `condicao_profissional` em `respostas_questionario_json` (confirmado: o JSON do Fábio só tem as respostas de endereço). Numa reexplosão a pergunta ressuscita — mesma classe do bug do Anthony.

## O que será feito

### 1. Trava de ordem por grupo (área do cliente)

- O checklist passa a liberar **apenas o grupo corrente** — o primeiro grupo, na ordem canônica, que ainda tem pendência acionável.
- Grupos posteriores aparecem na trilha como **BLOQUEADO**, com o motivo ("conclua Ocupação lícita"). Sem envio, sem abrir passo a passo.
- Grupos anteriores já cumpridos continuam abertos para reenvio (documento rejeitado/vencido não pode ficar refém da trava).
- Vale para as três portas de entrada: pop-up guiado, cards do resumo e Hub do cliente.
- Regra dura: item **rejeitado ou vencido** de grupo anterior reabre aquele grupo e volta a ser o grupo corrente.
- A trava é só do lado do cliente. A equipe continua podendo lançar qualquer documento pelo admin.

### 2. Pergunta-pivot bloqueia o grupo

- Enquanto a pergunta que define o checklist (condição profissional, imóvel de terceiro) estiver sem resposta, o grupo dela é o grupo corrente e nada além dele é liberado — o cliente cai direto nessa tela ao abrir o portal.

### 3. Resposta gravada no questionário + backfill

- `qa-processo-set-condicao` passa a gravar `condicao_profissional` também em `qa_processos.respostas_questionario_json` (merge, nunca sobrescrevendo outras chaves).
- Backfill: processos que já têm `qa_processos.condicao_profissional` preenchida e não têm a chave no JSON recebem a resposta (Fábio, Anthony, Pedro, Gilson).

### 4. Leitura no painel do admin

- Coluna PRÓXIMO PASSO: cortar sufixo descritivo do nome (o "— SALGADEIRO" do CCMEI), limitar a duas linhas e mostrar o nome completo no tooltip.
- Trocar "PASSO 0 DE 1" por `PASSO {concluídos+1} DE {total}` — nunca "passo 0".
- Chip discreto `NOVA EXIGÊNCIA` quando a exigência do próximo passo nasceu depois da última entrega do cliente, para a equipe não ler retrocesso de grupo como desleixo do cliente.

## Detalhes técnicos

- **Motor de ordem** — novo helper `src/lib/quero-armas/ordemGruposChecklist.ts`: recebe os documentos do processo + respostas e devolve `{ grupoCorrente, gruposBloqueados[], motivo }`, reusando `pendenciasGrupos.ts` (ordem canônica) e `itemBloqueanteEtapa.ts` (o que ainda bloqueia). Espelho em `supabase/functions/_shared/` para o backend usar a mesma regra.
- **Consumo no front**: `PendenciasGuiadasPopup.tsx` filtra a fila pelo grupo corrente e desenha os demais como bloqueados; `ClienteResumoKanban.tsx` e `ClienteDocsHubModal.tsx` desabilitam envio fora do grupo corrente com a mesma mensagem.
- **Backend**: `qa-processo-set-condicao` faz o merge no `respostas_questionario_json`; a validação de upload do cliente (`qa-classificar-documento-arma` / rota de envio) rejeita documento de grupo bloqueado com erro claro, para a trava não viver só na UI.
- **Backfill**: update pontual em `qa_processos` para os processos com condição definida e chave ausente no JSON.
- **Painel**: `src/components/quero-armas/dashboard/DashboardProgressoClientes.tsx` (rótulo, contagem do passo, chip) + expor `proximo_criado_em` e `ultimo_envio` em `qa_painel_progresso_clientes` (migração aditiva, nenhuma coluna existente muda).
- **Testes**: casos de regressão para ordem por grupo (entrega de grupo posterior recusada, grupo anterior reaberto por rejeição) e para o merge da resposta.