---
name: QA - Proibição absoluta de imagens IA na Base
description: Imagens da Base de Conhecimento devem ser exclusivamente reais/auditáveis. Geração por IA está permanentemente bloqueada (DB trigger + edge function 410). Registros antigos de IA permanecem rastreáveis e nunca podem ser reclassificados.
type: constraint
---
PROIBIDO em qualquer circunstância gerar, criar ou salvar imagens via IA (Gemini, OpenAI, DALL·E, Stable Diffusion, etc.) na Base de Conhecimento Quero Armas.

Tipos válidos em `qa_kb_artigo_imagens.image_type`:
- screenshot_real
- upload_manual
- documento_real
- auditoria_real (APENAS para evidência REAL enviada/capturada pela Equipe Quero Armas)

Rastreabilidade obrigatória:
- `original_image_type` preserva a natureza original do registro
- `is_ai_generated_blocked = true` em todo registro oriundo de IA (jamais reclassificável)
- Status especial `archived_invalid_ai` para imagens IA históricas

Bloqueios ativos:
- CHECK do enum sem `imagem_ia`
- Trigger `qa_kb_block_ia_images` rejeita `imagem_ia` E rejeita ativação/aprovação de qualquer registro com origem IA
- RLS de cliente exige `is_ai_generated_blocked=false` E `original_image_type<>'imagem_ia'`
- Filtros de UI (admin + cliente) excluem `is_ai_generated_blocked=true`
- Edge functions `qa-kb-generate-article-images` e `qa-kb-backfill-images` retornam 410

**Why:** Risco jurídico. Base = material de prova auditável, não ilustração. Imagem IA jamais pode ser apresentada como evidência real.
