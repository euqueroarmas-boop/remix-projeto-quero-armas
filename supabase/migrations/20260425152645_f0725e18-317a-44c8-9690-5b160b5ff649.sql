-- Catálogo curado de armamentos brasileiros (referência técnica)
CREATE TABLE IF NOT EXISTS public.qa_armamentos_catalogo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  apelido TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('pistola','revolver','espingarda','carabina','fuzil','submetralhadora','outra')),
  calibre TEXT NOT NULL,
  capacidade_carregador INTEGER,
  peso_gramas INTEGER,
  comprimento_cano_mm INTEGER,
  alcance_efetivo_m INTEGER,
  velocidade_projetil_ms INTEGER,
  origem TEXT,
  classificacao_legal TEXT,
  descricao TEXT,
  -- Stats normalizados 0-100 estilo armory (para barras visuais)
  stat_dano INTEGER CHECK (stat_dano BETWEEN 0 AND 100),
  stat_precisao INTEGER CHECK (stat_precisao BETWEEN 0 AND 100),
  stat_alcance INTEGER CHECK (stat_alcance BETWEEN 0 AND 100),
  stat_cadencia INTEGER CHECK (stat_cadencia BETWEEN 0 AND 100),
  stat_mobilidade INTEGER CHECK (stat_mobilidade BETWEEN 0 AND 100),
  stat_controle INTEGER CHECK (stat_controle BETWEEN 0 AND 100),
  search_tokens TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_armamentos_catalogo_search
  ON public.qa_armamentos_catalogo USING GIN (to_tsvector('simple', coalesce(search_tokens,'')));

CREATE INDEX IF NOT EXISTS idx_qa_armamentos_catalogo_marca_modelo
  ON public.qa_armamentos_catalogo (marca, modelo);

ALTER TABLE public.qa_armamentos_catalogo ENABLE ROW LEVEL SECURITY;

-- Leitura pública autenticada (catálogo de referência)
CREATE POLICY "qa_armamentos_catalogo_select_all"
ON public.qa_armamentos_catalogo
FOR SELECT
USING (true);

-- Trigger updated_at
CREATE TRIGGER qa_armamentos_catalogo_updated
BEFORE UPDATE ON public.qa_armamentos_catalogo
FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- Seed inicial (modelos mais comuns no Brasil para CACs)
INSERT INTO public.qa_armamentos_catalogo
  (marca, modelo, apelido, tipo, calibre, capacidade_carregador, peso_gramas, comprimento_cano_mm, alcance_efetivo_m, velocidade_projetil_ms, origem, classificacao_legal, descricao,
   stat_dano, stat_precisao, stat_alcance, stat_cadencia, stat_mobilidade, stat_controle, search_tokens)
