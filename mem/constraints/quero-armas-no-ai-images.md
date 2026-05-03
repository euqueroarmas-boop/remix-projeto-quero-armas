---
name: QA - Proibição absoluta de imagens IA na Base
description: Imagens da Base de Conhecimento devem ser exclusivamente reais/auditáveis. Geração por IA está permanentemente bloqueada (DB trigger + edge function 410).
type: constraint
---
PROIBIDO em qualquer circunstância gerar, criar ou salvar imagens via IA (Gemini, OpenAI, DALL·E, Stable Diffusion, etc.) na Base de Conhecimento Quero Armas.

Tipos aceitos em `qa_kb_artigo_imagens.image_type`:
- screenshot_real
- upload_manual
- documento_real
- auditoria_real

Bloqueios ativos:
- CHECK constraint do enum sem `imagem_ia`
- Trigger BEFORE INSERT/UPDATE `qa_kb_block_ia_images` rejeita `imagem_ia`
- Edge functions `qa-kb-generate-article-images` e `qa-kb-backfill-images` retornam 410 (AI_IMAGE_GENERATION_DISABLED)
- UI sem botão de "Gerar imagens" — só "Enviar screenshot real"

**Why:** Risco jurídico, conteúdo ilustrativo gera ruído operacional. Base = material de prova auditável, não ilustração.
