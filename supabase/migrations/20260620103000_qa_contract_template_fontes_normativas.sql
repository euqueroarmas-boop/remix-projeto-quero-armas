BEGIN;

UPDATE public.qa_contract_templates
   SET corpo_html = replace(
         replace(
           replace(
             corpo_html,
             'Decreto nº 13.826/2025',
             'Decreto nº 12.345/2024'
           ),
           'Lei nº 10.826/2003 (Estatuto do Desarmamento), Decreto nº 11.615/2023, Decreto nº 12.345/2024, Lei nº 8.078/1990',
           'Lei nº 10.826/2003 (Estatuto do Desarmamento), Decreto nº 11.615/2023, Decreto nº 12.345/2024, Instruções Normativas DG/PF nº 201 e 311, Portarias COLOG nº 166, 167 e 260, Ofício Circular nº 08/DELEARM, Lei nº 8.078/1990'
         ),
         'em especial os requisitos do Estatuto do Desarmamento (Lei nº 10.826/2003) e regulamentos vigentes',
         'em especial os requisitos do Estatuto do Desarmamento (Lei nº 10.826/2003), Decreto nº 11.615/2023, Decreto nº 12.345/2024, Instruções Normativas DG/PF nº 201 e 311, Portarias COLOG nº 166, 167 e 260, Ofício Circular nº 08/DELEARM e demais regulamentos vigentes'
       ),
       observacoes = trim(coalesce(observacoes, '') || E'\nAtualizado em 2026-06-20: fontes normativas ajustadas para Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e 311, Portarias COLOG 166/167/260 e Ofício Circular 08/DELEARM.'),
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true;

COMMIT;
