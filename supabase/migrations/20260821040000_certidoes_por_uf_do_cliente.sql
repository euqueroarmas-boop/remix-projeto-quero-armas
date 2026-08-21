-- =============================================================================
-- CERTIDÃO DO ESTADO DO CLIENTE — nunca mais pedir papel que ele não pode tirar
-- -----------------------------------------------------------------------------
-- Decisão do titular (21/08/2026): "o cliente deve receber os links das
-- certidões do seu estado apenas e os da União. As certidões devem ser
-- disponibilizadas para o que é possível baixar e quem tem coerência. Não é
-- possível um cliente do Paraná baixar uma certidão do TJM."
--
-- Respostas do titular às duas perguntas em aberto:
--   1) Cliente de São Paulo tira AS DUAS federais (regional + Seção Judiciária),
--      igual aos demais estados. Isso encerra a divergência entre a decisão de
--      30/07 ("paulista tira só a regional") e os três dossiês DEFERIDOS do
--      serviço 50, que levaram as duas.
--   2) Aplicar também nos processos JÁ ABERTOS.
--
-- ─── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────
--
-- Todo cliente, de qualquer estado, recebia a lista com nome e link de São
-- Paulo, e nos serviços 44/50/60 recebia ainda a certidão do Tribunal de
-- Justiça Militar como OBRIGATÓRIA. TJM estadual só existe em SP, MG e RS: o
-- cliente do Paraná ficava com um item obrigatório sem lugar onde emitir, e o
-- checklist dele nunca fechava.
--
-- A regra territorial chegou a ser escrita em 30/07 (migration
-- 20260730160000), mas NUNCA foi aplicada — conferido em 21/08: a coluna
-- `condicao_uf` não existe no banco. E, mesmo que existisse, não adiantaria:
-- a migration 20260812203000 reescreveu o montador de checklist DEPOIS, sem o
-- filtro territorial. Por isso esta migration arruma os dois lados.
--
-- ─── DUAS ESCOLHAS DE PROJETO QUE SEGURAM O RISCO ────────────────────────────
--
-- 1) NENHUM CÓDIGO DE DOCUMENTO NOVO. A tentativa de 30/07 criava um código por
--    região e por estado (`antecedentes_federal_regional_trf1..6`,
--    `..._secao_judiciaria_xx`): 32 linhas de catálogo por serviço, mais
--    apelidos, biblioteca e prompts de IA. Aqui não se cria código nenhum. Os
--    códigos atuais já são genéricos — o próprio leitor de certidões diz, em
--    src/lib/quero-armas/parsersCertidoes.ts, que
--    `antecedentes_federal_trf3_regional` "continua sendo o código das seis
--    regiões" e lê do papel a região de verdade.
--
-- 2) O NOME É CORRIGIDO POR SUBSTITUIÇÃO, NÃO REESCRITO. Em vez de gerar um
--    nome novo — o que renomearia em massa também as linhas do cliente de São
--    Paulo, que estão certas, e quebraria o casamento com os nomes canônicos do
--    Hub —, esta migration troca só os pedaços que dizem São Paulo: TRF3 vira
--    TRF4, TJSP vira TJPR, "Seção Judiciária de SP" vira "Seção Judiciária de
--    PR". Consequência importante: PARA CLIENTE DE SÃO PAULO NADA MUDA, nem
--    nome nem link (os links de SP do mapa são idênticos aos do catálogo). E o
--    nome da certidão do TJM, definido pelo titular em 07/08, fica intacto —
--    ele não tem pedaço de São Paulo para trocar.
--
-- ─── ALCANCE (ATENÇÃO: COMPORTAMENTO COMPARTILHADO) ──────────────────────────
--
-- Conferido em 21/08: QUINZE serviços têm certidões presas a São Paulo
-- (2, 6, 31, 32, 33, 35, 36, 37, 38, 41, 42, 44, 48, 50, 60). O nome, o órgão
-- emissor e o link passam a seguir a UF do cliente em TODOS eles. Nenhum
-- checklist ganha ou perde item por causa disso.
--
-- A ÚNICA mudança de composição é a certidão do TJM, que existe apenas nos
-- serviços 44, 50 e 60 e passa a ser pedida só de quem mora em SP, MG ou RS.
--
-- UF em branco no cadastro NÃO filtra nada: o comportamento antigo continua
-- valendo até o endereço existir. Ninguém deixa de receber exigência por falta
-- de dado.
--
-- ─── O QUE OS BACKFILLS NÃO TOCAM ────────────────────────────────────────────
--
--   • processo que não está mais montando dossiê (protocolado, em análise no
--     órgão, notificado, em recurso, deferido, indeferido, concluído,
--     cancelado, bloqueado) — depois do protocolo o dossiê congela, mesmo
--     princípio da 20260821010000;
--   • processo de cliente apagado por LGPD;
--   • linha com arquivo entregue, em QUALQUER um dos dois campos de arquivo;
--   • linha em status que já conta como cumprida.
--
-- Idempotente. Escrito em DUAS transações: a primeira cria estrutura e regra,
-- a segunda corrige os processos — assim o backfill não segura lock de DDL no
-- catálogo enquanto roda.
-- =============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 1 — estrutura e regra                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- ─── 1) O mapa dos 27 estados ────────────────────────────────────────────────
-- Espelho de src/lib/quero-armas/linksAntecedentesPorUf.ts. Os dois mudam
-- juntos. Regiões da Justiça Federal: TRF1 (AC AP AM BA DF GO MA MT PA PI RO
-- RR TO), TRF2 (RJ ES), TRF3 (SP MS), TRF4 (RS SC PR), TRF5 (PE CE AL SE PB
-- RN), TRF6 (MG, desde 2022).
--
-- `tj_sigla` é dado, não conta: no Distrito Federal o tribunal é o TJDFT, e
-- não "TJDF" como sairia de uma regra "TJ + sigla do estado".
CREATE TABLE IF NOT EXISTS public.qa_uf_certidao (
  uf         char(2) PRIMARY KEY,
  nome_uf    text     NOT NULL,
  trf_numero smallint NOT NULL CHECK (trf_numero BETWEEN 1 AND 6),
  tj_sigla   text     NOT NULL,
  trf_link   text,
  tj_link    text,
  pc_link    text,
  tjm_link   text,           -- só SP, MG e RS têm Tribunal de Justiça Militar
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_uf_certidao
  ADD COLUMN IF NOT EXISTS tj_sigla text;

COMMENT ON TABLE public.qa_uf_certidao IS
  'Tribunal e portal de emissão de cada certidão de antecedentes, por UF de '
  'residência. Espelho de src/lib/quero-armas/linksAntecedentesPorUf.ts. '
  'tjm_link só é preenchido em SP, MG e RS — nos demais estados não existe '
  'Tribunal de Justiça Militar estadual.';

INSERT INTO public.qa_uf_certidao
  (uf, nome_uf, trf_numero, tj_sigla, trf_link, tj_link, pc_link, tjm_link) VALUES
  ('AC','Acre',1,'TJAC','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://www.tjac.jus.br/servicos/certidoes/','https://www.pc.ac.gov.br/',NULL),
  ('AL','Alagoas',5,'TJAL','https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes','https://www2.tjal.jus.br/certidaoOnline/','https://policiacivil.al.gov.br/servicos/atestado-de-antecedentes-criminais',NULL),
  ('AP','Amapá',1,'TJAP','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://tucujuris.tjap.jus.br/','https://www.policiacivil.ap.gov.br/',NULL),
  ('AM','Amazonas',1,'TJAM','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://consultasaj.tjam.jus.br/sco/abrirCadastro.do','https://www.pc.am.gov.br/atestado-de-antecedentes-criminais/',NULL),
  ('BA','Bahia',1,'TJBA','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','http://esaj.tjba.jus.br/sco/abrirCadastro.do','https://servicos.policiacivil.ba.gov.br/atestado-de-antecedentes/',NULL),
  ('CE','Ceará',5,'TJCE','https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes','https://esaj.tjce.jus.br/sco/abrirCadastro.do','https://www.pc.ce.gov.br/servicos/atestado-de-antecedentes-criminais/',NULL),
  ('DF','Distrito Federal',1,'TJDFT','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://cnc.tjdft.jus.br/','https://www.pcdf.df.gov.br/servicos/atestado-de-antecedentes-criminais',NULL),
  ('ES','Espírito Santo',2,'TJES','https://www10.trf2.jus.br/portal/certidoes/','https://sistemas.tjes.jus.br/certidaonegativa/sistemas/certidaonegativa/CERTIDAOPESQUISA.cfm','https://pc.es.gov.br/atestado-de-antecedentes-criminais',NULL),
  ('GO','Goiás',1,'TJGO','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://www.tjgo.jus.br/index.php/servicos/certidoes','https://www.policiacivil.go.gov.br/',NULL),
  ('MA','Maranhão',1,'TJMA','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://www.tjma.jus.br/servicos/certidoes-online','https://www.pc.ma.gov.br/',NULL),
  ('MT','Mato Grosso',1,'TJMT','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://cia.tjmt.jus.br/publico/CartaoDeCredito','https://www.pjc.mt.gov.br/atestado-de-antecedentes',NULL),
  ('MS','Mato Grosso do Sul',3,'TJMS','https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao','https://esaj.tjms.jus.br/sco/abrirCadastro.do','https://www.pc.ms.gov.br/',NULL),
  ('MG','Minas Gerais',6,'TJMG','https://portal.trf6.jus.br/servicos/certidoes/','https://www8.tjmg.jus.br/juridico/certidaoJudicial/publico/formConsultaAntecedentes.jsf','https://atestado.policiacivil.mg.gov.br/','https://www.tjmmg.jus.br/index.php/servicos/certidoes'),
  ('PA','Pará',1,'TJPA','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://consultas.tjpa.jus.br/certidaoportalexterno/','https://www.policiacivil.pa.gov.br/servicos/atestado-de-antecedentes-criminais/',NULL),
  ('PB','Paraíba',5,'TJPB','https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes','https://app.tjpb.jus.br/certidaoonline/pages/publico/consulta-registro-solicitacao.xhtml','https://www.policiacivil.pb.gov.br/',NULL),
  ('PR','Paraná',4,'TJPR','https://www2.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=1471','https://portal.tjpr.jus.br/certidoes/publico/consultaSolicitacao.do','https://www.policiacivil.pr.gov.br/servicos/atestado-de-antecedentes-criminais',NULL),
  ('PE','Pernambuco',5,'TJPE','https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes','https://portaltjpe.tjpe.jus.br/servicos/certidoes/certidao-judicial','https://antecedentes.policiacivil.pe.gov.br/',NULL),
  ('PI','Piauí',1,'TJPI','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://www.tjpi.jus.br/certidoesonline/','https://www.pc.pi.gov.br/',NULL),
  ('RJ','Rio de Janeiro',2,'TJRJ','https://www10.trf2.jus.br/portal/certidoes/','https://www3.tjrj.jus.br/certidoeseletronicas/publico/solicitacao/incluir','https://portalservicos.policiacivilrj.net.br/',NULL),
  ('RN','Rio Grande do Norte',5,'TJRN','https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes','https://www.tjrn.jus.br/index.php/servicos/certidoes','https://www.pc.rn.gov.br/',NULL),
  ('RS','Rio Grande do Sul',4,'TJRS','https://www2.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=1471','https://www.tjrs.jus.br/novo/servicos-e-consultas/certidoes/','https://ww4.pc.rs.gov.br/pcnet-fs-web/','https://www.tjmrs.jus.br/servicos/certidoes'),
  ('RO','Rondônia',1,'TJRO','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://webapp.tjro.jus.br/certidao/pages/certidao/emissaoCertidao.xhtml','https://www.pc.ro.gov.br/',NULL),
  ('RR','Roraima',1,'TJRR','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://certidao.tjrr.jus.br/','https://www.pc.rr.gov.br/',NULL),
  ('SC','Santa Catarina',4,'TJSC','https://www2.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=1471','https://esaj.tjsc.jus.br/sco/abrirCadastro.do','https://www.pc.sc.gov.br/servicos/atestado-de-antecedentes',NULL),
  ('SP','São Paulo',3,'TJSP','https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao','https://esaj.tjsp.jus.br/sco/abrirCadastro.do','https://servicos.sp.gov.br/fcarta/259d189e-dc87-4308-9812-7abed7494412','https://certidaocriminal.tjmsp.jus.br/'),
  ('SE','Sergipe',5,'TJSE','https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes','https://www.tjse.jus.br/portal/servicos/certidoes-1','https://www.ssp.se.gov.br/',NULL),
  ('TO','Tocantins',1,'TJTO','https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/','https://wwa.tjto.jus.br/certidaonada/','https://www.policiacivil.to.gov.br/',NULL)
ON CONFLICT (uf) DO UPDATE
   SET nome_uf    = EXCLUDED.nome_uf,
       trf_numero = EXCLUDED.trf_numero,
       tj_sigla   = EXCLUDED.tj_sigla,
       trf_link   = EXCLUDED.trf_link,
       tj_link    = EXCLUDED.tj_link,
       pc_link    = EXCLUDED.pc_link,
       tjm_link   = EXCLUDED.tjm_link,
       updated_at = now();

ALTER TABLE public.qa_uf_certidao ALTER COLUMN tj_sigla SET NOT NULL;

GRANT SELECT ON public.qa_uf_certidao TO authenticated, anon, service_role;
ALTER TABLE public.qa_uf_certidao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qa_uf_certidao_leitura ON public.qa_uf_certidao;
-- Tabela de referência pública: só links de tribunal, nenhum dado de pessoa.
-- Sem cláusula TO, para não deixar nenhum papel lendo zero linha em silêncio.
CREATE POLICY qa_uf_certidao_leitura ON public.qa_uf_certidao
  FOR SELECT USING (true);

-- ─── 2) Normalizador de UF ───────────────────────────────────────────────────
-- O cadastro grava o estado às vezes como sigla ("PR"), às vezes por extenso
-- ("Paraná", "parana", "PARANÁ"). Devolve sempre a sigla, ou NULL se não
-- reconhecer — e NULL significa "não filtra nada".
CREATE OR REPLACE FUNCTION public.qa_uf_normalizar(p_estado text)
RETURNS char(2)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH limpo AS (
    SELECT lower(btrim(coalesce(p_estado, ''))) AS v,
           translate(lower(btrim(coalesce(p_estado, ''))),
                     'áàâãäéèêëíìîïóòôõöúùûüç',
                     'aaaaaeeeeiiiiooooouuuuc') AS sem_acento
  )
  SELECT c.uf
    FROM limpo l
    JOIN public.qa_uf_certidao c
      ON lower(c.uf) = l.v
      OR lower(c.nome_uf) = l.v
      OR translate(lower(c.nome_uf), 'áàâãäéèêëíìîïóòôõöúùûüç',
                                     'aaaaaeeeeiiiiooooouuuuc') = l.sem_acento
   WHERE l.v <> ''
   ORDER BY c.uf
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.qa_uf_normalizar(text) IS
  'Sigla da UF a partir de sigla ou nome por extenso, com ou sem acento. '
  'NULL quando não reconhece — nesse caso nenhuma regra territorial se aplica.';

