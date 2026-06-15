export type InfoPageSection = {
  id?: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  numberedItems?: { title: string; body: string }[];
};

export type InfoPageLink = {
  label: string;
  to: string;
  external?: boolean;
};

export type InfoPageConfig = {
  title: string;
  description: string;
  heroEyebrow: string;
  heroTitle: string;
  heroParagraphs: string[];
  primaryCta: InfoPageLink;
  secondaryCta?: InfoPageLink;
  sections: InfoPageSection[];
  finalCta?: {
    title: string;
    description: string;
    primary: InfoPageLink;
    secondary?: InfoPageLink;
  };
};

export const aboutNavLinks = [
  { to: "/quem-somos", label: "Quem somos" },
  { to: "/como-funciona", label: "Como funciona" },
  { to: "/atendimento-nacional", label: "Atendimento nacional" },
  { to: "/limites-e-responsabilidades", label: "Limites e responsabilidades" },
  { to: "/termos", label: "Termos de uso" },
  { to: "/privacidade", label: "Política de privacidade" },
] as const;

export const infoPages: Record<string, InfoPageConfig> = {
  quemSomos: {
    title: "Quem Somos | Quero Armas",
    description:
      "Conheça a estrutura, o método e o posicionamento da Quero Armas na assessoria técnica, documental e administrativa.",
    heroEyebrow: "Quem Somos",
    heroTitle:
      "Assessoria técnica, documental e administrativa para quem busca regularidade, discrição e segurança jurídica.",
    heroParagraphs: [
      "A Quero Armas nasceu para atender pessoas que desejam conduzir processos relacionados a arma de fogo com responsabilidade, organização e respeito à legislação brasileira.",
      "Nossa atuação é voltada à orientação técnica, análise documental, preparação de processos administrativos, acompanhamento de etapas e suporte ao cliente durante a jornada de regularização, renovação, contratação de serviços e gestão de documentos.",
      "Trabalhamos com método, sigilo e clareza. O objetivo não é prometer resultado, mas reduzir improvisos, evitar erros evitáveis e oferecer ao cliente uma experiência mais segura, organizada e transparente.",
    ],
    primaryCta: { label: "Conhecer nosso método", to: "/como-funciona" },
    secondaryCta: { label: "Ver serviços disponíveis", to: "/servicos" },
    sections: [
      {
        title: "Quem é a Quero Armas",
        paragraphs: [
          "A Quero Armas é uma estrutura especializada em assessoria para serviços administrativos, documentais e técnicos relacionados ao universo regulado de armas de fogo no Brasil.",
          "Atuamos com foco em organização processual, orientação de requisitos, conferência de documentos, acompanhamento de solicitações, apoio ao cliente e integração com uma área digital própria para facilitar o envio, a revisão e o controle das informações.",
          "Nosso posicionamento é técnico, discreto e responsável. Cada cliente é tratado de forma individual, considerando seu perfil, o tipo de serviço pretendido, a documentação disponível, o histórico administrativo e as exigências aplicáveis ao caso concreto.",
          "Não trabalhamos com promessas fáceis. Trabalhamos com processo, método e responsabilidade.",
        ],
      },
      {
        title: "O que fazemos",
        paragraphs: [
          "A Quero Armas auxilia o cliente na organização e condução de serviços como:",
          "Nossa função é facilitar a jornada do cliente com uma estrutura mais profissional, segura e organizada.",
          "O cliente não fica perdido entre documentos, etapas e dúvidas. Ele passa a contar com uma metodologia de atendimento, acompanhamento e controle.",
        ],
        bullets: [
          "orientação inicial sobre o tipo de serviço mais adequado ao perfil informado;",
          "organização de cadastro e documentos;",
          "conferência técnica de informações enviadas;",
          "estruturação de processos administrativos;",
          "acompanhamento de etapas e solicitações;",
          "suporte ao cliente por meio da área do cliente;",
          "contratação de serviços relacionados ao catálogo disponível;",
          "reaproveitamento de dados e documentos já enviados, quando aplicável;",
          "comunicação clara sobre pendências, exigências e andamento.",
        ],
      },
      {
        title: "O que não fazemos",
        paragraphs: [
          "A Quero Armas não é órgão público, não representa autoridade competente e não possui qualquer poder de interferência sobre decisões administrativas.",
          "Também não prometemos deferimento, não garantimos prazo de análise, não substituímos exigências legais e não orientamos qualquer conduta incompatível com a legislação.",
          "A decisão final sobre requerimentos, autorizações, registros, renovações, portes, certificados, guias ou demais solicitações pertence exclusivamente à autoridade competente.",
          "Nosso trabalho é técnico e documental. A decisão é administrativa.",
          "Essa distinção é essencial para manter a relação com o cliente transparente, correta e segura.",
        ],
      },
      {
        title: "Nosso método de atuação",
        numberedItems: [
          {
            title: "Entendimento do caso",
            body: "O primeiro passo é compreender o perfil do cliente, o serviço desejado e a situação atual. Essa etapa evita escolhas equivocadas e ajuda a direcionar o atendimento para o caminho mais adequado.",
          },
          {
            title: "Organização dos dados",
            body: "O cliente informa seus dados, seleciona o serviço e envia os documentos necessários por meio do fluxo digital. Quando já existe cadastro anterior, a plataforma pode reaproveitar informações e documentos válidos, reduzindo retrabalho.",
          },
          {
            title: "Conferência documental",
            body: "As informações são analisadas para identificar inconsistências, ausências, divergências ou pontos que precisam de atenção antes do avanço do processo.",
          },
          {
            title: "Direcionamento técnico",
            body: "A equipe orienta o cliente sobre próximas etapas, documentos pendentes, exigências possíveis e limites do serviço contratado.",
          },
          {
            title: "Acompanhamento",
            body: "O cliente acompanha sua jornada pela área do cliente, com mais clareza sobre contratações, documentos, status e histórico.",
          },
          {
            title: "Comunicação responsável",
            body: "Toda comunicação é conduzida de forma objetiva, sem promessas indevidas e sem criar expectativa artificial sobre resultado.",
          },
        ],
      },
      {
        title: "Discrição e sigilo",
        paragraphs: [
          "A natureza dos serviços exige cuidado.",
          "Por isso, tratamos dados pessoais, documentos, histórico de contratação e informações do cliente com discrição e responsabilidade.",
          "O acesso às informações deve ocorrer apenas por pessoas autorizadas e para finalidades relacionadas ao atendimento, à execução do serviço contratado e ao cumprimento de obrigações legais ou administrativas.",
          "A confiança do cliente depende não apenas da qualidade técnica, mas também da forma como seus dados são tratados.",
          "Sigilo, sobriedade e controle fazem parte da nossa operação.",
        ],
      },
      {
        title: "Por que contratar uma assessoria especializada",
        paragraphs: [
          "Processos administrativos envolvendo documentação, cadastro, requisitos técnicos e análise por autoridade competente exigem atenção.",
          "Um erro simples pode gerar exigência, atraso, retrabalho ou até prejudicar a análise do pedido.",
          "A assessoria especializada não elimina a responsabilidade do cliente nem substitui a decisão da autoridade competente, mas ajuda a organizar o processo com mais clareza.",
          "Em um processo técnico, organização não é detalhe. É parte essencial da estratégia.",
        ],
        bullets: [
          "orientação inicial mais objetiva;",
          "redução de erros formais;",
          "melhor organização de documentos;",
          "clareza sobre etapas;",
          "acompanhamento mais próximo;",
          "histórico centralizado na área do cliente;",
          "comunicação mais profissional;",
          "suporte durante a jornada.",
        ],
      },
      {
        title: "Compromisso com conformidade",
        paragraphs: [
          "A Quero Armas atua com respeito à legislação, aos procedimentos administrativos e aos limites de cada serviço.",
          "Toda orientação prestada deve observar o enquadramento aplicável ao caso, a documentação apresentada pelo cliente e as exigências da autoridade competente.",
          "Não incentivamos condutas irregulares, não mascaramos informações e não orientamos o envio de documentos inconsistentes.",
          "A atuação correta protege o cliente, protege a empresa e fortalece a credibilidade do processo.",
        ],
      },
      {
        title: "Atendimento por critério",
        paragraphs: [
          "Nem todo serviço é adequado para todo perfil.",
          "Por isso, a Quero Armas trabalha com análise inicial, identificação do serviço pretendido e verificação das informações fornecidas pelo cliente.",
          "Quando o caso exige orientação específica, documentação complementar ou avaliação técnica adicional, o cliente é informado.",
          "A prioridade é conduzir cada atendimento com seriedade, e não simplesmente vender um serviço sem avaliar a coerência mínima do caso.",
        ],
      },
    ],
    finalCta: {
      title: "Regularidade exige método.",
      description:
        "Se você busca orientação técnica, organização documental e acompanhamento responsável, inicie sua análise pela plataforma da Quero Armas.",
      primary: { label: "Iniciar análise", to: "/cadastro" },
      secondary: { label: "Ver catálogo de serviços", to: "/servicos" },
    },
  },
  comoFunciona: {
    title: "Como Funciona | Quero Armas",
    description:
      "Entenda a jornada da Quero Armas, do cadastro ao acompanhamento, com etapas claras e responsabilidade em cada fase.",
    heroEyebrow: "Como Funciona",
    heroTitle: "Um processo claro, técnico e acompanhado do início ao fim.",
    heroParagraphs: [
      "A Quero Armas foi estruturada para reduzir dúvidas, organizar documentos e oferecer ao cliente uma jornada mais previsível.",
      "Você escolhe o serviço, informa seus dados, envia ou reaproveita documentos, recebe orientação sobre pendências, realiza o aceite e acompanha sua contratação pela área do cliente.",
      "A plataforma não substitui a análise da autoridade competente, mas torna a experiência do cliente mais organizada, documentada e transparente.",
    ],
    primaryCta: { label: "Começar minha análise", to: "/cadastro" },
    secondaryCta: { label: "Ver serviços", to: "/servicos" },
    sections: [
      {
        title: "Visão geral da jornada",
        paragraphs: [
          "A jornada da Quero Armas foi criada para que o cliente saiba exatamente em que etapa está e o que precisa fazer em seguida.",
          "Cada etapa tem uma função. O objetivo é evitar confusão, reduzir retrabalho e centralizar as informações em um ambiente organizado.",
        ],
        numberedItems: [
          { title: "Escolha ou identificação do serviço", body: "O cliente pode iniciar pelo catálogo ou pelo cadastro guiado, conforme a clareza que já tenha sobre sua necessidade." },
          { title: "Cadastro e confirmação de dados", body: "A identificação ajuda a localizar cadastro anterior, evitar duplicidade e vincular corretamente documentos e contratações." },
          { title: "Envio ou reaproveitamento de documentos", body: "A plataforma permite subir arquivos solicitados e, quando aplicável, reaproveitar documentos válidos já existentes." },
          { title: "Revisão técnica", body: "As informações são conferidas internamente para reduzir inconsistências e orientar eventuais pendências antes do avanço." },
          { title: "Pagamento e aceite", body: "A contratação é concluída com as condições apresentadas, o aceite eletrônico e o pagamento, quando aplicável." },
          { title: "Acompanhamento pela área do cliente", body: "O histórico, os documentos, as contratações e as comunicações ficam centralizados em um ambiente mais organizado." },
        ],
      },
      {
        title: "Etapa 1: escolha do serviço",
        paragraphs: [
          "O cliente pode iniciar sua jornada de duas formas:",
        ],
        bullets: [
          "acessando diretamente o catálogo de serviços;",
          "começando pelo cadastro guiado.",
        ],
      },
      {
        title: "Etapa 2: identificação do cliente",
        paragraphs: [
          "Antes de avançar, a plataforma solicita dados de identificação.",
          "Essa fase é importante para evitar duplicidade de cadastro, localizar cliente já existente, reaproveitar informações anteriores, vincular corretamente documentos e contratações e organizar o atendimento.",
          "Quando o cliente já possui cadastro, a plataforma pode identificar informações anteriores e facilitar a continuidade da jornada.",
          "A identificação não significa aprovação, deferimento ou validação final do serviço. Ela serve para organizar o atendimento e evitar retrabalho.",
        ],
      },
      {
        title: "Etapa 3: envio ou reaproveitamento de documentos",
        paragraphs: [
          "Após a identificação, o cliente poderá enviar documentos solicitados para análise e organização do atendimento.",
          "Quando houver documentos já enviados anteriormente e ainda aproveitáveis, o sistema poderá permitir o reaproveitamento, conforme disponibilidade, validade e compatibilidade com o serviço.",
          "Essa etapa ajuda a reduzir envio duplicado de arquivos, perda de documentos, mensagens soltas por WhatsApp, dificuldade de conferência e retrabalho em contratações futuras.",
          "Documentos ilegíveis, incompletos, vencidos ou inconsistentes podem gerar solicitação de correção.",
        ],
      },
      {
        title: "Etapa 4: revisão técnica",
        paragraphs: [
          "A revisão técnica tem como objetivo verificar se as informações e documentos apresentados estão minimamente organizados para continuidade do atendimento.",
          "Essa revisão não substitui a análise da autoridade competente. Ela é uma etapa interna de organização e controle.",
        ],
        bullets: [
          "preenchimento dos dados;",
          "legibilidade dos documentos;",
          "coerência entre informações;",
          "pendências aparentes;",
          "ausência de arquivos importantes;",
          "necessidade de complemento;",
          "compatibilidade básica com o serviço escolhido.",
        ],
      },
      {
        title: "Etapa 5: pagamento e aceite",
        paragraphs: [
          "Após a seleção do serviço e a organização inicial da contratação, o cliente realiza o pagamento e aceita as condições aplicáveis.",
          "O aceite eletrônico registra que o cliente compreendeu os termos do serviço, seus limites, suas responsabilidades e as condições apresentadas no momento da contratação.",
          "A contratação somente deve avançar quando o cliente estiver ciente de que:",
        ],
        bullets: [
          "a assessoria não garante deferimento;",
          "a análise final pertence à autoridade competente;",
          "o cliente é responsável pela veracidade dos dados;",
          "documentos incompletos ou incorretos podem gerar atrasos;",
          "cada serviço possui limites próprios.",
        ],
      },
      {
        title: "Etapa 6: acompanhamento pela área do cliente",
        paragraphs: [
          "Após a contratação, o cliente pode acompanhar informações pela área do cliente.",
          "A área do cliente foi criada para centralizar contratações, documentos enviados, histórico, dados cadastrais, andamento, comunicações e reaproveitamento de informações em novas solicitações.",
          "Essa estrutura reduz a dependência de mensagens perdidas e dá mais organização à relação entre cliente e equipe.",
        ],
      },
      {
        title: "O que depende do cliente",
        paragraphs: [
          "Algumas etapas dependem diretamente do cliente.",
          "A qualidade do processo depende da qualidade das informações fornecidas.",
        ],
        bullets: [
          "fornecer dados verdadeiros e atualizados;",
          "enviar documentos legíveis;",
          "acompanhar solicitações da equipe;",
          "cumprir prazos informados;",
          "realizar exames, laudos ou etapas presenciais quando exigidos;",
          "manter canais de contato atualizados;",
          "informar alterações relevantes;",
          "não omitir dados que possam impactar o atendimento.",
        ],
      },
      {
        title: "O que depende da autoridade competente",
        paragraphs: [
          "A análise final de requerimentos, autorizações, registros, renovações, certificados, guias ou demais solicitações é de competência da autoridade responsável pelo procedimento.",
          "Nosso papel é orientar, organizar e acompanhar. A decisão pertence à autoridade competente.",
        ],
        bullets: [
          "tempo de análise;",
          "decisão final;",
          "interpretação da autoridade;",
          "eventuais instabilidades de sistema público;",
          "mudanças normativas;",
          "necessidade de complementação documental.",
        ],
      },
      {
        title: "O que pode atrasar o atendimento",
        bullets: [
          "documentos ilegíveis;",
          "informações divergentes;",
          "dados incompletos;",
          "ausência de documento solicitado;",
          "documentação vencida;",
          "necessidade de correção;",
          "instabilidade em sistemas externos;",
          "alteração normativa;",
          "demora na resposta do cliente;",
          "exigências adicionais.",
        ],
        paragraphs: [
          "Quando isso acontecer, a equipe orientará o cliente sobre a melhor forma de regularizar a pendência.",
        ],
      },
      {
        id: "duvidas-frequentes",
        title: "Transparência em cada etapa",
        paragraphs: [
          "A proposta da Quero Armas é oferecer uma experiência mais clara.",
          "O cliente não deve contratar sem entender o que está fazendo. Também não deve ser conduzido por promessas irreais.",
          "A jornada é construída para que cada fase tenha função, limite e responsabilidade definidos.",
          "Isso gera uma relação mais segura para o cliente e mais profissional para a empresa.",
        ],
      },
    ],
    finalCta: {
      title: "Comece com orientação, não com improviso.",
      description:
        "Inicie sua análise, escolha o serviço adequado e acompanhe sua jornada pela área do cliente.",
      primary: { label: "Iniciar análise", to: "/cadastro" },
      secondary: { label: "Acessar área do cliente", to: "/area-do-cliente/login" },
    },
  },
  atendimentoNacional: {
    title: "Atendimento Nacional | Quero Armas",
    description:
      "Saiba como a Quero Armas atende clientes em todo o Brasil com estrutura digital, orientação responsável e etapas presenciais quando aplicável.",
    heroEyebrow: "Atendimento Nacional",
    heroTitle: "Atendimento em todo o Brasil, com método, discrição e orientação responsável.",
    heroParagraphs: [
      "A Quero Armas atende clientes de diferentes regiões do país por meio de uma estrutura digital de cadastro, análise documental, acompanhamento e suporte.",
      "Parte da jornada pode ser conduzida remotamente. Outras etapas podem depender de presença física, profissionais credenciados, exames, laudos, cursos ou comparecimentos conforme a natureza do serviço.",
      "Nosso compromisso é explicar o que pode ser feito online, o que depende do cliente e o que depende da autoridade competente.",
    ],
    primaryCta: { label: "Verificar atendimento no meu caso", to: "/cadastro" },
    secondaryCta: { label: "Conhecer serviços", to: "/servicos" },
    sections: [
      {
        title: "Como funciona o atendimento nacional",
        paragraphs: [
          "O atendimento nacional da Quero Armas combina tecnologia, organização documental e suporte humano.",
          "O cliente pode iniciar sua jornada pelo site, escolher o serviço, preencher o cadastro, enviar documentos e acompanhar sua contratação pela área do cliente.",
          "A equipe realiza a orientação e o acompanhamento dentro dos limites do serviço contratado, sempre observando a necessidade de etapas presenciais quando aplicável.",
          "Isso permite atender clientes de forma mais organizada, mesmo quando estão em cidades diferentes.",
        ],
      },
      {
        title: "O que pode ser feito remotamente",
        paragraphs: [
          "Diversas etapas podem ser conduzidas online, como:",
        ],
        bullets: [
          "cadastro inicial;",
          "identificação do cliente;",
          "seleção do serviço;",
          "envio de documentos;",
          "conferência de dados;",
          "revisão documental;",
          "comunicação com a equipe;",
          "pagamento e aceite;",
          "acompanhamento da contratação;",
          "reaproveitamento de documentos;",
          "suporte sobre pendências.",
        ],
      },
      {
        title: "O que pode exigir presença física",
        paragraphs: [
          "Algumas etapas não dependem exclusivamente da Quero Armas e podem exigir comparecimento presencial ou atendimento local.",
          "Isso pode ocorrer em situações envolvendo:",
          "Quando uma etapa presencial for necessária, o cliente será orientado conforme o serviço contratado e as informações disponíveis.",
        ],
        bullets: [
          "exames;",
          "laudos;",
          "cursos;",
          "avaliações;",
          "reconhecimento de documentos;",
          "comparecimento a unidade competente;",
          "retirada ou apresentação de documentos;",
          "exigências específicas de determinado procedimento.",
        ],
      },
      {
        title: "Exames, laudos e profissionais credenciados",
        paragraphs: [
          "Determinados serviços podem envolver profissionais habilitados ou credenciados, de acordo com as exigências aplicáveis.",
          "A Quero Armas pode orientar o cliente sobre a necessidade desses documentos e sobre a importância de observar profissionais compatíveis com o procedimento.",
          "A responsabilidade pela realização do exame, comparecimento, pagamento ao profissional e obtenção do documento correspondente é do cliente, salvo disposição específica em contrário.",
        ],
      },
      {
        title: "Cursos e treinamentos",
        paragraphs: [
          "Quando o serviço envolver curso, treinamento, avaliação ou etapa presencial relacionada, a realização dependerá de disponibilidade local, agenda, estrutura adequada e exigências aplicáveis.",
          "A Quero Armas pode auxiliar na orientação do cliente, mas a realização de atividades presenciais depende das condições concretas de cada localidade e dos profissionais ou instituições envolvidos.",
          "O cliente será informado quando determinada etapa exigir presença física.",
        ],
      },
      {
        title: "Atendimento por região",
        paragraphs: [
          "O atendimento nacional não significa que todas as etapas ocorrerão da mesma forma em todos os estados ou cidades.",
          "A jornada pode variar conforme:",
          "Por isso, cada caso deve ser analisado individualmente.",
        ],
        bullets: [
          "disponibilidade de profissionais;",
          "exigências locais;",
          "natureza do serviço;",
          "documentos apresentados;",
          "sistemas utilizados;",
          "necessidade de comparecimento;",
          "prazos externos;",
          "regras administrativas vigentes.",
        ],
      },
      {
        title: "O que depende da Quero Armas",
        paragraphs: [
          "A Quero Armas pode atuar na organização, orientação e acompanhamento do serviço contratado.",
          "Nossa responsabilidade está relacionada ao que foi contratado e aos limites informados ao cliente.",
        ],
        bullets: [
          "orientação de jornada;",
          "checklist documental;",
          "análise inicial;",
          "conferência de informações;",
          "suporte ao cadastro;",
          "comunicação sobre pendências;",
          "acompanhamento interno;",
          "organização da contratação;",
          "centralização de documentos na área do cliente.",
        ],
      },
      {
        title: "O que não depende da Quero Armas",
        bullets: [
          "decisão de autoridade competente;",
          "tempo de análise externa;",
          "exigências supervenientes;",
          "comparecimentos obrigatórios;",
          "disponibilidade de agenda de terceiros;",
          "instabilidade em sistemas públicos;",
          "emissão de laudos por profissionais externos;",
          "mudanças normativas;",
          "resposta do cliente;",
          "validade de documentos fornecidos pelo cliente.",
        ],
        paragraphs: [
          "Esses pontos são informados para manter a relação transparente e evitar expectativas indevidas.",
        ],
      },
      {
        title: "Atendimento com discrição",
        paragraphs: [
          "O atendimento nacional exige confiança.",
          "Por isso, a Quero Armas trata cada solicitação com discrição, organização e respeito à privacidade do cliente.",
          "A comunicação deve ser objetiva, documentada e voltada ao andamento do serviço contratado.",
          "O cliente não precisa expor seu caso repetidamente em vários canais. A proposta é centralizar a jornada e reduzir ruídos.",
        ],
      },
    ],
    finalCta: {
      title: "Quer saber se conseguimos atender seu caso?",
      description:
        "Inicie a análise e informe sua cidade, estado e serviço pretendido. Nossa equipe orientará os próximos passos dentro dos limites aplicáveis.",
      primary: { label: "Verificar atendimento", to: "/cadastro" },
      secondary: { label: "Falar com atendimento", to: "https://wa.me/5511978481919", external: true },
    },
  },
  limitesResponsabilidades: {
    title: "Limites e Responsabilidades | Quero Armas",
    description:
      "Entenda com clareza o que a Quero Armas faz, o que depende do cliente e o que depende da autoridade competente.",
    heroEyebrow: "Limites e Responsabilidades",
    heroTitle:
      "Transparência sobre o que fazemos, o que depende do cliente e o que depende da autoridade competente.",
    heroParagraphs: [
      "A Quero Armas atua com assessoria técnica, documental e administrativa. Nosso compromisso é organizar a jornada do cliente, orientar sobre documentos, acompanhar contratações e oferecer suporte dentro dos limites do serviço contratado.",
      "Não prometemos resultado. Não garantimos deferimento. Não substituímos autoridade pública. Não substituímos advogado quando a atuação jurídica for necessária.",
      "Esta página existe para deixar esses limites claros desde o início.",
    ],
    primaryCta: { label: "Entendi e quero iniciar análise", to: "/cadastro" },
    secondaryCta: { label: "Ver serviços", to: "/servicos" },
    sections: [
      {
        title: "O que a Quero Armas faz",
        paragraphs: [
          "A Quero Armas pode atuar em atividades como:",
          "Nossa atuação é voltada à organização e ao suporte do cliente dentro dos serviços contratados.",
        ],
        bullets: [
          "orientação inicial sobre serviços disponíveis;",
          "organização de cadastro;",
          "recebimento de documentos;",
          "conferência documental interna;",
          "identificação de pendências aparentes;",
          "direcionamento do cliente durante a jornada;",
          "acompanhamento de contratação;",
          "suporte pela área do cliente;",
          "comunicação sobre etapas e próximos passos;",
          "estruturação administrativa do atendimento.",
        ],
      },
      {
        title: "O que a Quero Armas não faz",
        bullets: [
          "garante deferimento;",
          "garante prazo de análise;",
          "decide processos;",
          "substitui autoridade competente;",
          "interfere em decisões administrativas;",
          "altera exigências legais;",
          "orienta envio de informação falsa;",
          "aceita documento adulterado;",
          "substitui advogado em atividade privativa de advocacia;",
          "promete resultado;",
          "conduz conduta irregular.",
        ],
        paragraphs: [
          "Esses limites protegem o cliente e preservam a seriedade da operação.",
        ],
      },
      {
        title: "O que depende do cliente",
        bullets: [
          "fornecer dados verdadeiros;",
          "enviar documentos legíveis;",
          "manter informações atualizadas;",
          "responder solicitações da equipe;",
          "cumprir prazos informados;",
          "realizar etapas presenciais quando necessárias;",
          "comunicar alterações relevantes;",
          "revisar dados antes do aceite;",
          "efetuar pagamentos conforme condições apresentadas;",
          "não omitir informações que possam impactar o atendimento.",
        ],
        paragraphs: [
          "A Quero Armas pode orientar e organizar, mas não pode substituir a responsabilidade do cliente sobre seus próprios dados e documentos.",
        ],
      },
      {
        title: "O que depende da autoridade competente",
        paragraphs: [
          "Quando houver análise administrativa, a decisão final pertence à autoridade competente.",
          "A Quero Armas não controla essas decisões.",
        ],
        bullets: [
          "deferimento;",
          "indeferimento;",
          "exigência;",
          "solicitação de complemento;",
          "tempo de análise;",
          "interpretação administrativa;",
          "aceitação ou rejeição de documentos;",
          "emissão de autorização, registro, certificado, guia ou documento correlato.",
        ],
      },
      {
        title: "Sobre promessas de resultado",
        paragraphs: [
          "Nenhum conteúdo do site, atendimento, mensagem, página de serviço ou comunicação deve ser interpretado como promessa de aprovação.",
          "Quando usamos expressões como “organizar”, “acompanhar”, “orientar”, “revisar” ou “conduzir”, estamos nos referindo à atuação da Quero Armas dentro do serviço contratado.",
          "Isso não significa que o pedido será aprovado, nem que a autoridade competente deixará de formular exigências.",
        ],
      },
      {
        title: "Sobre prazos",
        paragraphs: [
          "A Quero Armas pode informar estimativas internas de atendimento, organização ou análise documental.",
          "Entretanto, prazos de órgãos públicos, terceiros, profissionais externos, plataformas governamentais ou sistemas oficiais não dependem exclusivamente da empresa.",
          "O cliente deve estar ciente de que atrasos podem ocorrer por fatores externos.",
        ],
      },
      {
        title: "Sobre documentos",
        paragraphs: [
          "A documentação enviada pelo cliente deve ser verdadeira, legível, completa e compatível com o serviço contratado.",
          "Documentos inconsistentes, vencidos, rasurados, adulterados, incompletos ou ilegíveis podem impedir a continuidade do atendimento ou prejudicar a análise.",
          "A responsabilidade pela autenticidade e veracidade das informações é do cliente.",
        ],
      },
      {
        title: "Sobre atuação jurídica",
        paragraphs: [
          "A Quero Armas pode atuar na organização administrativa e documental dos serviços contratados.",
          "Quando o caso exigir atividade privativa de advocacia, como elaboração de tese jurídica, recurso com fundamentação jurídica específica, defesa técnica ou ação judicial, o cliente deverá contratar advogado habilitado.",
          "Quando houver parceria, indicação ou encaminhamento, isso deverá ser informado de forma clara ao cliente.",
        ],
      },
      {
        title: "Sobre serviços de terceiros",
        paragraphs: [
          "Algumas etapas podem depender de terceiros, como profissionais, instituições, clínicas, clubes, instrutores, lojas, sistemas ou órgãos externos.",
          "A Quero Armas não se responsabiliza por condutas, prazos, valores, agendas ou decisões de terceiros que não estejam sob sua gestão direta.",
          "Quando houver orientação sobre etapa externa, o cliente será informado dentro dos limites do atendimento.",
        ],
      },
      {
        title: "Por que esses limites existem",
        paragraphs: [
          "Esses limites não reduzem o valor da assessoria. Pelo contrário.",
          "Eles demonstram que a Quero Armas atua com seriedade, sem promessa indevida e sem criar falsa expectativa.",
          "A melhor assessoria não é a que promete tudo. É a que explica o caminho, organiza o processo e informa os riscos com clareza.",
        ],
      },
    ],
    finalCta: {
      title: "Regularidade começa com clareza.",
      description:
        "Antes de contratar, entenda o papel da Quero Armas, o seu papel como cliente e os limites da decisão administrativa.",
      primary: { label: "Iniciar análise com responsabilidade", to: "/cadastro" },
      secondary: { label: "Ver dúvidas frequentes", to: "/como-funciona#duvidas-frequentes" },
    },
  },
  termos: {
    title: "Termos de Uso | Quero Armas",
    description:
      "Leia os Termos de Uso da Quero Armas para entender as condições de acesso, cadastro, contratação e uso da plataforma.",
    heroEyebrow: "Termos de Uso",
    heroTitle: "Termos de Uso da Quero Armas",
    heroParagraphs: [
      "Estes Termos de Uso regulam o acesso e a utilização do site, da área do cliente, do cadastro, do catálogo de serviços, do carrinho, do checkout e dos demais recursos digitais disponibilizados pela Quero Armas.",
      "Ao acessar o site, realizar cadastro, enviar documentos, contratar serviços ou utilizar a área do cliente, o usuário declara que leu, compreendeu e concorda com estes Termos.",
      "Caso não concorde com as condições abaixo, o usuário não deve prosseguir com a utilização da plataforma.",
    ],
    primaryCta: { label: "Falar com atendimento", to: "https://wa.me/5511978481919", external: true },
    secondaryCta: { label: "Voltar aos serviços", to: "/servicos" },
    sections: [
      {
        title: "1. Definições",
        paragraphs: [
          "Para fins destes Termos:",
        ],
        bullets: [
          "Quero Armas: empresa ou marca responsável pela disponibilização da plataforma, atendimento, serviços de assessoria técnica, documental e administrativa.",
          "Usuário: qualquer pessoa que acesse o site, navegue pelas páginas, utilize formulários ou consulte informações.",
          "Cliente: usuário que realiza cadastro, envia documentos, contrata serviços ou acessa a área do cliente.",
          "Plataforma: conjunto de páginas, formulários, fluxos, área do cliente, carrinho, checkout, meios de comunicação e recursos digitais da Quero Armas.",
          "Serviços: atividades disponibilizadas no catálogo, incluindo assessoria, orientação, organização documental, acompanhamento e demais serviços contratáveis.",
        ],
      },
      {
        title: "2. Aceitação dos Termos",
        paragraphs: [
          "O uso da plataforma implica aceitação destes Termos de Uso.",
          "O usuário declara estar ciente de que a utilização do site, o envio de dados, a criação de cadastro, o aceite eletrônico e a contratação de serviços produzem efeitos dentro da relação com a Quero Armas.",
          "A aceitação poderá ocorrer por navegação, cadastro, envio de documentos, contratação, pagamento, aceite eletrônico ou uso da área do cliente.",
        ],
      },
      {
        title: "3. Uso da plataforma",
        paragraphs: [
          "A plataforma deve ser utilizada de forma lícita, responsável e compatível com sua finalidade.",
          "É vedado ao usuário:",
          "A Quero Armas poderá restringir, suspender ou cancelar acesso quando identificar uso incompatível, irregular ou potencialmente lesivo.",
        ],
        bullets: [
          "inserir dados falsos;",
          "enviar documentos adulterados;",
          "utilizar dados de terceiros sem autorização;",
          "tentar acessar conta de outro usuário;",
          "interferir no funcionamento do site;",
          "praticar fraude;",
          "utilizar a plataforma para finalidade irregular;",
          "omitir informações relevantes;",
          "desrespeitar orientações legais ou administrativas.",
        ],
      },
      {
        title: "4. Cadastro do cliente",
        paragraphs: [
          "Para contratar determinados serviços, o cliente deverá fornecer dados pessoais, informações de contato e documentos necessários à análise inicial e à execução do serviço.",
          "O cliente é responsável pela veracidade, atualidade e integridade das informações fornecidas.",
          "A Quero Armas poderá utilizar mecanismos de identificação para evitar duplicidade, localizar cadastro existente e permitir reaproveitamento de dados ou documentos, quando aplicável.",
        ],
      },
      {
        title: "5. Área do cliente",
        paragraphs: [
          "A área do cliente é um ambiente destinado ao acompanhamento de informações relacionadas a cadastro, documentos, contratações, histórico e serviços.",
          "O cliente é responsável por manter a confidencialidade de seus dados de acesso.",
          "A Quero Armas não se responsabiliza por acesso indevido decorrente de compartilhamento de senha, uso de dispositivo de terceiros, descuido do cliente ou falha de segurança fora do ambiente controlado pela empresa.",
        ],
      },
      {
        title: "6. Catálogo de serviços",
        paragraphs: [
          "O catálogo apresenta serviços disponíveis para contratação, com descrição, valor quando aplicável e condições gerais.",
          "A disponibilidade dos serviços pode ser alterada a qualquer momento, conforme critérios internos, alterações normativas, mudanças operacionais ou atualização da plataforma.",
          "A inclusão de um serviço no catálogo não significa garantia de elegibilidade do cliente, deferimento ou resultado.",
        ],
      },
      {
        title: "7. Contratação e pagamento",
        paragraphs: [
          "A contratação ocorre mediante seleção do serviço, preenchimento das informações solicitadas, aceite das condições apresentadas e pagamento, quando aplicável.",
          "O valor, a forma de pagamento e as condições específicas serão informados no momento da contratação.",
          "A confirmação do pagamento não garante decisão favorável de autoridade competente, quando o serviço envolver análise administrativa externa.",
        ],
      },
      {
        title: "8. Aceite eletrônico",
        paragraphs: [
          "O aceite eletrônico indica que o cliente concorda com as condições apresentadas no fluxo de contratação.",
          "Esse aceite poderá abranger Termos de Uso, condições comerciais, informações do serviço, política de privacidade, limites da assessoria e demais documentos aplicáveis.",
          "O cliente deve revisar as informações antes de confirmar.",
        ],
      },
      {
        title: "9. Envio de documentos",
        paragraphs: [
          "O cliente poderá ser solicitado a enviar documentos para análise, organização e execução do serviço contratado.",
          "Os documentos devem ser legíveis, completos, verdadeiros e compatíveis com o serviço.",
          "A Quero Armas poderá solicitar complementação, substituição ou atualização de documentos quando necessário.",
          "Documentos falsos, adulterados, incompletos ou ilegíveis são de responsabilidade do cliente e podem impedir a continuidade do atendimento.",
        ],
      },
      {
        title: "10. Limites da assessoria",
        paragraphs: [
          "A Quero Armas presta assessoria técnica, documental e administrativa, dentro dos limites do serviço contratado.",
          "A empresa não garante deferimento, prazo de análise, aprovação, emissão de documento, autorização, registro, certificado, guia ou qualquer decisão de autoridade competente.",
          "A decisão final, quando houver, pertence exclusivamente ao órgão ou autoridade responsável pelo procedimento.",
        ],
      },
      {
        title: "11. Responsabilidades do cliente",
        bullets: [
          "fornecer informações verdadeiras;",
          "manter dados atualizados;",
          "enviar documentos corretos e legíveis;",
          "cumprir prazos;",
          "acompanhar comunicações;",
          "realizar etapas presenciais quando exigidas;",
          "efetuar pagamentos;",
          "revisar as informações antes do aceite;",
          "comunicar alterações relevantes;",
          "respeitar a legislação aplicável.",
        ],
        paragraphs: [
          "O descumprimento dessas obrigações pode atrasar, suspender ou impedir a continuidade do serviço.",
        ],
      },
      {
        title: "12. Serviços de terceiros",
        paragraphs: [
          "Alguns serviços podem envolver terceiros, como profissionais, instituições, sistemas, plataformas, clínicas, clubes, instrutores, lojas, órgãos públicos ou parceiros.",
          "A Quero Armas não se responsabiliza por prazos, condutas, valores, disponibilidade, agenda ou decisões de terceiros que não estejam sob sua gestão direta.",
        ],
      },
      {
        title: "13. Atuação jurídica",
        paragraphs: [
          "A Quero Armas não substitui advogado em atividades privativas de advocacia.",
          "Quando o caso exigir atuação jurídica específica, o cliente deverá contratar advogado habilitado, por instrumento próprio.",
          "A eventual indicação de profissional não implica garantia de resultado.",
        ],
      },
      {
        title: "14. Cancelamento e reembolso",
        paragraphs: [
          "As condições de cancelamento e reembolso dependerão do serviço contratado, da fase em que se encontra o atendimento, dos custos já incorridos e das regras apresentadas no momento da contratação.",
          "Serviços já iniciados, análises realizadas, documentos organizados, atendimentos prestados ou etapas executadas poderão limitar o reembolso.",
          "Cada solicitação será analisada individualmente.",
        ],
      },
      {
        title: "15. Propriedade intelectual",
        paragraphs: [
          "Textos, layouts, fluxos, marcas, imagens, materiais, documentos, modelos, páginas e demais conteúdos da plataforma pertencem à Quero Armas ou a seus licenciantes.",
          "É proibida a reprodução, cópia, distribuição ou uso não autorizado desses materiais.",
        ],
      },
      {
        title: "16. Comunicações",
        paragraphs: [
          "A Quero Armas poderá se comunicar com o cliente por e-mail, telefone, WhatsApp, área do cliente ou outros canais informados.",
          "O cliente é responsável por manter seus canais atualizados e acompanhar as mensagens enviadas.",
        ],
      },
      {
        title: "17. Alterações dos Termos",
        paragraphs: [
          "A Quero Armas poderá alterar estes Termos de Uso a qualquer momento.",
          "A versão atualizada será disponibilizada no site e passará a valer a partir de sua publicação, salvo disposição em contrário.",
        ],
      },
      {
        title: "18. Legislação aplicável e foro",
        paragraphs: [
          "Estes Termos serão interpretados conforme a legislação brasileira.",
          "Eventuais controvérsias serão resolvidas no foro definido nas condições contratuais aplicáveis ou, na ausência de previsão específica, conforme as regras legais pertinentes.",
        ],
      },
    ],
    finalCta: {
      title: "Dúvidas sobre os Termos?",
      description:
        "Antes de contratar, leia com atenção. Em caso de dúvida, fale com a equipe de atendimento.",
      primary: { label: "Falar com atendimento", to: "https://wa.me/5511978481919", external: true },
      secondary: { label: "Voltar aos serviços", to: "/servicos" },
    },
  },
  privacidade: {
    title: "Política de Privacidade | Quero Armas",
    description:
      "Entenda como a Quero Armas coleta, utiliza, armazena e protege dados pessoais no site e na área do cliente.",
    heroEyebrow: "Política de Privacidade",
    heroTitle: "Política de Privacidade da Quero Armas",
    heroParagraphs: [
      "A Quero Armas respeita a privacidade dos usuários e clientes.",
      "Esta Política de Privacidade explica como coletamos, utilizamos, armazenamos, compartilhamos e protegemos dados pessoais no site, no cadastro, na área do cliente, no catálogo, no checkout e nos demais canais relacionados aos serviços.",
      "Ao utilizar a plataforma, o usuário declara estar ciente das práticas descritas nesta Política.",
    ],
    primaryCta: { label: "Falar com atendimento", to: "https://wa.me/5511978481919", external: true },
    secondaryCta: { label: "Voltar ao início", to: "/" },
    sections: [
      {
        title: "1. Dados que podemos coletar",
        paragraphs: [
          "Podemos coletar dados fornecidos diretamente pelo usuário ou gerados durante a utilização da plataforma.",
          "A coleta varia conforme o serviço, o formulário utilizado e a etapa da jornada.",
        ],
        bullets: [
          "nome completo;",
          "CPF;",
          "data de nascimento;",
          "e-mail;",
          "telefone;",
          "endereço;",
          "cidade e estado;",
          "dados de cadastro;",
          "documentos enviados;",
          "informações sobre serviços contratados;",
          "histórico de atendimento;",
          "dados de pagamento necessários à contratação;",
          "registros de aceite;",
          "informações de acesso à área do cliente;",
          "comunicações realizadas com a equipe.",
        ],
      },
      {
        title: "2. Documentos e informações sensíveis",
        paragraphs: [
          "Alguns serviços podem exigir documentos pessoais ou informações relevantes para análise e organização do atendimento.",
          "Esses documentos são tratados com cuidado especial, acesso restrito e finalidade vinculada ao serviço contratado.",
          "A Quero Armas não solicita documentos sem finalidade relacionada à contratação, à análise inicial, ao atendimento ou à execução do serviço.",
        ],
      },
      {
        title: "3. Finalidade do uso dos dados",
        paragraphs: [
          "Os dados podem ser utilizados para:",
          "Os dados não devem ser utilizados para finalidade incompatível com o relacionamento entre cliente e Quero Armas.",
        ],
        bullets: [
          "identificar o usuário;",
          "criar ou localizar cadastro;",
          "permitir acesso à área do cliente;",
          "processar contratações;",
          "organizar documentos;",
          "prestar atendimento;",
          "acompanhar serviços;",
          "emitir comunicações;",
          "registrar aceite eletrônico;",
          "cumprir obrigações legais;",
          "melhorar a experiência da plataforma;",
          "evitar fraude;",
          "manter histórico de relacionamento.",
        ],
      },
      {
        title: "4. Reaproveitamento de dados e documentos",
        paragraphs: [
          "Quando o cliente já possui cadastro ou documentos enviados anteriormente, a plataforma poderá permitir o reaproveitamento dessas informações em novas contratações.",
          "Esse reaproveitamento tem como objetivo reduzir retrabalho, facilitar o atendimento e manter histórico organizado.",
          "O reaproveitamento dependerá de disponibilidade, validade, compatibilidade e adequação dos dados ou documentos ao serviço pretendido.",
        ],
      },
      {
        title: "5. Compartilhamento de dados",
        paragraphs: [
          "A Quero Armas poderá compartilhar dados apenas quando necessário para:",
          "Não vendemos dados pessoais.",
          "O compartilhamento, quando ocorrer, deve observar a finalidade do serviço e a necessidade do tratamento.",
        ],
        bullets: [
          "execução do serviço contratado;",
          "cumprimento de obrigação legal;",
          "atendimento de solicitação do cliente;",
          "operação da plataforma;",
          "processamento de pagamento;",
          "suporte técnico;",
          "comunicação com profissionais ou parceiros necessários;",
          "atendimento de requisição de autoridade competente.",
        ],
      },
      {
        title: "6. Segurança das informações",
        paragraphs: [
          "A Quero Armas adota medidas técnicas e administrativas para proteger dados pessoais contra acesso não autorizado, perda, alteração, divulgação indevida ou uso incompatível.",
          "Entre as medidas possíveis estão:",
          "Nenhum sistema é absolutamente imune a riscos, mas adotamos cuidados proporcionais à natureza dos dados tratados.",
        ],
        bullets: [
          "controle de acesso;",
          "restrição de usuários autorizados;",
          "organização de permissões;",
          "uso de ambiente digital protegido;",
          "registro de informações relevantes;",
          "orientação interna sobre sigilo;",
          "limitação de finalidade.",
        ],
      },
      {
        title: "7. Retenção de dados",
        paragraphs: [
          "Os dados poderão ser mantidos pelo tempo necessário para:",
          "Quando os dados não forem mais necessários, poderão ser eliminados ou anonimizados, observadas as hipóteses legais de retenção.",
        ],
        bullets: [
          "prestação dos serviços;",
          "cumprimento de obrigações legais;",
          "histórico contratual;",
          "defesa de direitos;",
          "atendimento ao cliente;",
          "reaproveitamento documental;",
          "auditoria interna;",
          "prevenção de fraude.",
        ],
      },
      {
        title: "8. Direitos do titular",
        paragraphs: [
          "O titular dos dados pode solicitar, conforme a legislação aplicável:",
          "Algumas solicitações poderão ser limitadas quando houver obrigação legal, necessidade de retenção contratual ou defesa de direitos.",
        ],
        bullets: [
          "confirmação de tratamento;",
          "acesso aos dados;",
          "correção de dados incompletos ou desatualizados;",
          "informações sobre compartilhamento;",
          "revogação de consentimento, quando aplicável;",
          "exclusão de dados, quando cabível;",
          "esclarecimentos sobre o tratamento.",
        ],
      },
      {
        title: "9. Cookies e dados de navegação",
        paragraphs: [
          "A plataforma poderá utilizar cookies e tecnologias semelhantes para melhorar a navegação, manter sessões, lembrar preferências, medir uso e garantir funcionamento de recursos.",
          "O usuário pode ajustar configurações do navegador, ciente de que determinados recursos podem não funcionar corretamente sem cookies essenciais.",
        ],
      },
      {
        title: "10. Dados de pagamento",
        paragraphs: [
          "Pagamentos podem ser processados por empresas ou plataformas especializadas.",
          "A Quero Armas poderá receber informações necessárias para confirmação da transação, status de pagamento e vinculação da contratação.",
          "Dados financeiros sensíveis podem ser tratados diretamente pelo provedor de pagamento, conforme suas próprias políticas de privacidade e segurança.",
        ],
      },
      {
        title: "11. Menores de idade",
        paragraphs: [
          "Os serviços da Quero Armas são voltados a pessoas juridicamente aptas à contratação e ao uso dos serviços conforme a legislação aplicável.",
          "Não é permitido o envio de dados ou contratação por pessoa sem capacidade legal, salvo quando representada na forma da lei e quando o serviço permitir.",
        ],
      },
      {
        title: "12. Atualizações da Política",
        paragraphs: [
          "Esta Política de Privacidade poderá ser atualizada para refletir alterações legais, técnicas, operacionais ou comerciais.",
          "A versão atualizada será publicada no site.",
          "Recomendamos que o usuário consulte esta página periodicamente.",
        ],
      },
      {
        title: "13. Canal de contato",
        paragraphs: [
          "Em caso de dúvidas, solicitações ou pedidos relacionados à privacidade e proteção de dados, o usuário poderá entrar em contato pelos canais oficiais da Quero Armas.",
          "E-mail sugerido: privacidade@euqueroarmas.com.br",
          "Canal alternativo: atendimento oficial da plataforma.",
        ],
      },
    ],
    finalCta: {
      title: "Sua privacidade é parte da nossa responsabilidade.",
      description:
        "Tratamos dados e documentos com seriedade, finalidade e sigilo.",
      primary: { label: "Falar com atendimento", to: "https://wa.me/5511978481919", external: true },
      secondary: { label: "Voltar ao início", to: "/" },
    },
  },
};