VALUES
  -- PISTOLAS
  ('Taurus','G2C',NULL,'pistola','9MM',12,765,86,50,360,'Brasil','Uso Permitido','Pistola compacta semiautomática, popular para defesa pessoal e CACs.',
   62,68,55,72,82,70,'TAURUS G2C 9MM PT'),
  ('Taurus','G3C',NULL,'pistola','9MM',12,737,86,50,365,'Brasil','Uso Permitido','Evolução do G2C com gatilho refinado e mira melhorada.',
   64,72,58,74,82,74,'TAURUS G3C 9MM'),
  ('Taurus','TH9',NULL,'pistola','9MM',17,780,108,55,365,'Brasil','Uso Permitido','Pistola full size de ação dupla/simples, alta capacidade.',
   66,75,60,72,68,80,'TAURUS TH9 9MM'),
  ('Taurus','TH40',NULL,'pistola','.40',15,780,108,55,335,'Brasil','Uso Permitido','Versão .40 S&W da linha TH, alta letalidade.',
   78,72,58,68,66,72,'TAURUS TH40 .40'),
  ('Taurus','TH380',NULL,'pistola','.380',15,755,108,40,295,'Brasil','Uso Permitido','Pistola full size em .380 ACP.',
   52,72,48,76,72,82,'TAURUS TH380 .380'),
  ('Taurus','PT840','840','pistola','.40',15,808,102,50,335,'Brasil','Uso Permitido','Pistola .40 da linha 24/7 evoluída.',
   78,70,58,68,66,72,'TAURUS PT840 .40'),
  ('Taurus','TX22',NULL,'pistola','.22 LR',16,468,102,40,335,'Brasil','Uso Permitido','Pistola .22 LR para treino e CACs, leve e econômica.',
   28,82,42,82,90,88,'TAURUS TX22 .22 LR'),
  ('Glock','G17','Glock 17','pistola','9MM',17,710,114,50,375,'Áustria','Uso Restrito','Pistola full size adotada por forças policiais no mundo todo.',
   68,82,62,76,72,82,'GLOCK G17 17 9MM'),
  ('Glock','G19','Glock 19','pistola','9MM',15,670,102,45,360,'Áustria','Uso Restrito','Pistola compacta versátil, padrão de carry tático.',
   66,80,58,76,80,80,'GLOCK G19 19 9MM'),
  ('Glock','G25','Glock 25','pistola','.380',15,570,102,40,295,'Áustria','Uso Permitido','Versão .380 do G19, popular entre CACs no Brasil.',
   52,78,46,76,82,82,'GLOCK G25 25 .380'),
  ('Glock','G26',NULL,'pistola','9MM',10,615,87,40,350,'Áustria','Uso Restrito','Subcompacta para carry discreto.',
   64,76,52,74,88,75,'GLOCK G26 9MM'),
  ('Imbel','MD1','Imbel 1911','pistola','.45',7,1100,127,50,253,'Brasil','Uso Restrito','Pistola .45 ACP no padrão 1911, fabricação Imbel.',
   88,80,62,58,52,68,'IMBEL MD1 1911 .45'),
  ('Beretta','92FS',NULL,'pistola','9MM',15,950,125,50,381,'Itália','Uso Restrito','Pistola militar histórica, ação dupla/simples.',
   68,80,62,72,62,80,'BERETTA 92FS 9MM'),

  -- REVÓLVERES
  ('Taurus','RT85','85S','revolver','.38',5,640,51,30,260,'Brasil','Uso Permitido','Revólver compacto 5 tiros, ideal para defesa pessoal.',
   58,62,42,40,84,68,'TAURUS RT85 85 .38'),
  ('Taurus','RT82','82','revolver','.38',6,910,102,40,260,'Brasil','Uso Permitido','Revólver service 6 tiros, cano 4".',
   60,72,52,42,68,76,'TAURUS RT82 82 .38'),
  ('Taurus','RT605','605','revolver','.357',5,680,51,40,440,'Brasil','Uso Restrito','Revólver compacto em .357 Magnum, alta energia.',
   82,68,58,40,76,62,'TAURUS RT605 605 .357'),
  ('Rossi','R85',NULL,'revolver','.38',5,650,51,30,260,'Brasil','Uso Permitido','Revólver Rossi 5 tiros, calibre .38 SPL.',
   58,62,42,40,84,66,'ROSSI R85 .38'),
  ('Smith & Wesson','M&P 360',NULL,'revolver','.357',5,395,46,40,440,'EUA','Uso Restrito','Revólver ultraleve em scandium.',
   82,66,55,40,90,58,'SW SMITH WESSON M&P 360 .357'),

  -- ESPINGARDAS
  ('CBC','Pump 12','Pump','espingarda','CAL .12',5,3200,711,50,400,'Brasil','Uso Restrito','Espingarda pump action calibre 12, defesa e tiro esportivo.',
   92,58,55,30,42,55,'CBC PUMP 12 CALIBRE 12 GA'),
  ('CBC','ST12',NULL,'espingarda','CAL .12',2,2900,711,50,400,'Brasil','Uso Restrito','Espingarda ação dupla CBC.',
   92,55,52,28,46,55,'CBC ST12 CALIBRE 12'),
  ('Mossberg','500',NULL,'espingarda','CAL .12',6,3200,508,50,400,'EUA','Uso Restrito','Espingarda pump action militar/policial.',
   92,60,55,32,44,58,'MOSSBERG 500 CALIBRE 12'),

  -- CARABINAS
  ('CBC','7022','Bolinha','carabina','.22 LR',10,2400,533,100,335,'Brasil','Uso Permitido','Carabina semiautomática .22 LR, popular para CACs.',
   32,82,68,72,72,84,'CBC 7022 .22 LR BOLINHA'),
  ('CBC','8122',NULL,'carabina','.22 LR',10,2700,533,100,335,'Brasil','Uso Permitido','Carabina .22 LR ação ferrolho.',
   34,86,72,38,68,90,'CBC 8122 .22 LR'),
  ('Taurus','CT9','CT-9','carabina','9MM',10,3100,407,100,420,'Brasil','Uso Restrito','Carabina semiautomática 9mm, formato PCC.',
   72,75,68,82,62,80,'TAURUS CT9 CT-9 9MM PCC'),
  ('Taurus','CT40','CT-40','carabina','.40',10,3100,407,100,400,'Brasil','Uso Restrito','Carabina semiautomática .40, formato PCC.',
   80,72,68,78,60,78,'TAURUS CT40 CT-40 .40'),
  ('Taurus','CT30','CT-30','carabina','.30',10,3100,407,100,610,'Brasil','Uso Restrito','Carabina semiautomática .30 carbine.',
   76,80,82,72,60,78,'TAURUS CT30 CT-30 .30 CARBINE'),

  -- FUZIS
  ('Imbel','IA2',NULL,'fuzil','7.62',20,4400,533,600,840,'Brasil','Uso Restrito','Fuzil de assalto brasileiro adotado pelas Forças Armadas.',
   92,82,92,72,52,75,'IMBEL IA2 7.62 FUZIL'),
  ('Colt','M4',NULL,'fuzil','5.56',30,3000,368,500,884,'EUA','Uso Restrito','Carabina M4 padrão OTAN, plataforma AR-15.',
   78,85,82,82,72,80,'COLT M4 5.56 AR-15'),
  ('Taurus','T4',NULL,'fuzil','5.56',30,3100,368,500,950,'Brasil','Uso Restrito','Fuzil semiautomático brasileiro plataforma AR-15.',
   78,82,82,80,72,78,'TAURUS T4 5.56 AR-15')
ON CONFLICT DO NOTHING;