-- ─── 3) Texto e link da certidão conforme a UF ───────────────────────────────
-- CORRIGE POR SUBSTITUIÇÃO. Recebe o texto atual (nome do documento ou órgão
-- emissor) e troca só os pedaços que dizem São Paulo. Devolve NULL quando
-- nada muda — quem chama usa COALESCE, então NULL = fica como está. Por isso
-- o cliente de São Paulo não sofre alteração nenhuma, e o nome do TJM (que não
-- carrega pedaço de SP) permanece o que o titular definiu em 07/08.
--
-- Fora das certidões territoriais devolve NULL: Justiça Eleitoral e Justiça
-- Militar da União valem para o país inteiro.
CREATE OR REPLACE FUNCTION public.qa_certidao_texto_por_uf(p_texto text, p_tipo text, p_uf text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(
           replace(
           replace(
           replace(
           replace(
           replace(
           replace(
           replace(p_texto,
             'TJMSP',                  'TJM' || c.uf),
             'TJM-SP',                 'TJM-' || c.uf),
             'TRF3',                   'TRF' || c.trf_numero),
             'TJSP',                   c.tj_sigla),
             'SJSP',                   'SJ' || c.uf),
             'Seção Judiciária de SP', 'Seção Judiciária de ' || c.uf),
             'Secao Judiciaria de SP', 'Secao Judiciaria de ' || c.uf),
           p_texto)
    FROM public.qa_uf_certidao c
   WHERE c.uf = public.qa_uf_normalizar(p_uf)
     AND p_texto IS NOT NULL
     AND btrim(lower(coalesce(p_tipo,''))) IN (
           'antecedentes_federal_trf3_regional',
           'antecedentes_federal_sjsp_jef',
           'antecedentes_estadual_distribuicao',
           'antecedentes_estadual_execucoes',
           'antecedentes_criminais',
           'antecedentes_militar_estadual');
$$;

COMMENT ON FUNCTION public.qa_certidao_texto_por_uf(text, text, text) IS
  'Troca no texto os pedaços presos a São Paulo (TRF3, TJSP, SJSP, Seção '
  'Judiciária de SP) pelos do estado do cliente. NULL quando nada muda, '
  'quando o tipo não é certidão territorial ou quando a UF é desconhecida.';

-- O link do portal do estado. Aqui é substituição de valor mesmo: o cliente
-- precisa do endereço do tribunal dele. Para São Paulo os endereços do mapa
-- são idênticos aos que já estão no catálogo, então nada muda.
--
-- A certidão REGIONAL e a da SEÇÃO JUDICIÁRIA saem do MESMO portal do TRF,
-- mudando a opção de abrangência — é assim que o leitor de certidões do
-- sistema distingue as duas ("Abrangência: Regional" x "Seção Judiciária").
--
-- O TJM devolve NULL onde não existe tribunal militar estadual: nunca se
-- inventa um portal de "TJM do Paraná".
CREATE OR REPLACE FUNCTION public.qa_certidao_link_por_uf(p_tipo text, p_uf text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE btrim(lower(coalesce(p_tipo, '')))
    WHEN 'antecedentes_federal_trf3_regional' THEN c.trf_link
    WHEN 'antecedentes_federal_sjsp_jef'      THEN c.trf_link
    WHEN 'antecedentes_estadual_distribuicao' THEN c.tj_link
    WHEN 'antecedentes_estadual_execucoes'    THEN c.tj_link
    WHEN 'antecedentes_criminais'             THEN c.pc_link
    WHEN 'antecedentes_militar_estadual'      THEN c.tjm_link
    ELSE NULL
  END
  FROM public.qa_uf_certidao c
 WHERE c.uf = public.qa_uf_normalizar(p_uf);
$$;

COMMENT ON FUNCTION public.qa_certidao_link_por_uf(text, text) IS
  'Portal de emissão da certidão na UF do cliente. Regional e Seção '
  'Judiciária saem do mesmo portal do TRF, mudando a abrangência.';

GRANT EXECUTE ON FUNCTION public.qa_uf_normalizar(text)                    TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.qa_certidao_texto_por_uf(text,text,text)  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.qa_certidao_link_por_uf(text, text)       TO authenticated, anon, service_role;

-- ─── 4) A etiqueta de estado no catálogo ─────────────────────────────────────
ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS condicao_uf text[];

COMMENT ON COLUMN public.qa_servicos_documentos.condicao_uf IS
  'UFs de residência que recebem esta exigência. NULL = todas. Lido por '
  'qa_explodir_checklist_processo e por qa_catalogo_do_processo. Hoje só a '
  'certidão do TJM usa: SP, MG, RS. Linha de TJM criada DEPOIS desta migration '
  'precisa nascer com esta marcação — a conferência (C) no rodapé acusa.';

-- O TJM passa a ser pedido só de quem tem para onde ir.
UPDATE public.qa_servicos_documentos
   SET condicao_uf = ARRAY['SP','MG','RS'],
       updated_at  = now()
 WHERE tipo_documento = 'antecedentes_militar_estadual'
   AND condicao_uf IS DISTINCT FROM ARRAY['SP','MG','RS'];

-- ─── 5) O montador de checklist passa a ler a etiqueta de estado ────────────
-- Cópia fiel da definição vigente (migration 20260812203000) com CINCO pontos
-- alterados, todos marcados com "NOVO" no corpo: a variável da UF, a leitura
-- da UF do cadastro, o filtro territorial, a correção de nome/órgão/link e a
-- UF registrada no evento de log. Nenhuma outra regra da função foi tocada.

