---
name: Grupos canônicos do checklist e escopo CAC x defesa pessoal
description: Agrupamento das exigências (antecedentes_* = Idoneidade), certidão federal SJSP/JEF obrigatória junto com TRF3 regional, e itens de acervo restritos a serviços CAC
type: feature
---
- `src/lib/quero-armas/pendenciasGrupos.ts` é a fonte única de agrupamento (cliente + admin). Todo `tipo_documento` do catálogo deve ter grupo; cair em `outros` ("Fechamento") é bug. Há teste de regressão em `__tests__/pendenciasGruposCatalogo.test.ts`.
- Prefixo `antecedentes_*` → grupo **Idoneidade** (ordem 60). `declaracao_sem_inquerito_*` e `declaracao_idoneidade*` também.
- Certidão federal: a PF exige **duas abrangências** — `antecedentes_federal_trf3_regional` E `antecedentes_federal_sjsp_jef` (Seção Judiciária de SP + JEF). Nunca deixar só a regional no checklist.
- Itens de **acervo CAC** (DSA, DEGA, guarda responsável, 2º endereço) só valem para serviços CAC (32, 33, 42, 45). Proibido exigir em serviços de defesa pessoal (2, 35, 36, 37, 41, 48, 59, 60).