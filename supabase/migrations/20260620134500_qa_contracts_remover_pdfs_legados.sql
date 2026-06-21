-- Forca contratos Quero Armas ja renderizados pelo template aprovado
-- a deixarem de apontar para PDFs legados gerados pelo fluxo antigo.
--
-- O PDF assinado pelo cliente e preservado. A entrega do contrato de adesao
-- passa a usar conteudo_renderizado do template CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS.

BEGIN;

UPDATE public.qa_contracts
   SET original_pdf_path = NULL,
       original_sha256 = NULL,
       company_signed_pdf_path = NULL,
       company_signed_sha256 = NULL,
       company_signed_at = NULL,
       updated_at = now()
 WHERE template_codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND conteudo_renderizado IS NOT NULL
   AND btrim(conteudo_renderizado) <> ''
   AND customer_signed_pdf_path IS NULL
   AND (
     original_pdf_path IS NOT NULL
     OR original_sha256 IS NOT NULL
     OR company_signed_pdf_path IS NOT NULL
     OR company_signed_sha256 IS NOT NULL
     OR company_signed_at IS NOT NULL
   );

COMMIT;