CREATE OR REPLACE FUNCTION public.qa_explodir_checklist_processo(p_processo_id uuid)
 RETURNS TABLE(inseridos integer, ja_existentes integer, reaproveitados_cofre integer, pre_validados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proc                public.qa_processos%ROWTYPE;
  v_cli                 public.qa_clientes%ROWTYPE;
  v_condicao            text;
  v_respostas           jsonb;
  v_profissao_upper     text;
  v_modalidade          text;
  v_uf                  text;   -- NOVO: UF de residência do cliente
  v_ins                 integer := 0;
  v_exi                 integer := 0;
  v_dup                 integer := 0;
  v_invalid             integer := 0;
  v_prevalid            integer := 0;
  v_endereco_seed       integer := 0;
  v_endereco_aproveit   integer := 0;
  v_inserted_tipos      text[] := ARRAY[]::text[];
  v_existing_tipos      text[] := ARRAY[]::text[];
  v_duplicate_tipos     text[] := ARRAY[]::text[];
  v_invalid_items       jsonb := '[]'::jsonb;
  v_reuso               record;
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo % nao encontrado', p_processo_id;
  END IF;

  IF v_proc.servico_id IS NULL THEN
    RAISE EXCEPTION 'Processo % sem servico_id - fallback Posse proibido', p_processo_id;
  END IF;

  SELECT * INTO v_cli FROM public.qa_clientes WHERE id = v_proc.cliente_id;

  v_condicao := lower(btrim(COALESCE(NULLIF(v_proc.condicao_profissional, ''), 'indefinido')));
  v_profissao_upper := NULLIF(TRIM(UPPER(COALESCE(v_cli.profissao, ''))), '');
  v_modalidade := NULLIF(TRIM(LOWER(COALESCE(v_proc.modalidade, ''))), '');
  -- NOVO: UF do cadastro, normalizada (aceita sigla ou nome por extenso).
  v_uf := public.qa_uf_normalizar(v_cli.estado);

  -- Respostas ja conhecidas: questionario do processo + colunas dedicadas.
  v_respostas := COALESCE(v_proc.respostas_questionario_json, '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
         'condicao_profissional', NULLIF(v_proc.condicao_profissional, '')
       ));

  WITH catalogo_bruto AS (
    SELECT sd.*,
           CASE
             WHEN sd.etapa IN ('base','complementar','tecnico','final') THEN sd.etapa
             WHEN sd.etapa = 'antecedentes' THEN 'base'
             WHEN sd.etapa = 'declaracoes' THEN 'complementar'
             WHEN sd.etapa = 'renda' THEN 'complementar'
             ELSE 'base'
           END AS etapa_segura,
           (sd.etapa IS NULL OR sd.etapa NOT IN ('base','complementar','tecnico','final')) AS etapa_invalida,
           row_number() OVER (
             PARTITION BY sd.tipo_documento
             ORDER BY
               CASE WHEN sd.condicao_profissional IS NULL THEN 0 ELSE 1 END,
               COALESCE(sd.ordem, 999),
               sd.created_at,
               sd.id
           ) AS rn
      FROM public.qa_servicos_documentos sd
     WHERE sd.servico_id = v_proc.servico_id
       AND sd.ativo = true
       -- CORRIGIDO: `condicao_profissional` aceita VARIAS condicoes separadas por
       -- virgula ("autonomo,empresario"). A igualdade exata so casava com o valor
       -- unico, entao Cartao CNPJ, QSA e Nota Fiscal nunca entravam no checklist
       -- de autonomo/empresario (e Identidade Funcional/contracheque nunca
       -- entravam no de funcionario_publico/seguranca_publica). Mesma regra que a
       -- edge function qa-processo-set-condicao ja usava.
       AND (sd.condicao_profissional IS NULL
            OR v_condicao = ANY (
                 SELECT btrim(lower(x))
                   FROM unnest(string_to_array(sd.condicao_profissional, ',')) AS x
               ))
       AND (sd.condicao_modalidade IS NULL
            OR v_modalidade IS NULL
            OR v_modalidade = ANY(sd.condicao_modalidade))
       -- NOVO: exigência territorial. Linha com `condicao_uf` só entra para
       -- quem mora numa daquelas UFs. UF desconhecida NÃO filtra nada — o
       -- comportamento antigo continua valendo até o cadastro ter endereço.
       AND (sd.condicao_uf IS NULL
            OR v_uf IS NULL
            OR v_uf = ANY(sd.condicao_uf))
       -- Placeholder da condicao profissional: nunca renasce depois de respondido.
       AND NOT (sd.tipo_documento = 'renda_definir_condicao' AND v_condicao <> 'indefinido')
       -- Qualquer pergunta ja respondida nao volta como pendencia.
       AND NOT (
         COALESCE(sd.regra_validacao ->> 'tipo', '') = 'pergunta'
         AND COALESCE(sd.regra_validacao ->> 'chave', '') <> ''
         AND COALESCE(v_respostas ->> (sd.regra_validacao ->> 'chave'), '') <> ''
       )
  ),
  desejados AS (SELECT * FROM catalogo_bruto WHERE rn = 1),
  duplicados AS (SELECT * FROM catalogo_bruto WHERE rn > 1),
  ja AS (SELECT DISTINCT tipo_documento FROM public.qa_processo_documentos WHERE processo_id = p_processo_id),
  inserted AS (
    INSERT INTO public.qa_processo_documentos (
      processo_id, cliente_id, tipo_documento, nome_documento, etapa,
      status, obrigatorio, validade_dias, formato_aceito, regra_validacao, link_emissao,
      instrucoes, observacoes_cliente, modelo_url, exemplo_url, orgao_emissor,
      prazo_recomendado_dias, escopo, ordem
    )
    SELECT p_processo_id, v_proc.cliente_id, d.tipo_documento,
           CASE WHEN v_profissao_upper IS NOT NULL
                 AND (d.tipo_documento ILIKE 'renda_%' OR d.tipo_documento ILIKE '%atividade%')
                THEN d.nome_documento || ' — ' || v_profissao_upper
                -- NOVO: troca os pedaços "São Paulo" do nome pelos do estado do
                -- cliente. Devolve NULL quando nada muda, e o catálogo prevalece.
                ELSE COALESCE(public.qa_certidao_texto_por_uf(d.nome_documento, d.tipo_documento, v_uf),
                              d.nome_documento) END,
           d.etapa_segura, 'pendente', COALESCE(d.obrigatorio, true),
           d.validade_dias, d.formato_aceito, d.regra_validacao,
           -- NOVO: link do portal da UF do cliente.
           COALESCE(public.qa_certidao_link_por_uf(d.tipo_documento, v_uf), d.link_emissao),
           d.instrucoes, d.observacoes_cliente, d.modelo_url, d.exemplo_url,
           -- NOVO: o órgão emissor acompanha o nome.
           COALESCE(public.qa_certidao_texto_por_uf(d.orgao_emissor, d.tipo_documento, v_uf),
                    d.orgao_emissor),
           d.prazo_recomendado_dias,
           COALESCE(d.escopo, 'processo'), d.ordem
      FROM desejados d
     WHERE NOT EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)
    RETURNING tipo_documento
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM inserted), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), 0)::int,
    COALESCE((SELECT COUNT(*) FROM duplicados), 0)::int,
    COALESCE((SELECT COUNT(*) FROM desejados d WHERE d.etapa_invalida), 0)::int,
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM inserted), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(d.tipo_documento ORDER BY d.tipo_documento) FROM desejados d WHERE EXISTS (SELECT 1 FROM ja j WHERE j.tipo_documento = d.tipo_documento)), ARRAY[]::text[]),
    COALESCE((SELECT array_agg(tipo_documento ORDER BY tipo_documento) FROM duplicados), ARRAY[]::text[]),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo_documento', d.tipo_documento, 'etapa_original', d.etapa, 'etapa_usada', d.etapa_segura) ORDER BY d.tipo_documento) FROM desejados d WHERE d.etapa_invalida), '[]'::jsonb)
  INTO v_ins, v_exi, v_dup, v_invalid, v_inserted_tipos, v_existing_tipos, v_duplicate_tipos, v_invalid_items;

  IF v_invalid > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_etapa_invalida_normalizada',
      format('Catálogo com %s etapa(s) inválida(s).', v_invalid),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'itens', v_invalid_items),
      'sistema');
  END IF;

  IF v_dup > 0 THEN
    INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
    VALUES (p_processo_id, 'checklist_duplicados_ignorados',
      format('Checklist ignorou %s item(ns) duplicado(s).', v_dup),
      jsonb_build_object('servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao, 'tipos_documento', v_duplicate_tipos),
      'sistema');
  END IF;

  IF v_cli.cep IS NOT NULL AND v_cli.endereco IS NOT NULL
     AND v_cli.cidade IS NOT NULL AND v_cli.estado IS NOT NULL THEN
    UPDATE public.qa_processo_documentos
       SET observacoes = COALESCE(observacoes,'') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
             '] Endereço pré-preenchido do cadastro: ' ||
             v_cli.endereco || ', ' || COALESCE(v_cli.numero, 's/n') || ' - ' ||
             v_cli.cidade || '/' || v_cli.estado || ' - CEP ' || v_cli.cep,
           updated_at = now()
     WHERE processo_id = p_processo_id
       AND tipo_documento ILIKE '%comprovante_residencia%'
       AND status = 'pendente';
    GET DIAGNOSTICS v_prevalid = ROW_COUNT;
  END IF;

  IF v_proc.servico_id IN (31, 44, 50, 51) THEN
    BEGIN
      v_endereco_seed     := public.qa_seed_endereco_5_anos(p_processo_id);
      v_endereco_aproveit := public.qa_aproveitar_endereco_cadastro_publico(p_processo_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'qa_seed_endereco_5_anos / aproveitar falhou: %', SQLERRM;
    END;
  END IF;

  SELECT * INTO v_reuso
    FROM public.qa_reaproveitar_documentos_hub_processo(p_processo_id, 'checklist_explodido_pos_seed');

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  VALUES (p_processo_id, 'checklist_explodido',
    format('Checklist explodido: %s ins, %s exist, %s dup, %s inv, %s cofre, %s slots end5anos, %s end aproveitados (svc=%s, cond=%s).',
           v_ins, v_exi, v_dup, v_invalid, COALESCE(v_reuso.reaproveitados, 0), v_endereco_seed, v_endereco_aproveit, v_proc.servico_id, v_condicao),
    jsonb_build_object(
      'servico_id', v_proc.servico_id, 'condicao_profissional', v_condicao,
      'uf_residencia', v_uf,   -- NOVO
      'documentos_inseridos', v_inserted_tipos,
      'documentos_ja_existentes', v_existing_tipos,
      'documentos_ignorados_por_duplicidade', v_duplicate_tipos,
      'documentos_com_etapa_invalida_normalizada', v_invalid_items,
      'reaproveitados_cofre', COALESCE(v_reuso.reaproveitados, 0),
      'pre_validados', v_prevalid,
      'endereco_5_anos_slots_criados', v_endereco_seed,
      'endereco_cadastro_publico_aproveitado', v_endereco_aproveit
    ), 'sistema');

  inseridos := v_ins;
  ja_existentes := v_exi;
  reaproveitados_cofre := COALESCE(v_reuso.reaproveitados, 0);
  pre_validados := v_prevalid;
  RETURN NEXT;
END;
$function$;

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — os processos que já estão abertos                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Separada da primeira de propósito: assim a correção dos processos não segura
-- o lock de DDL do catálogo enquanto roda.
BEGIN;

-- Silencia os dois gatilhos de "documento mudou de status" durante a dispensa
-- em massa. Sem isso, cada TJM dispensado vira um aviso no sino do Admin com o
-- título "Documento recebido — em análise", para documento que ninguém enviou.
-- Mesmo padrão da migration 20260813000000. O gatilho de log de evento continua
-- ligado, que é o registro de auditoria.
DO $off$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                 JOIN pg_class c ON c.oid = g.tgrelid
                WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos DISABLE TRIGGER %I', t);
    END IF;
  END LOOP;
END $off$;

-- 6.1 Nome, órgão emissor e link passam a ser os do estado do cliente.
--     Só onde o texto realmente muda (cliente de São Paulo não é tocado) e só
--     em linha que o cliente ainda vai emitir: documento já entregue continua
--     com o nome do papel que está guardado.
UPDATE public.qa_processo_documentos pd
   SET nome_documento = COALESCE(
         public.qa_certidao_texto_por_uf(pd.nome_documento, pd.tipo_documento, cl.estado),
         pd.nome_documento),
       orgao_emissor  = COALESCE(
         public.qa_certidao_texto_por_uf(pd.orgao_emissor, pd.tipo_documento, cl.estado),
         pd.orgao_emissor),
       link_emissao   = COALESCE(
         public.qa_certidao_link_por_uf(pd.tipo_documento, cl.estado),
         pd.link_emissao),
       updated_at     = now()
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
 WHERE p.id = pd.processo_id
   -- só processo que ainda está montando dossiê
   AND p.status IN ('aguardando_pagamento','aguardando_assinatura',
                    'aguardando_documentos','em_validacao','pendente_cliente',
                    'revisao_humana','validado','pagamento_confirmado',
                    'em_analise_interna')
   AND COALESCE(cl.status, '') <> 'excluido_lgpd'
   -- nunca mexe em documento entregue ou já resolvido
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
   AND pd.status NOT IN ('aprovado','validado','conforme','concluido','concluído',
                         'entregue','entregue_pelo_hub','dispensado',
                         'dispensado_grupo','dispensado_por_reaproveitamento',
                         'nao_aplicavel')
   -- e só quando há de fato o que mudar
   AND (public.qa_certidao_texto_por_uf(pd.nome_documento, pd.tipo_documento, cl.estado) IS NOT NULL
     OR public.qa_certidao_texto_por_uf(pd.orgao_emissor,  pd.tipo_documento, cl.estado) IS NOT NULL
     OR pd.link_emissao IS DISTINCT FROM
          COALESCE(public.qa_certidao_link_por_uf(pd.tipo_documento, cl.estado), pd.link_emissao));

-- 6.2 A exigência impossível do TJM sai do caminho de quem não é SP/MG/RS.
--     NÃO apaga: marca como não aplicável, que o checklist já conta como
--     cumprida. Mesmas travas do 6.1 — documento entregue continua no lugar.
UPDATE public.qa_processo_documentos pd
   SET status      = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes,'') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Dispensada: o Tribunal de Justiça Militar estadual existe apenas em ' ||
         'SP, MG e RS, e o cliente reside em ' || public.qa_uf_normalizar(cl.estado) || '.',
       updated_at  = now()
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento = 'antecedentes_militar_estadual'
   AND p.status IN ('aguardando_pagamento','aguardando_assinatura',
                    'aguardando_documentos','em_validacao','pendente_cliente',
                    'revisao_humana','validado','pagamento_confirmado',
                    'em_analise_interna')
   AND COALESCE(cl.status, '') <> 'excluido_lgpd'
   AND public.qa_uf_normalizar(cl.estado) IS NOT NULL
   AND public.qa_uf_normalizar(cl.estado) NOT IN ('SP','MG','RS')
   AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
   AND pd.status NOT IN ('aprovado','validado','conforme','concluido','concluído',
                         'entregue','entregue_pelo_hub','dispensado',
                         'dispensado_grupo','dispensado_por_reaproveitamento',
                         'nao_aplicavel');

-- Religa os gatilhos e aborta se algum ficar desligado.
DO $on$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                 JOIN pg_class c ON c.oid = g.tgrelid
                WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos ENABLE TRIGGER %I', t);
    END IF;
  END LOOP;
END $on$;

DO $chk$
DECLARE v_off text;
BEGIN
  SELECT string_agg(g.tgname, ', ') INTO v_off
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
   WHERE c.relname = 'qa_processo_documentos'
     AND g.tgname IN ('trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo')
     AND g.tgenabled = 'D';
  IF v_off IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: gatilho(s) ficaram desligados: %', v_off;
  END IF;
END $chk$;

-- 6.3 O nome guardado em cache no cabeçalho do processo acompanha o rename.
UPDATE public.qa_processos p
   SET prazo_critico_doc_nome = pd.nome_documento
  FROM public.qa_processo_documentos pd
 WHERE pd.id = p.prazo_critico_doc_id
   AND p.prazo_critico_doc_nome IS DISTINCT FROM pd.nome_documento;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) O mapa entrou completo — esperado: 27 UFs, 3 com TJM, DF como TJDFT.
