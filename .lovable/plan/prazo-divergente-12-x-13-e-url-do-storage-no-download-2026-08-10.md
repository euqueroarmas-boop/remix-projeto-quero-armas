# Prazo divergente (12 x 13) e URL do storage no download

## 1. Fonte da verdade: 13 dias

Consulta ao banco (Mizael, hoje 09/08/2026):

- `comprovante_residencia` — emissão 22/07/2026, validade **22/08/2026** → **13 dias**.
- Todos os outros itens do resumo também aparecem 1 dia a menos que o banco (TSE 24 x 25, TJSP 27 x 28...).

Causa confirmada: o resumo calcula "hoje" em **UTC**; a tela de documentos calcula "hoje" no **fuso de Brasília**.

- `src/lib/quero-armas/validadeDocumento.ts` (linha 677) usa `Date.UTC(hoje.getUTCFullYear(), ...)`. Às 23:41 em São Paulo já é dia 10 em UTC → some um dia do prazo.
- `DocumentosCategoriaZ6V3Panel.tsx` usa componentes locais de data → dia 09 → 13 dias.
- `ClienteResumoKanban.tsx` tem ainda um terceiro `daysUntil` próprio (linha 112).

Três cálculos diferentes de "hoje" — e o resumo erra depois das 21h.

### O que será feito

1. Criar helper canônico `hojeBRT()` / `diasAteBRT(data)` em `validadeDocumento.ts`, sempre em `America/Sao_Paulo`, conforme a regra de fuso canônico da plataforma.
2. `getValidadeInfo` passa a usar esse helper (sai o `getUTC*`) — corrige de uma vez resumo, badges, KPIs, alertas e agrupamento por família.
3. `DocumentosCategoriaZ6V3Panel.daysUntil` e `ClienteResumoKanban.daysUntil` passam a delegar ao mesmo helper.
4. O card "Foco do dia" passa a usar a mesma validade calculada, para não divergir da lista.

Resultado: um único número (13 dias) em resumo, badge lateral, foco do dia e banco.

## 2. URL do storage visível no download

Em `QAContratosCockpitV1.tsx` (comprovante de pagamento) e em `DocumentosCategoriaZ6V3Panel.tsx` o download usa `a.href = signedUrl` / `window.open(signedUrl)`. Como a URL assinada é de outro domínio, o iOS/Safari ignora o atributo `download` e **navega** até o endereço do storage — foi o que apareceu na barra do navegador.

Correção: transformar em blob antes de entregar ao usuário, como o resto do sistema já faz (`DocumentoViewerModal` / `saveOrShareBlob`):

- buscar o arquivo com `supabase.storage.download` (ou `fetch` da URL assinada) e gerar `URL.createObjectURL(blob)`;
- disparar o `<a download>` sobre o blob e revogar a URL depois;
- remover o `window.open(signedUrl)` do painel de documentos.

O mesmo padrão será corrigido em `MunicoesMovimentacoesManager.tsx` e `ClienteEfetivaNecessidade.tsx`, que ainda abrem `signedUrl` direto.

## Notas técnicas

- Sem mudança de schema e sem alterar regras de validade (30/90 dias, perpétuos) — só o cálculo de "hoje".
- A regra "nunca expor URL do storage" já está em memória; estes eram os pontos remanescentes.