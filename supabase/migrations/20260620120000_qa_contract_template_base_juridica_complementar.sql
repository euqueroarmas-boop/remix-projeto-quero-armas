BEGIN;

UPDATE public.qa_contract_templates
   SET corpo_html = replace(
         replace(
           corpo_html,
           'Instruções Normativas DG/PF nº 201 e 311, Portarias COLOG nº 166, 167 e 260, Ofício Circular nº 08/DELEARM',
           'Instrução Normativa nº 201/2021-DG/PF, Instrução Normativa DG/PF nº 311/2025, Instrução Normativa DG/PF nº 322/2025, Portaria DG/PF nº 19.040/2025, Portarias COLOG nº 166, 167 e 260, Ofício Circular nº 08/DELEARM'
         ),
         'IN DG/PF 201 e 311, Portarias COLOG 166/167/260 e Ofício Circular 08/DELEARM.',
         'IN DG/PF 201/2021, IN DG/PF 311/2025, IN DG/PF 322/2025, Portaria DG/PF 19.040/2025, Portarias COLOG 166/167/260 e Ofício Circular 08/DELEARM.'
       ),
       observacoes = trim(coalesce(observacoes, '') || E'\nAtualizado em 2026-06-20: base jurídica complementar alinhada à página de legislação da Polícia Federal atualizada em 17/03/2026, incluindo IN DG/PF 322/2025 e Portaria DG/PF 19.040/2025.'),
       updated_at = now()
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true;

COMMIT;
