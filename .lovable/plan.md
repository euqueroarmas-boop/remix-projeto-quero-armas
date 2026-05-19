# Wave 4A — Etapa 02 dinâmica (consumir `qa_servicos_documentos`) + roteamento `?servico=`

## Objetivo
Fazer a **Etapa 02 do `/cadastro-v2`** ler o checklist real do banco (`qa_servicos_documentos`) por serviço, em vez da lista hardcoded de 5 docs. E corrigir o roteamento `?servico=...` para reconhecer slugs CAC/Caçador/Esporte (hoje só funciona para Defesa Pessoal).

## Escopo (frontend + 1 ajuste de schema)

### 1. Schema — flag `obrigatorio_etapa02`
Adicionar coluna em `qa_servicos_documentos`:
- `obrigatorio_etapa02 BOOLEAN NOT NULL DEFAULT false`
- Default `true` apenas para `tipo_documento IN ('doc_identidade','comprovante_residencia')` em todos os serviços já cadastrados.

Critério: somente identidade + comprovante de residência **bloqueiam** o botão "CONTINUAR" na Etapa 02. Os demais ficam visíveis como "Opcional agora — pode enviar depois no Arsenal" (comportamento atual já preservado).

### 2. Loader dinâmico
Novo helper `src/lib/quero-armas/etapa02Checklist.ts`:
- `fetchChecklistEtapa02(servicoSlug)` → resolve `slug → servico_id` (via `qa_servicos_catalogo`) → consulta `qa_servicos_documentos` filtrando `etapa='02'` ordenado por `ordem`.
- Retorna `DocItem[]` no mesmo shape que `Etapa02Documentos.tsx` já espera (`key`, `label`, `obrigatorio_etapa02`, `shortName`).
- **Fallback Zero-Regression**: se a query falhar ou vier vazia, devolve a lista universal hardcoded atual (identidade + comprovante + CPF). Nunca quebra o wizard.

### 3. Refator de `Etapa02Documentos.tsx`
- Trocar `useMemo(docsForSlug)` por `useEffect` que chama o loader e guarda em estado.
- Loading state inline (skeleton dos 2 cards obrigatórios) enquanto carrega — não bloqueia visualmente o wizard.
- Manter intacto: upload, extração IA, reaproveitamento Arsenal, validações de 20MB.
- `DOC_TIPOS_RELEVANTES_ETAPA02` (mapa para casamento com Arsenal) passa a derivar dinamicamente do `tipo_documento` retornado pelo banco.

### 4. Roteamento `?servico=` para CAC / Esporte
Em `QACadastroRefinadoPage.tsx`:
- Hoje `?servico=` só pula para step 1 se for slug de Defesa Pessoal. Tornar agnóstico: resolver o slug em `qa_servicos_catalogo` na montagem e ir direto para Etapa 01 confirmação (step 1) seja qual for a família.
- Se o slug não existir no catálogo: cair em Etapa 00 (escolha guiada) como hoje.

## Fora de escopo (não mexer)
- Geração de protocolo (Wave 3D, já funcionando).
- Lista de docs do **Arsenal pós-pagamento** (já lê de `qa_servicos_documentos` corretamente).
- Banner "TUDO PRONTO · ANÁLISE CONCLUÍDA" no header (cosmético, vai em Wave separada).
- Login com senha em `/cadastro-v2` (decisão de UX é OTP, manter).

## Detalhes técnicos
- Migration via tool `supabase--migration` (única tabela: `qa_servicos_documentos`, adicionando coluna + UPDATE inicial).
- Loader usa cliente Supabase normal (anon) — `qa_servicos_documentos` já é leitura pública (validar RLS na migration; se não for, adicionar policy `FOR SELECT USING (true)`).
- Sem mudança em edge functions.
- Sem mudança em `src/integrations/supabase/types.ts` manual — vai regenerar após migration.

## Validação pós-implementação
Repetir o teste E2E dos 3 cenários:
1. `/cadastro-v2?servico=posse-de-arma-de-fogo&retomar=1` → Etapa 02 deve mostrar 24 docs (2 obrigatórios + 22 opcionais).
2. `/cadastro-v2?servico=porte-arma-fogo&retomar=1` → 29 docs, **incluindo `comprovante_efetiva_necessidade`**.
3. `/cadastro-v2?servico=autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac&retomar=1` → vai direto para Etapa 01 CAC (não cai em Defesa Pessoal), Etapa 02 mostra `habilitacao_cacador_ibama`.

## Risco
**Baixo–médio**. Wizard de cadastro é fluxo estável → manter fallback hardcoded é mandatório (Zero Regression). Migration toca só 1 coluna nova com default seguro.
