---
name: Comprovante de endereço em nome de terceiro
description: Regra do grupo de comprovação de endereço — comprovante de terceiro só cumpre a exigência após declaração do responsável assinada no GOV.BR
type: feature
---
Vale para QUALQUER processo que use o grupo de comprovação de endereço:

- Comprovante de residência em nome de terceiro NUNCA aprova sozinho. É gravado com `ia_dados_extraidos.aguardando_declaracao_responsavel = true` e status `pendente_aprovacao` (a trigger `qa_doc_auto_aprovar_por_ia` respeita esse flag e não aprova nem reprova).
- A exigência do grupo permanece ABERTA (não pula de grupo) até a Declaração do Responsável pelo Imóvel ser enviada assinada no GOV.BR e validada por `qa-declaracao-residencia`.
- Ao validar a assinatura, a Edge Function aprova o comprovante vinculado (`documento_comprovante_id`). Se a assinatura falhar, o comprovante volta a pendente com o motivo visível.
- O reaproveitamento automático da Central de Documentos (`qa_reaproveitar_documentos_hub_processo`) IGNORA comprovantes de residência com `endereco_em_nome_de_terceiro = true` ou `aguardando_declaracao_responsavel = true` enquanto não existir `qa_declaracoes_residencia.status = 'assinada_validada'` vinculada. Regra central: `public.qa_comprovante_terceiro_pendente(documento_id)`.

## PARSE-01 / CPF-01 — quem lê e quem decide a titularidade

- Comprovante de endereço é documento estruturado: quem lê é o **parser** (`src/lib/quero-armas/parserComprovanteResidencia.ts`, port do `danf3eParser`). A IA só entra se o parser não reconhecer o layout.
- Titularidade é decidida por `avaliarTitularidadeComprovante` (`src/lib/quero-armas/titularComprovante.ts`), nunca por soma de divergência de string. Estados do CPF: `valido` (11 dígitos + DV), `mascarado`, `ausente`.
- CPF mascarado/ilegível = **indeterminada**, NÃO é terceiro e NÃO reprova. O sistema pergunta o CPF ao cliente (`ConfrontoCpfComprovanteModal`) e confronta com os dígitos visíveis. Sem resposta, o documento fica pendente.
- Confronto bate + CPF igual ao cadastro → própria. Confronto bate + CPF diferente → terceiro (abre declaração do responsável).
- Garantia no servidor: `trg_qa_doc_normalizar_titularidade_comprovante` grava `endereco_em_nome_de_terceiro` a partir de `ia_dados_extraidos.comprovante_residencia_titularidade` e rebaixa para `pendente_aprovacao` qualquer aprovação de terceiro sem declaração validada.
