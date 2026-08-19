-- ============================================================================
-- CR: filiação à LNTD com passo a passo, boleto pago pela equipe, grupo
-- depois dos exames, e modelo para baixar em TODAS as declarações
-- ----------------------------------------------------------------------------
-- Decisões do titular (19/08/2026):
--
--   1. A filiação é o passo MAIS CRÍTICO E DEMORADO do CR, e a declaração de
--      filiação VEM DO CLUBE (Liga Nacional de Tiro Defensivo — LNTD), não de
--      modelo nosso. O fluxo real: o cliente se filia no site da LNTD → recebe
--      o BOLETO da filiação (não é PIX — é boleto) → envia o boleto para a
--      equipe → A EQUIPE PAGA → a LNTD reconhece o pagamento → o cliente entra
--      no sistema da LNTD, baixa a declaração de filiação, assina no gov.br e
--      envia. Por isso a filiação vira DOIS itens: o boleto (cliente envia,
--      equipe paga) e a declaração assinada.
--
--   2. O grupo da filiação (Habitualidade e clube) fica DEPOIS dos exames
--      psicológico e de tiro. A fila do cliente segue a ordem numérica do
--      checklist, então basta renumerar: laudos terminam em 480, habitualidade
--      passa a 483–486, requerimento continua em 499+.
--
--   3. As declarações NÃO levam cabeçalho nem rodapé da Quero Armas, e TODAS
--      precisam do botão "baixar preenchida com meus dados". Hoje só três
--      têm modelo; DSA, DEGA, 2º endereço e não-possuir-2º estavam SEM botão
--      — o cliente não tinha o que baixar. Este bloco aponta cada uma para o
--      seu template. Os arquivos .docx limpos (sem cabeçalho) foram gerados e
--      precisam ser subidos no Storage ANTES de o cliente clicar:
--      bucket `qa-templates`, pasta `declaracoes/`, um arquivo por chave.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) Tipo novo: boleto da filiação ────────────────────────────────────────
INSERT INTO public.qa_tipos_documento_catalogo (
  tipo_documento, categoria_hub, subcategoria_hub, escopo_documental,
  label_publico, descricao_upload, aceita_ia, aceita_vinculo_arma,
  exige_validade, reaproveitavel_global, revisao_humana_obrigatoria,
  regime, ativo, ordem, fonte_normativa
) VALUES (
  'boleto_filiacao_entidade', 'cac_atividade', NULL, 'processo',
  'Boleto da filiação à entidade de tiro',
  'Boleto gerado pela entidade de tiro na sua filiação. A equipe paga por você.',
  true, false, false, false, false, 'cac', true, 905,
  ARRAY['IN DG/PF 311/2025, art. 18, § 2º, II, b']
)
ON CONFLICT (tipo_documento) DO UPDATE
  SET label_publico = EXCLUDED.label_publico, ativo = true, updated_at = now();

-- ── 2) O passo da filiação, na ordem real e depois dos exames ───────────────
-- 2a. Boleto da filiação (novo item; o cliente envia, a EQUIPE paga).
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  condicao_profissional, condicao_modalidade, validade_dias, orgao_emissor,
  instrucoes, observacoes_cliente, regra_validacao
)
SELECT 44, 'boleto_filiacao_entidade',
       'Boleto da filiação à LNTD — a equipe paga por você',
       'tecnico', 483, true, false, true, 'cliente', 'processo',
       ARRAY['pdf','jpg','jpeg','png'], NULL, ARRAY['atirador','cacador'], NULL,
       'Liga Nacional de Tiro Defensivo',
       '1) Acesse o site da Liga Nacional de Tiro Defensivo (LNTD) e faça o seu '
       || 'cadastro na área de filiação.\n'
       || '2) Ao concluir o cadastro, a LNTD gera o BOLETO da filiação. ATENÇÃO: '
       || 'é boleto, não é PIX.\n'
       || '3) NÃO pague o boleto. Anexe-o aqui — a nossa equipe paga por você.\n'
       || '4) Depois do pagamento, a LNTD leva um tempo para reconhecer a '
       || 'compensação. Assim que reconhecer, o próximo passo é liberado.',
       'Este é o passo mais crítico e demorado do processo. Envie o boleto assim '
       || 'que ele for gerado — quanto antes chegar, antes pagamos.',
       jsonb_build_object('grupo_checklist', 'habitualidade',
                          'ordem_grupo_checklist', 63,
                          'label_botao', 'ENVIAR BOLETO DA FILIAÇÃO')
 WHERE NOT EXISTS (
   SELECT 1 FROM public.qa_servicos_documentos
    WHERE servico_id = 44 AND tipo_documento = 'boleto_filiacao_entidade'
 );

