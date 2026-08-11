# Laudos: sempre 2 itens, nunca 4

## Situação confirmada no banco (Anthony, cliente 218)

O grupo **Laudos** hoje tem 4 linhas no checklist:

```text
101  atestado_aptidao_psicologica_instituicao   dispensado_por_reaproveitamento
102  atestado_capacidade_tecnica_instituicao    pendente
290  laudo_psicologico                          dispensado_por_reaproveitamento
490  laudo_capacidade_tecnica                   pendente
```

São 2 exigências reais (psicológico e tiro), duplicadas porque a via institucional e a via particular viraram itens separados. Por isso o rodapé mostra "2 de 4 itens concluídos".

As equivalências oficiais já existem nos dois pares (psicológico **e** tiro), então o **laudo de tiro não vai travar** como travou o psicológico: entregar o particular dispensa o da instituição e vice-versa. O que resta é problema de contagem e de apresentação — o cliente vê 4 itens onde existem 2.

## O que será feito

**1. Um item por exigência, não por via**
O checklist passa a tratar cada par (instituição x particular) como **um único item de laudo**. O cliente vê:
- LAUDO DE APTIDÃO PSICOLÓGICA
- LAUDO DE CAPACIDADE TÉCNICA (TIRO)

Dentro do item, a escolha "usar o exame da minha instituição" ou "encontrar um profissional parceiro" continua existindo como **caminho**, sem virar item novo.

**2. Contagem corrigida em todos os lugares**
Total do grupo, percentual, "PASSO X DE Y", chips de pendências e o rodapé do pop-up guiado passam a contar 2, não 4. Vale para o portal do cliente e para o dashboard do admin.

**3. Regra aplicada a todos os clientes, não só ao Anthony**
- Correção retroativa nos processos ativos: quando um lado do par já está entregue/aprovado, o irmão passa a **NÃO SE APLICA** em vez de ficar como linha visível.
- Quando nenhum dos dois foi entregue, fica só **uma** linha pendente representando o par.

**4. Explosão do checklist**
A geração de checklist deixa de criar as duas linhas por exigência; cria uma, e o par serve apenas como equivalência de aceite do arquivo.

## Detalhes técnicos

- Pares canônicos: `laudo_psicologico` ↔ `atestado_aptidao_psicologica_instituicao` e `laudo_capacidade_tecnica` ↔ `atestado_capacidade_tecnica_instituicao` (já registrados em `qa_tipo_documento_aliases`).
- Novo helper em `src/lib/quero-armas/` (ex.: `paresEquivalentes.ts`) com o par canônico e a função de colapso, usada por `pendenciasGrupos.ts`, `checklistMetrics.ts`, `trilhaChecklist.ts` e `PendenciasGuiadasPopup.tsx`.
- `qa_explodir_checklist_processo`: gera apenas o item canônico do par (ordem 290 / 490) e não recria o irmão institucional.
- RPC `qa_painel_progresso_clientes`: `total_docs`, `grupo_total` e `grupo_concluidos` contam o par como 1.
- Migração de dados: nos processos ativos, marcar o irmão como `nao_se_aplica` quando o par já foi cumprido e neutralizar linhas duplicadas pendentes.
- Nenhuma mudança na aceitação de arquivo: laudo particular e atestado da instituição continuam ambos válidos.