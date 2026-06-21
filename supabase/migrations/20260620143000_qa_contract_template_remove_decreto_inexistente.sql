-- Remove referencia inexistente a "Decreto nº 13.826/2025" do contrato Quero Armas.
-- Mantem a base normativa definida para a Quero Armas:
-- Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024,
-- IN DG/PF 201 e 311, Portarias COLOG 166/167/260 e Oficio Circular 08/DELEARM.

BEGIN;

UPDATE public.qa_contract_templates
   SET corpo_html = replace(
         corpo_html,
         'Decreto nº 13.826/2025',
         'Decreto nº 12.345/2024'
       ),
       observacoes = trim(coalesce(observacoes, '') || E'\nCorrigido em 2026-06-20: removida referencia inexistente a Decreto 13.826/2025.'),
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND corpo_html LIKE '%Decreto nº 13.826/2025%';

UPDATE public.qa_contracts
   SET conteudo_renderizado = replace(
         conteudo_renderizado,
         'Decreto nº 13.826/2025',
         'Decreto nº 12.345/2024'
       ),
       updated_at = now()
 WHERE template_codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND conteudo_renderizado LIKE '%Decreto nº 13.826/2025%';

COMMIT;
