-- =============================================================================
-- Remove o apelido com erro de digitação: ctps -> carteira_de_trabalho_tigital.
-- O correto (carteira_de_trabalho_digital) já existe e permanece.
-- Linha lixo: nenhum tipo de documento se chama "tigital".
-- =============================================================================

DELETE FROM public.qa_tipo_documento_aliases
 WHERE hub_tipo = 'ctps'
   AND processo_tipo = 'carteira_de_trabalho_tigital'
   AND EXISTS (
     SELECT 1 FROM public.qa_tipo_documento_aliases ok
      WHERE ok.hub_tipo = 'ctps'
        AND ok.processo_tipo = 'carteira_de_trabalho_digital'
   );