-- 2b. Declaração de filiação: vem da LNTD, assinada no gov.br. Sem modelo nosso.
UPDATE public.qa_servicos_documentos
   SET ordem           = 484,
       nome_documento  = 'Declaração de filiação à LNTD, assinada no gov.br',
       instrucoes      = '1) Aguarde a LNTD reconhecer o pagamento do boleto que a nossa equipe fez.\n'
       || '2) Entre no sistema da LNTD com o seu cadastro.\n'
       || '3) Baixe a sua DECLARAÇÃO DE FILIAÇÃO — ela é emitida pelo próprio clube.\n'
       || '4) Assine o PDF digitalmente no gov.br (assinatura nível prata ou ouro).\n'
       || '5) Anexe aqui o PDF assinado — o sistema confere a assinatura automaticamente.',
       observacoes_cliente = 'A declaração vem do clube — não há modelo para baixar aqui. '
       || 'Sem ela assinada o requerimento do CR não pode ser protocolado.',
       regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('assinatura_requerida', 'govbr',
                                               'ordem_grupo_checklist', 64,
                                               'label_botao', 'ENVIAR DECLARAÇÃO ASSINADA'),
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'comprovante_filiacao_entidade_tiro';

-- 2c. Compromisso de habitualidade: nosso modelo, com os dados do clube.
UPDATE public.qa_servicos_documentos
   SET ordem           = 485,
       regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('ordem_grupo_checklist', 65,
                                               'template_key', 'declaracao_compromisso_habitualidade',
                                               'label_botao', 'ENVIAR DECLARAÇÃO ASSINADA'),
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'declaracao_compromisso_habitualidade';

-- 2d. Documento do Ibama acompanha o grupo (segue dormente: só caçador).
UPDATE public.qa_servicos_documentos
   SET ordem           = 486,
       regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('ordem_grupo_checklist', 66),
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'habilitacao_cacador_ibama';

-- ── 3) Botão "baixar preenchida" nas declarações que estavam SEM modelo ─────
UPDATE public.qa_servicos_documentos sd
   SET regra_validacao = COALESCE(sd.regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('template_key', v.template_key,
                                               'label_botao', 'ENVIAR DECLARAÇÃO ASSINADA'),
       updated_at      = now()
  FROM (VALUES
    ('dsa_declaracao_seguranca_acervo',        'dsa_declaracao_seguranca_acervo'),
    ('declaracao_endereco_acervo',             'declaracao_endereco_acervo'),
    ('declaracao_guarda_acervo_2enderecos',    'declaracao_guarda_acervo_2enderecos'),
    ('declaracao_nao_possuir_segundo_endereco','declaracao_nao_possuir_segundo_endereco')
  ) AS v(tipo, template_key)
 WHERE sd.servico_id = 44 AND sd.ativo AND sd.tipo_documento = v.tipo;

-- ── 4) Espelha tudo nos processos de CR em aberto ───────────────────────────
UPDATE public.qa_processo_documentos pd
   SET nome_documento      = sd.nome_documento,
       instrucoes          = sd.instrucoes,
       observacoes_cliente = sd.observacoes_cliente,
       ordem               = sd.ordem,
       regra_validacao     = COALESCE(pd.regra_validacao, '{}'::jsonb) || sd.regra_validacao,
       updated_at          = now()
  FROM public.qa_processos p, public.qa_servicos_documentos sd
 WHERE p.id = pd.processo_id
   AND p.servico_id = 44
   AND public.qa_processo_em_aberto(p.status)
   AND sd.servico_id = 44
   AND sd.ativo
   AND sd.tipo_documento = pd.tipo_documento
   AND pd.tipo_documento IN (
     'comprovante_filiacao_entidade_tiro', 'declaracao_compromisso_habitualidade',
     'habilitacao_cacador_ibama', 'dsa_declaracao_seguranca_acervo',
     'declaracao_endereco_acervo', 'declaracao_guarda_acervo_2enderecos',
     'declaracao_nao_possuir_segundo_endereco'
   );

-- Reexplosão aditiva: insere o boleto da filiação nos abertos.
DO $$
DECLARE r record; v_res record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.qa_processos p
     WHERE p.servico_id = 44 AND public.qa_processo_em_aberto(p.status)
  LOOP
    SELECT * INTO v_res FROM public.qa_explodir_checklist_processo(r.id);
    RAISE NOTICE 'Processo %: % exigência(s) inserida(s)', r.id, v_res.inseridos;
  END LOOP;
END $$;

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- ÚNICA CONSULTA (o editor exporta só o último resultado): confere de uma vez
-- (a) a sequência exames → filiação → requerimento e (b) quais templates de
-- declaração EXISTEM no Storage — é a resposta definitiva de "tem declaração
-- falhando?". Todo template_key com arquivo = ok; sem arquivo = falta subir.
--
-- SELECT 'checklist' AS bloco, to_jsonb(t.*) AS dados FROM (
--   SELECT ordem, tipo_documento, emissor,
--          regra_validacao ->> 'grupo_checklist' AS grupo,
--          regra_validacao ->> 'template_key'    AS template_key
--     FROM public.qa_servicos_documentos
--    WHERE servico_id = 44 AND ativo AND ordem BETWEEN 440 AND 510
--    ORDER BY ordem
-- ) t
-- UNION ALL
-- SELECT 'storage', to_jsonb(s.*) FROM (
--   SELECT name, created_at
--     FROM storage.objects
--    WHERE bucket_id = 'qa-templates' AND name LIKE 'declaracoes/%'
--    ORDER BY name
-- ) s;
