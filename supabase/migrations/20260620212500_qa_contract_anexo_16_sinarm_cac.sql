-- Corrige o Anexo I.6 (Concessao de CR) para o regime atual PF/SINARM-CAC.
-- Base operacional Quero Armas: Lei 10.826/2003, Decreto 11.615/2023,
-- Decreto 12.345/2024, IN DG/PF 201 e 311.

UPDATE public.qa_contract_templates
   SET corpo_html = replace(
         replace(
           replace(
             corpo_html,
             '<section data-anexo-slug="concessao-cr">
<h3>I.6. CONCESSÃO DE CR (CERTIFICADO DE REGISTRO)</h3>
<p><strong>Identificador (slug): concessao-cr</strong></p>
<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante o Comando do Exército.</p>',
             '<section data-anexo-slug="concessao-cr">
<h3>I.6. CONCESSÃO DE CR (CERTIFICADO DE REGISTRO)</h3>
<p><strong>Identificador (slug): concessao-cr</strong></p>
<p>Categoria: Polícia Federal / SINARM-CAC</p>
<p>Órgão competente: Polícia Federal --- SINARM-CAC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante a Polícia Federal, no âmbito do SINARM-CAC.</p>'
           ),
           '<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante o Comando do Exército.</p>',
           '<p>Categoria: Polícia Federal / SINARM-CAC</p>
<p>Órgão competente: Polícia Federal --- SINARM-CAC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante a Polícia Federal, no âmbito do SINARM-CAC.</p>'
         ),
         'Atualizado em 2026-06-20: fontes normativas ajustadas',
         'Atualizado em 2026-06-20: Anexo I.6 ajustado para PF/SINARM-CAC. Fontes normativas ajustadas'
       )
 WHERE codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND vigente = true
   AND corpo_html LIKE '%I.6. CONCESSÃO DE CR%'
   AND corpo_html LIKE '%Comando do Exército --- SFPC%';

UPDATE public.qa_contracts
   SET conteudo_renderizado = replace(
         replace(
           conteudo_renderizado,
           '<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante o Comando do Exército.</p>',
           '<p>Categoria: Polícia Federal / SINARM-CAC</p>
<p>Órgão competente: Polícia Federal --- SINARM-CAC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante a Polícia Federal, no âmbito do SINARM-CAC.</p>'
         ),
         '<p>Categoria: Exército / SIGMA</p>
<p>Órgão competente: Comando do Exército --- SFPC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante o Comando do Exército.</p>',
         '<p>Categoria: Polícia Federal / SINARM-CAC</p>
<p>Órgão competente: Polícia Federal --- SINARM-CAC</p>
<p>Valor: R$ 1.239,00 (pagamento integral à vista no checkout)</p>
<p>Natureza do serviço: Despacho administrativo completo para concessão de Certificado de Registro (CR) na categoria CAC (Caçador, Atirador Esportivo ou Colecionador), perante a Polícia Federal, no âmbito do SINARM-CAC.</p>'
       )
 WHERE template_codigo = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
   AND conteudo_renderizado IS NOT NULL
   AND conteudo_renderizado LIKE '%I.6. CONCESSÃO DE CR%'
   AND conteudo_renderizado LIKE '%Comando do Exército --- SFPC%';
