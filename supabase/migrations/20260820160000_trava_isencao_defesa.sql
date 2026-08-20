-- =============================================================================
-- TRAVA DAS ISENÇÕES DE DEFESA — 20/08/2026
-- -----------------------------------------------------------------------------
-- As isenções de `exige_peca_defesa` decididas pelo titular são POR SLUG, não
-- por categoria: segunda via de CRAF (é cópia, sem mérito), transferência de
-- propriedade (a defesa é de quem recebe a arma, não de quem transfere) e os
-- dois cursos de pistola (treinamento, não petição na PF).
--
-- O risco: qualquer re-execução do UPDATE em massa "liga defesa em tudo que
-- não é CAC" religa essas quatro linhas sem querer, porque nenhuma delas é
-- categoria SINARM CAC. Aconteceria em silêncio e o painel voltaria a cobrar
-- peça de serviço que não tem peça.
--
-- A trava: coluna `defesa_isencao_travada` + gatilho que, ao ver alguém tentar
-- ligar `exige_peca_defesa` numa linha travada, mantém `false` e avisa por
-- NOTICE — sem abortar o UPDATE em massa (um EXCEPTION derrubaria a instrução
-- inteira, inclusive as linhas certas).
--
-- Para mudar de ideia num serviço travado (decisão consciente, em duas etapas):
--   UPDATE public.qa_servicos_catalogo SET defesa_isencao_travada = false WHERE slug = '...';
--   UPDATE public.qa_servicos_catalogo SET exige_peca_defesa = true      WHERE slug = '...';
-- =============================================================================

ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS defesa_isencao_travada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.qa_servicos_catalogo.defesa_isencao_travada IS
  'Isenção de defesa decidida pelo titular (20/08/2026). Enquanto true, o gatilho qa_trg_trava_isencao_defesa impede que exige_peca_defesa volte a true — inclusive em UPDATE em massa. Para reverter: primeiro destravar, depois ligar.';

UPDATE public.qa_servicos_catalogo
   SET defesa_isencao_travada = true,
       exige_peca_defesa = false
 WHERE slug IN (
   'segunda-via-de-craf-digital',
   'transferencia-de-propriedade-de-arma-de-fogo',
   'operador-de-pistola-nivel-i',
   'vip-operador-de-pistola-nivel-i'
 );

CREATE OR REPLACE FUNCTION public.qa_trava_isencao_defesa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.defesa_isencao_travada AND NEW.exige_peca_defesa THEN
    RAISE NOTICE 'qa_servicos_catalogo: "%" tem isenção de defesa TRAVADA — exige_peca_defesa mantido em false. Para ligar, destrave antes (defesa_isencao_travada = false).', NEW.slug;
    NEW.exige_peca_defesa := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_trg_trava_isencao_defesa ON public.qa_servicos_catalogo;
CREATE TRIGGER qa_trg_trava_isencao_defesa
  BEFORE INSERT OR UPDATE ON public.qa_servicos_catalogo
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trava_isencao_defesa();
