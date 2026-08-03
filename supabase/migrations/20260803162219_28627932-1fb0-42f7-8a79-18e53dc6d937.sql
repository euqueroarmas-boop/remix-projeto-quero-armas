
-- ============ TRFs ============
WITH trfs(codigo, nome) AS (VALUES
  ('antecedentes_federal_trf1_regional','Certidão Federal — TRF 1ª Região (AC, AM, AP, BA, DF, GO, MA, MT, PA, PI, RO, RR, TO)'),
  ('antecedentes_federal_trf2_regional','Certidão Federal — TRF 2ª Região (ES, RJ)'),
  ('antecedentes_federal_trf3_regional','Certidão Federal — TRF 3ª Região (MS, SP)'),
  ('antecedentes_federal_trf4_regional','Certidão Federal — TRF 4ª Região (PR, RS, SC)'),
  ('antecedentes_federal_trf5_regional','Certidão Federal — TRF 5ª Região (AL, CE, PB, PE, RN, SE)'),
  ('antecedentes_federal_trf6_regional','Certidão Federal — TRF 6ª Região (MG)')
)
INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar, validade_dias, emissor_padrao, ativo)
SELECT t.codigo, t.nome, 'certidoes',
  'Certidão criminal negativa emitida pelo Tribunal Regional Federal responsável pelo seu domicílio.',
  'Baixe o PDF original com QR Code direto do site do TRF. Não são aceitas fotos ou prints.',
  90, 'Justiça Federal', true
FROM trfs t
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, categoria = 'certidoes', ativo = true, updated_at = now();

WITH trfs(codigo, nome) AS (VALUES
  ('antecedentes_federal_trf1_regional','Certidão Federal — TRF 1ª Região (AC, AM, AP, BA, DF, GO, MA, MT, PA, PI, RO, RR, TO)'),
  ('antecedentes_federal_trf2_regional','Certidão Federal — TRF 2ª Região (ES, RJ)'),
  ('antecedentes_federal_trf3_regional','Certidão Federal — TRF 3ª Região (MS, SP)'),
  ('antecedentes_federal_trf4_regional','Certidão Federal — TRF 4ª Região (PR, RS, SC)'),
  ('antecedentes_federal_trf5_regional','Certidão Federal — TRF 5ª Região (AL, CE, PB, PE, RN, SE)'),
  ('antecedentes_federal_trf6_regional','Certidão Federal — TRF 6ª Região (MG)')
)
INSERT INTO public.qa_tipos_documento_catalogo
  (tipo_documento, label_publico, categoria_hub, subcategoria_hub, escopo_documental, descricao_upload, aceita_ia, exige_validade, ativo)
SELECT t.codigo, t.nome, 'antecedentes_regularidade', 'federal',
  'permanente', 'PDF original com QR Code emitido pelo TRF competente.', true, true, true
FROM trfs t
ON CONFLICT (tipo_documento) DO UPDATE SET label_publico = EXCLUDED.label_publico, ativo = true, updated_at = now();

