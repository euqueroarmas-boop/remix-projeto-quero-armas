
-- Corrige pacote POSSE (serviço 58): usa GT (Guia de Trânsito - SINARM/PF), não GTE (que é exclusivo CAC/Exército)
-- Também cadastra o anexo próprio do serviço 55 (GT avulso) para reuso futuro

-- 1) Anexo do serviço 55 (GT - Guia de Trânsito - PF/SINARM) - avulso
UPDATE public.qa_servicos_catalogo
SET anexo_titulo = 'I.19. GUIA DE TRÂNSITO (GT) --- POSSE / SINARM',
    anexo_corpo_html = $html$<h3>I.19. GUIA DE TRÂNSITO (GT) --- POSSE / SINARM</h3>
<p><strong>Identificador (slug): guia-de-transito-gt</strong></p>
<p>Categoria: Polícia Federal / SINARM</p>
<p>Órgão competente: Polícia Federal --- SINARM</p>
<p>Natureza do serviço: Emissão de Guia de Trânsito (GT) para transporte pontual de arma de fogo do acervo de POSSE, perante o Sistema Nacional de Armas (SINARM), administrado pela Polícia Federal. A GT é o instrumento próprio do acervo de posse (SINARM/PF) e não se confunde com a GTE (Guia de Tráfego Especial), que é instrumento exclusivo do acervo CAC (Exército/SIGMA).</p>
<p>Entregáveis: orientação técnica, conferência de checklist documental, preparação e protocolo do requerimento perante a Polícia Federal, acompanhamento até a manifestação da Administração e comunicação dos resultados à CONTRATANTE.</p>
<p>Documentos exigidos: conforme checklist específico apresentado à CONTRATANTE na plataforma, no momento da contratação ou logo após o pagamento confirmado.</p>$html$
WHERE servico_id = 55;

-- 2) Pacote POSSE (serviço 58): corrige título e regenera corpo com GT (não GTE)
UPDATE public.qa_servicos_catalogo
SET anexo_titulo = 'PACOTE: POSSE + AUTORIZAÇÃO DE COMPRA + CRAF + GT',
    anexo_corpo_html = (
      COALESCE((SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='posse-de-arma-de-fogo'), '')
      || COALESCE((SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac'), '')
      || COALESCE((SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='registro-e-apostilamento-de-arma-de-fogo-cac'), '')
      || COALESCE((SELECT anexo_corpo_html FROM public.qa_servicos_catalogo WHERE slug='guia-de-transito-gt'), '')
    )
WHERE servico_id = 58;