--
-- SELECT count(*) AS ufs,
--        count(*) FILTER (WHERE tjm_link IS NOT NULL) AS com_tjm,
--        max(tj_sigla) FILTER (WHERE uf='DF')          AS sigla_do_df
--   FROM public.qa_uf_certidao;
--
-- B) Teste do Paraná x São Paulo. Esperado: para o PR, TRF4/TJPR/PR e TJM
--    VAZIO; para SP, TODAS as colunas de nome VAZIAS (nada muda) e os links
--    iguais aos que já estão no catálogo.
--
-- SELECT t AS tipo,
--        public.qa_certidao_texto_por_uf('Certidão Federal TRF3 — Abrangência Regional', t, 'Paraná')    AS nome_pr,
--        public.qa_certidao_texto_por_uf('Certidão Federal TRF3 — Abrangência Regional', t, 'São Paulo') AS nome_sp,
--        public.qa_certidao_link_por_uf(t, 'Paraná') AS link_pr
--   FROM unnest(ARRAY['antecedentes_federal_trf3_regional',
--                     'antecedentes_federal_sjsp_jef',
--                     'antecedentes_estadual_distribuicao',
--                     'antecedentes_estadual_execucoes',
--                     'antecedentes_criminais',
--                     'antecedentes_militar_estadual',
--                     'antecedentes_eleitoral']) AS t;
--
-- C) Toda linha de TJM do catálogo tem de estar marcada SP/MG/RS. Linha nova
--    criada depois desta migration aparece aqui com condicao_uf vazia.
--
-- SELECT servico_id, tipo_documento, condicao_uf, ativo
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento = 'antecedentes_militar_estadual'
--  ORDER BY condicao_uf NULLS FIRST, servico_id;
--
-- D) Quem tinha o TJM sem poder emitir. Esperado: cliente de fora de SP/MG/RS
--    com processo em montagem aparece como 'nao_aplicavel'.
--
-- SELECT cl.nome_completo, cl.estado, p.servico_id, p.status AS status_processo,
--        pd.status AS status_documento
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p  ON p.id  = pd.processo_id
--   JOIN public.qa_clientes  cl ON cl.id = p.cliente_id
--  WHERE pd.tipo_documento = 'antecedentes_militar_estadual'
--  ORDER BY cl.estado;
--
-- E) Nenhuma certidão de processo EM MONTAGEM pode ter sobrado com texto de
--    São Paulo para cliente de fora de SP. Esperado: 0 linhas.
--    (Mato Grosso do Sul é do TRF3 de verdade, por isso está fora do filtro.)
--
-- SELECT cl.estado, pd.tipo_documento, pd.nome_documento, count(*)
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p  ON p.id  = pd.processo_id
--   JOIN public.qa_clientes  cl ON cl.id = p.cliente_id
--  WHERE p.status IN ('aguardando_pagamento','aguardando_assinatura',
--                     'aguardando_documentos','em_validacao','pendente_cliente',
--                     'revisao_humana','validado','pagamento_confirmado',
--                     'em_analise_interna')
--    AND public.qa_uf_normalizar(cl.estado) NOT IN ('SP','MS')
--    AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
--    AND (pd.nome_documento LIKE '%TJSP%' OR pd.nome_documento LIKE '%TRF3%'
--         OR pd.nome_documento LIKE '%Judiciária de SP%')
--  GROUP BY cl.estado, pd.tipo_documento, pd.nome_documento
--  ORDER BY cl.estado;
-- =============================================================================