-- ============ Estados ============
WITH ufs(uf, nome_uf, tj) AS (VALUES
  ('AC','Acre','TJAC'),('AL','Alagoas','TJAL'),('AP','Amapá','TJAP'),('AM','Amazonas','TJAM'),
  ('BA','Bahia','TJBA'),('CE','Ceará','TJCE'),('DF','Distrito Federal','TJDFT'),('ES','Espírito Santo','TJES'),
  ('GO','Goiás','TJGO'),('MA','Maranhão','TJMA'),('MT','Mato Grosso','TJMT'),('MS','Mato Grosso do Sul','TJMS'),
  ('MG','Minas Gerais','TJMG'),('PA','Pará','TJPA'),('PB','Paraíba','TJPB'),('PR','Paraná','TJPR'),
  ('PE','Pernambuco','TJPE'),('PI','Piauí','TJPI'),('RJ','Rio de Janeiro','TJRJ'),('RN','Rio Grande do Norte','TJRN'),
  ('RS','Rio Grande do Sul','TJRS'),('RO','Rondônia','TJRO'),('RR','Roraima','TJRR'),('SC','Santa Catarina','TJSC'),
  ('SP','São Paulo','TJSP'),('SE','Sergipe','TJSE'),('TO','Tocantins','TJTO')
)
INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar, validade_dias, emissor_padrao, ativo)
SELECT 'antecedentes_estadual_' || lower(u.uf),
       'Certidão Estadual — ' || u.nome_uf || ' (' || u.tj || ')',
       'certidoes',
       'Certidão criminal negativa da Justiça Estadual de ' || u.nome_uf || ', emitida pelo ' || u.tj || '.',
       'Baixe o PDF original com QR Code direto do site do ' || u.tj || '. Não são aceitas fotos ou prints.',
       90, u.tj, true
FROM ufs u
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, categoria = 'certidoes', ativo = true, updated_at = now();

WITH ufs(uf, nome_uf, tj) AS (VALUES
  ('AC','Acre','TJAC'),('AL','Alagoas','TJAL'),('AP','Amapá','TJAP'),('AM','Amazonas','TJAM'),
  ('BA','Bahia','TJBA'),('CE','Ceará','TJCE'),('DF','Distrito Federal','TJDFT'),('ES','Espírito Santo','TJES'),
  ('GO','Goiás','TJGO'),('MA','Maranhão','TJMA'),('MT','Mato Grosso','TJMT'),('MS','Mato Grosso do Sul','TJMS'),
  ('MG','Minas Gerais','TJMG'),('PA','Pará','TJPA'),('PB','Paraíba','TJPB'),('PR','Paraná','TJPR'),
  ('PE','Pernambuco','TJPE'),('PI','Piauí','TJPI'),('RJ','Rio de Janeiro','TJRJ'),('RN','Rio Grande do Norte','TJRN'),
  ('RS','Rio Grande do Sul','TJRS'),('RO','Rondônia','TJRO'),('RR','Roraima','TJRR'),('SC','Santa Catarina','TJSC'),
  ('SP','São Paulo','TJSP'),('SE','Sergipe','TJSE'),('TO','Tocantins','TJTO')
)
INSERT INTO public.qa_tipos_documento_catalogo
  (tipo_documento, label_publico, categoria_hub, subcategoria_hub, escopo_documental, descricao_upload, aceita_ia, exige_validade, ativo)
SELECT 'antecedentes_estadual_' || lower(u.uf),
       'Certidão Estadual — ' || u.nome_uf || ' (' || u.tj || ')',
       'antecedentes_regularidade', 'estadual',
       'permanente', 'PDF original com QR Code emitido pelo ' || u.tj || '.', true, true, true
FROM ufs u
ON CONFLICT (tipo_documento) DO UPDATE SET label_publico = EXCLUDED.label_publico, ativo = true, updated_at = now();

-- ============ Genéricos viram guarda-chuva ============
UPDATE public.qa_documentos_biblioteca
   SET nome = 'Antecedentes federais (genérico — usar a região TRF do domicílio)', updated_at = now()
 WHERE codigo = 'antecedentes_federal';

UPDATE public.qa_documentos_biblioteca
   SET nome = 'Antecedentes estaduais (genérico — usar o estado do domicílio)', updated_at = now()
 WHERE codigo = 'antecedentes_estadual';

UPDATE public.qa_tipos_documento_catalogo
   SET label_publico = 'Antecedentes federais (genérico — usar a região TRF do domicílio)', updated_at = now()
 WHERE tipo_documento = 'antecedentes_federal';

UPDATE public.qa_tipos_documento_catalogo
   SET label_publico = 'Antecedentes estaduais (genérico — usar o estado do domicílio)', updated_at = now()
 WHERE tipo_documento = 'antecedentes_estadual';
