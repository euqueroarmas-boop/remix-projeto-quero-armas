-- v3 do Contrato de Adesão — Arsenal Inteligente
-- Insere Cláusula Décima Sétima (Arsenal Inteligente: função social, acesso por
-- login/CPF, fases processual e premium, obrigações de diligência, prazos de
-- resposta 3 dias úteis / 24 h crítico, validade das notificações eletrônicas,
-- consequências da inércia e isenção de responsabilidade por sistemas externos).
-- Renumera: 17→18, 18→19, 19→20.
-- Atualiza Cláusula 16.5 para referenciar a nova cláusula.

UPDATE public.qa_contract_templates
SET
  versao      = versao + 1,
  updated_at  = now(),
  observacoes = 'v3 — Cláusula Arsenal Inteligente (Décima Sétima): função social, acesso por login/CPF, fases processual e premium, obrigações de diligência do contratante, prazos de resposta (3 dias úteis / 24 h crítico), validade das notificações eletrônicas por e-mail e WhatsApp, consequências da inércia e isenção por sistemas externos. Cláusulas 17→18, 18→19, 19→20 renumeradas.',

  corpo_html  = replace(
    replace(
      replace(
        replace(
          corpo_html,

          -- PASSO 1 (mais interno): renomear Décima Nona → Vigésima
          '<h2>CLÁUSULA DÉCIMA NONA --- DO FORO</h2>',
          '<h2>CLÁUSULA VIGÉSIMA --- DO FORO</h2>'
        ),

        -- PASSO 2: renomear Décima Oitava → Décima Nona
        '<h2>CLÁUSULA DÉCIMA OITAVA --- DAS DISPOSIÇÕES GERAIS</h2>',
        '<h2>CLÁUSULA DÉCIMA NONA --- DAS DISPOSIÇÕES GERAIS</h2>'
      ),

      -- PASSO 3: renomear Décima Sétima → Décima Oitava
      --          E injetar nova Décima Sétima (Arsenal Inteligente) antes dela
      '<h2>CLÁUSULA DÉCIMA SÉTIMA --- DA PROPRIEDADE INTELECTUAL E DO USO DA PLATAFORMA</h2>',
      '<h2>CLÁUSULA DÉCIMA SÉTIMA --- DO ARSENAL INTELIGENTE: FUNÇÃO SOCIAL, ACESSO, FASES E DILIGÊNCIA DO CONTRATANTE</h2>
<p>17.1. <strong>Função social e escopo.</strong> O Arsenal Inteligente é o módulo tecnológico de gestão processual e documental disponibilizado pela CONTRATADA na plataforma https://www.euqueroarmas.com.br, com o objetivo de democratizar o acesso ao direito constitucional à legítima defesa (art. 5º, caput, da CF/1988) mediante redução dos custos operacionais, centralização documental e automação do acompanhamento de processos administrativos perante a Polícia Federal (SINARM) e o Exército Brasileiro (SIGMA). A disponibilização do Arsenal Inteligente constitui atividade empresarial com função social (art. 170, III, da CF/1988 e art. 421 do Código Civil).</p>
<p>17.2. <strong>Acesso à plataforma e vínculo pelo CPF.</strong> O acesso ao Arsenal Inteligente é realizado exclusivamente mediante autenticação pessoal do CONTRATANTE, podendo este utilizar, a seu exclusivo critério: (i) credenciais próprias criadas com endereço de e-mail e senha; (ii) conta Google; ou (iii) conta Apple. Independentemente do método de autenticação escolhido, todos os processos, documentos e histórico são vinculados ao CPF do CONTRATANTE, e não ao método de login. O CONTRATANTE é o único responsável pela guarda, sigilo e uso de suas credenciais de acesso, respondendo integralmente por qualquer acesso indevido decorrente de negligência na custódia dessas informações, nos termos dos arts. 186 e 927 do Código Civil e da Cláusula Décima Oitava deste contrato.</p>
<p>17.3. <strong>Natureza do Arsenal Inteligente como meio — e não substituto da diligência do Contratante.</strong> O Arsenal Inteligente é um instrumento tecnológico de organização, intermediação e acompanhamento processual. A plataforma não age de forma autônoma em nome do CONTRATANTE, não supre a inércia do CONTRATANTE perante os órgãos públicos competentes e não substitui a obrigação pessoal do CONTRATANTE de alimentar o sistema, acompanhar seus prazos e responder às solicitações dentro dos prazos estabelecidos. A responsabilidade pela execução material de cada etapa do processo permanece exclusivamente com o CONTRATANTE, nos termos dos arts. 422 e 476 do Código Civil e do art. 6º do Código de Processo Civil.</p>
<p>17.4. <strong>Fases do Arsenal Inteligente.</strong> O Arsenal Inteligente opera em duas fases distintas:</p>
<ul>
  <li><strong>Fase Processual</strong> — inclusa no serviço contratado conforme Anexo I: compreende o acompanhamento ativo do processo administrativo desde a abertura até o deferimento, arquivamento ou encerramento pelo órgão competente. Durante esta fase, o sistema emite alertas automáticos ao CONTRATANTE nos marcos de 30, 15, 7, 3 e 0 dias anteriores aos prazos processuais relevantes, por e-mail e/ou WhatsApp;</li>
  <li><strong>Fase Premium</strong> — contratada mediante assinatura anual separada (Arsenal Inteligente Premium): compreende o controle contínuo pós-processo de validade e renovação de documentos (CR, CRAF, GTE e outros), alertas de vencimento, gestão do acervo de armas e munições e demais funcionalidades descritas no plano vigente na plataforma. O acesso Premium permanece ativo durante o período pago, com carência de 3 (três) dias após o vencimento antes da suspensão das funcionalidades.</li>
</ul>
<p>17.5. <strong>Obrigações ativas e intransferíveis do Contratante no Arsenal Inteligente.</strong> Ao utilizar o Arsenal Inteligente em qualquer de suas fases, o CONTRATANTE assume, de forma pessoal e intransferível, as seguintes obrigações:</p>
<ul>
  <li>Alimentar a plataforma com todos os documentos, formulários e informações solicitados pela CONTRATADA ou pelo sistema, dentro dos prazos indicados em cada tarefa ou notificação;</li>
  <li>Monitorar ativamente o painel do Arsenal Inteligente e os canais de comunicação (e-mail e WhatsApp) cadastrados, acompanhando o andamento de cada etapa, os prazos processuais e eventuais exigências supervenientes dos órgãos públicos;</li>
  <li>Responder às solicitações da CONTRATADA e do sistema dentro dos seguintes prazos, contados do envio da notificação pela plataforma ou pelos canais oficiais: (a) <strong>3 (três) dias úteis</strong> para solicitações classificadas como regulares; (b) <strong>24 (vinte e quatro) horas úteis</strong> para solicitações classificadas como <strong>críticas</strong> pela plataforma, assim entendidas aquelas vinculadas a prazo processual com 2 (dois) ou menos dias corridos de antecedência perante o órgão público competente;</li>
  <li>Manter atualizados, na plataforma, o e-mail e o número de WhatsApp cadastrados, sendo de sua exclusiva responsabilidade qualquer perda de prazo ou informação decorrente de dados de contato desatualizados;</li>
  <li>Verificar a regularidade e validade dos documentos enviados, assumindo integral responsabilidade por documentos vencidos, ilegíveis, adulterados ou incompletos, nos termos da Cláusula Sétima deste contrato.</li>
</ul>
<p>17.6. <strong>Validade e suficiência das notificações eletrônicas.</strong> Nos termos do art. 107 do Código Civil, da Medida Provisória nº 2.200-2/2001 e do art. 6º, III, do Código de Defesa do Consumidor, todas as comunicações enviadas pela CONTRATADA ao e-mail e/ou ao WhatsApp cadastrados pelo CONTRATANTE são consideradas validamente entregues no momento do envio, independentemente de leitura, confirmação ou abertura pelo destinatário. O CONTRATANTE declara ciência expressa de que: (a) as notificações por e-mail e WhatsApp são os canais oficiais e suficientes do Arsenal Inteligente; (b) cabe ao CONTRATANTE verificar regularmente tais canais, inclusive caixa de spam, filtros e configurações de bloqueio; (c) o bloqueio do número de WhatsApp da CONTRATADA, a desativação de notificações por e-mail ou a ausência de leitura não configuram falha na prestação do serviço, não suspendem prazos e não eximem o CONTRATANTE de suas obrigações contratuais; (d) a CONTRATADA não tem obrigação de reenviar notificações já remetidas pelos canais oficiais, sendo o silêncio do CONTRATANTE interpretado como ciência da comunicação para todos os efeitos legais e contratuais.</p>
<p>17.7. <strong>Consequências da falta de diligência do Contratante.</strong> A inércia, o atraso ou o descumprimento das obrigações previstas no item 17.5, após notificação pela plataforma ou pelos canais eletrônicos oficiais, produzirá os seguintes efeitos de forma automática:</p>
<ul>
  <li>Suspensão do prazo de execução dos serviços pela CONTRATADA, pelo período correspondente à omissão do CONTRATANTE, nos termos da Cláusula Terceira deste instrumento;</li>
  <li>Exclusão de responsabilidade da CONTRATADA por perdas de prazo, indeferimentos, arquivamentos ou quaisquer prejuízos decorrentes da inércia do CONTRATANTE perante os órgãos públicos, com fundamento no art. 14, §3º, II, do Código de Defesa do Consumidor e no art. 393 do Código Civil;</li>
  <li>Justa causa para resolução contratual, sem reembolso dos valores pagos, caso a omissão do CONTRATANTE supere 10 (dez) dias úteis contados da notificação, nos termos do art. 476 do Código Civil e da Cláusula Décima Segunda deste instrumento.</li>
</ul>
<p>17.8. <strong>Isenção de responsabilidade por sistemas externos e decisões administrativas.</strong> A CONTRATADA não se responsabiliza por falhas, instabilidades, exigências supervenientes ou mudanças de critério nos sistemas externos (gov.br, SINARM, SIGMA, COLOG, SERPRO, instituições financeiras e demais plataformas governamentais), tampouco por decisões discricionárias dos órgãos competentes, mesmo que tais eventos afetem prazos ou resultados gerenciados pelo Arsenal Inteligente, nos termos da Cláusula Décima Terceira deste instrumento e do art. 393 do Código Civil.</p>
<p>17.9. <strong>Ausência de garantia de resultado.</strong> O Arsenal Inteligente é disponibilizado como ferramenta de acesso, organização e acompanhamento processual, e não como garantia de aprovação ou deferimento pelo órgão público competente. A CONTRATADA presta serviços de assessoria técnica e despacho com obrigação de meio, e não de resultado, conforme Cláusula Décima Terceira deste instrumento. Decisões da Administração Pública são discricionárias e insuscetíveis de comprometimento por qualquer parte privada.</p>
<h2>CLÁUSULA DÉCIMA OITAVA --- DA PROPRIEDADE INTELECTUAL E DO USO DA PLATAFORMA</h2>'
    ),

    -- PASSO 4: atualizar a Cláusula 16.5 para referenciar a nova cláusula
    '<p>16.5. Considera-se validamente entregue a comunicação enviada ao endereço eletrônico ou ao número de contato informado pela CONTRATANTE no momento do cadastro, sendo de sua responsabilidade mantê-los atualizados.</p>',
    '<p>16.5. Considera-se validamente entregue a comunicação enviada ao endereço eletrônico ou ao número de contato informado pela CONTRATANTE no momento do cadastro, sendo de sua responsabilidade mantê-los atualizados. As regras específicas de validade e suficiência das notificações eletrônicas no âmbito do Arsenal Inteligente, bem como os prazos de resposta e as consequências da inércia do CONTRATANTE, estão disciplinadas na Cláusula Décima Sétima deste instrumento.</p>'
  )

WHERE codigo   = 'CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS'
  AND vigente  = true;
