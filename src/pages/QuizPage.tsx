import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '@/shared/components/SEO';
import { ChevronRight, Shield, Target, Crosshair, Home, Trophy, Briefcase, CheckCircle2 } from 'lucide-react';
import QACadastroRefinadoHeader from './quero-armas/cadastro-refinado/components/QACadastroRefinadoHeader';
import QACadastroRefinadoFooter from './quero-armas/cadastro-refinado/components/QACadastroRefinadoFooter';
import './quero-armas/cadastro-refinado/styles/cadastroRefinado.css';

type Profile = 'defesa-pessoal-posse' | 'cac-cr' | 'atividades-avulsas';
type AnswerId =
  | 'defesa_casa'
  | 'cac_objetivo'
  | 'atirar_eventual'
  | 'profissao'
  | 'zero'
  | 'posse_pf'
  | 'cr_ativo'
  | 'experimentar'
  | 'semanal_operador'
  | 'mensal'
  | 'esporadico';

interface Question {
  id: 'objetivo' | 'documentacao' | 'frequencia';
  title: string;
  subtitle?: string;
  options: { id: AnswerId; label: string; desc: string; icon: typeof Shield; weight: Record<Profile, number> }[];
}

interface RecommendedService {
  name: string;
  desc: string;
  price?: string;
}

const questions: Question[] = [
  {
    id: 'objetivo',
    title: 'Qual e a sua motivacao real?',
    subtitle: 'Sem rodeio. Por que voce esta aqui?',
    options: [
      { id: 'defesa_casa', label: 'Defesa pessoal: defender minha família em casa', desc: 'Quero arma legalizada em casa. Dormir tranquilo. Proteger quem amo.', icon: Home, weight: { 'defesa-pessoal-posse': 3, 'cac-cr': 0, 'atividades-avulsas': 0 } },
      { id: 'cac_objetivo', label: 'CAC: colecionar, atirar e caçar', desc: 'Quero CR no Exército. Construir acervo. Treinar habitualidade.', icon: Trophy, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 3, 'atividades-avulsas': 1 } },
      { id: 'atirar_eventual', label: 'So quero atirar de vez em quando', desc: 'Curiosidade, lazer, experiencia no estande. Sem compromisso.', icon: Target, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
      { id: 'profissao', label: 'Profissao exige (seguranca, escolta, VIP)', desc: 'Trabalho na area. Preciso de capacitacao tecnica.', icon: Briefcase, weight: { 'defesa-pessoal-posse': 1, 'cac-cr': 1, 'atividades-avulsas': 2 } },
    ],
  },
  {
    id: 'documentacao',
    title: 'Onde voce esta hoje na documentacao?',
    options: [
      { id: 'zero', label: 'Começando do zero (não tenho nada)', desc: 'Nunca dei entrada em nada.', icon: Shield, weight: { 'defesa-pessoal-posse': 2, 'cac-cr': 2, 'atividades-avulsas': 1 } },
      { id: 'posse_pf', label: 'Já tenho posse na PF', desc: 'Arma registrada em casa. Quero treinar mais ou expandir acervo.', icon: CheckCircle2, weight: { 'defesa-pessoal-posse': 2, 'cac-cr': 1, 'atividades-avulsas': 0 } },
      { id: 'cr_ativo', label: 'Ja sou CAC com CR ativo', desc: 'Tenho CR no Exercito. Preciso de habitualidade e suporte.', icon: Trophy, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 3, 'atividades-avulsas': 0 } },
      { id: 'experimentar', label: 'So quero experimentar antes de decidir', desc: 'Quero atirar primeiro, depois decido.', icon: Target, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
    ],
  },
  {
    id: 'frequencia',
    title: 'Com que frequencia voce pretende atirar?',
    options: [
      { id: 'semanal_operador', label: 'Toda semana. Quero virar operador.', desc: 'Treino serio, evolucao tecnica.', icon: Crosshair, weight: { 'defesa-pessoal-posse': 1, 'cac-cr': 3, 'atividades-avulsas': 1 } },
      { id: 'mensal', label: 'Mensal — continuar mantendo a técnica', desc: 'Manutenção da técnica.', icon: Target, weight: { 'defesa-pessoal-posse': 3, 'cac-cr': 1, 'atividades-avulsas': 1 } },
      { id: 'esporadico', label: 'Esporadico. Quando der vontade.', desc: 'Hobby leve.', icon: Shield, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
    ],
  },
];

const TOTAL_STEPS = questions.length + 1;

const answerLabels: Record<AnswerId, string> = {
  defesa_casa: 'Defesa residencial',
  cac_objetivo: 'CAC: colecionar, atirar e cacar',
  atirar_eventual: 'Tiro eventual',
  profissao: 'Atividade profissional',
  zero: 'Comecando do zero',
  posse_pf: 'Ja tem posse na PF',
  cr_ativo: 'CR ativo',
  experimentar: 'Quer experimentar primeiro',
  semanal_operador: 'Treino semanal / operador',
  mensal: 'Treino mensal',
  esporadico: 'Uso esporadico',
};

const questionLabels: Record<Question['id'], string> = {
  objetivo: 'Motivacao',
  documentacao: 'Ponto de partida',
  frequencia: 'Ritmo de treino',
};

function buildScores(answers: Partial<Record<Question['id'], AnswerId>>) {
  return questions.reduce<Record<Profile, number>>(
    (acc, question) => {
      const answerId = answers[question.id];
      const option = question.options.find((item) => item.id === answerId);
      if (!option) return acc;
      return {
        'defesa-pessoal-posse': acc['defesa-pessoal-posse'] + option.weight['defesa-pessoal-posse'],
        'cac-cr': acc['cac-cr'] + option.weight['cac-cr'],
        'atividades-avulsas': acc['atividades-avulsas'] + option.weight['atividades-avulsas'],
      };
    },
    { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 0 },
  );
}

function explainPath(answers: Partial<Record<Question['id'], AnswerId>>) {
  const objetivo = answers.objetivo;
  const documentacao = answers.documentacao;
  const frequencia = answers.frequencia;

  if (!objetivo) {
    return {
      title: 'Seu caminho aparece aqui',
      description: 'A cada resposta, mostramos a rota juridica e comercial que voce esta formando.',
      steps: ['Escolha sua motivacao real para iniciar o diagnostico.'],
      service: 'Aguardando primeira resposta',
    };
  }

  if (objetivo === 'cac_objetivo') {
    if (!documentacao) {
      return {
        title: 'Caminho CAC em definicao',
        description: 'Agora precisamos saber se voce esta comecando do zero ou se ja tem CR ativo.',
        steps: ['Confirmar seu ponto de partida', 'Se nao tiver CR: concessao de CR', 'Se ja tiver CR: compra, registro/apostilamento e GTE'],
        service: 'Aguardando ponto de partida',
      };
    }

    if (documentacao === 'cr_ativo') {
      return {
        title: 'Caminho CAC com CR ativo',
        description: 'Como voce ja tem CR, o proximo caminho nao e tirar outro CR.',
        steps: ['Autorizacao para compra', 'Registro e apostilamento da arma no acervo', 'GTE para trafego do CAC'],
        service: 'Compra + registro/apostilamento + GTE',
      };
    }

    return {
      title: frequencia === 'semanal_operador' ? 'Caminho CAC do zero para operador' : 'Caminho CAC do zero',
      description: 'Primeiro vem o CR ativo no Exercito. Depois entram compra, registro/apostilamento e GTE.',
      steps: ['Concessao de CR', 'Depois: autorizacao de compra', 'Depois: registro/apostilamento', 'Depois: GTE'],
      service: 'Concessao de CR',
    };
  }

  if (objetivo === 'defesa_casa') {
    if (documentacao === 'posse_pf') {
      return {
        title: 'Caminho de defesa com posse existente',
        description: 'Como voce ja possui registro na PF, o caminho indicado e manter ou regularizar a posse.',
        steps: ['Revisao da posse atual', 'Renovacao/regularizacao na PF', 'Orientacao de treino sem misturar com CAC'],
        service: 'Renovacao de posse',
      };
    }

    return {
      title: 'Caminho de defesa pessoal residencial',
      description: 'Para ter arma em casa pela PF, o fluxo e aquisicao, registro e posse, nao CR de CAC.',
      steps: ['Aquisicao autorizada pela PF', 'Registro da arma', 'Posse no endereco declarado'],
      service: 'Aquisicao, registro e posse',
    };
  }

  if (objetivo === 'profissao') {
    return {
      title: 'Caminho profissional',
      description: 'Quando a atividade profissional justifica o pedido, o enquadramento muda e precisa seguir a regra aplicavel a funcao.',
      steps: ['Comprovar atividade/risco', 'Capacidade tecnica e documentos', 'Pedido de porte conforme enquadramento'],
      service: 'Porte de arma de fogo',
    };
  }

  return {
    title: 'Caminho de orientacao e treino',
    description: 'Se a motivacao ainda e experimentar ou treinar sem montar acervo, o caminho correto e curso/orientacao.',
    steps: ['Aula ou curso inicial', 'Avaliacao tecnica', 'Decisao posterior sobre PF ou CAC'],
    service: 'Operador de pistola nivel I',
  };
}

function checkoutUrl(servico: string, perfil: string, subperfil: string) {
  const params = new URLSearchParams({
    servico,
    origem: 'como_escolher',
    perfil_v2: perfil,
    subperfil_v2: subperfil,
    servico_confirmado: '1',
  });
  return `/cadastro?${params.toString()}`;
}

function resolveCheckout(answers: Partial<Record<Question['id'], AnswerId>>, scores: Record<Profile, number>) {
  const objetivo = answers.objetivo;
  const documentacao = answers.documentacao;
  const frequencia = answers.frequencia;

  if (objetivo === 'cac_objetivo') {
    if (documentacao === 'cr_ativo') {
      return checkoutUrl(
        [
          'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac',
          'registro-e-apostilamento-de-arma-de-fogo-cac',
          'guia-de-trafego-especial-cac',
        ].join(','),
        'cac',
        'cr_ativo_compra_registro_gte',
      );
    }
    return checkoutUrl('concessao-cr', 'cac', frequencia === 'semanal_operador' ? 'concessao_cr_operador' : 'concessao_cr');
  }

  if (objetivo === 'defesa_casa') {
    if (documentacao === 'posse_pf') {
      return checkoutUrl('renovacao-posse-de-arma-de-fogo', 'defesa_pessoal', 'renovacao_posse');
    }
    return checkoutUrl('aquisicao-registro-posse-de-arma-de-fogo', 'defesa_pessoal', 'primeira_aquisicao');
  }

  if (objetivo === 'profissao') {
    return checkoutUrl('porte-arma-fogo', 'profissional_ativo', 'porte_funcional_atividade_risco');
  }

  if (objetivo === 'atirar_eventual' || documentacao === 'experimentar' || frequencia === 'esporadico') {
    return checkoutUrl('operador-de-pistola-nivel-i', 'orientacao_necessaria', 'curso_operador');
  }

  const winner = (Object.entries(scores) as [Profile, number][]).sort((a, b) => b[1] - a[1])[0][0];
  if (winner === 'cac-cr') return checkoutUrl('concessao-cr', 'cac', 'concessao_cr');
  if (winner === 'defesa-pessoal-posse') return checkoutUrl('aquisicao-registro-posse-de-arma-de-fogo', 'defesa_pessoal', 'primeira_aquisicao');
  return checkoutUrl('operador-de-pistola-nivel-i', 'orientacao_necessaria', 'curso_operador');
}

function resolveRecommendation(answers: Partial<Record<Question['id'], AnswerId>>) {
  const scores = buildScores(answers);
  const url = resolveCheckout(answers, scores);
  const objetivo = answers.objetivo;
  const documentacao = answers.documentacao;

  if (objetivo === 'cac_objetivo' && documentacao === 'cr_ativo') {
    return {
      url,
      title: 'Comprar arma como CAC',
      desc: 'Como voce ja tem CR ativo, o caminho indicado e contratar a sequencia de compra, registro/apostilamento e GTE.',
      services: [
        { name: 'Autorizacao de compra de arma de fogo atirador esportivo (CAC)', desc: 'Pedido de autorizacao para aquisicao como CAC.', price: 'R$ 497' },
        { name: 'Registro e apostilamento de arma de fogo (CAC)', desc: 'Registro da arma e vinculacao ao acervo.', price: 'R$ 247' },
        { name: 'Guia de Trafego Especial (CAC)', desc: 'Guia para deslocamento conforme a finalidade autorizada.', price: 'R$ 147' },
      ],
      total: 'R$ 891',
    };
  }

  if (objetivo === 'cac_objetivo') {
    return {
      url,
      title: 'Comecar como CAC',
      desc: 'Como voce esta partindo para o CAC sem CR ativo, o primeiro servico indicado e a concessao de CR.',
      services: [
        { name: 'Concessao de CR', desc: 'Concessao de Certificado de Registro junto ao Exercito Brasileiro.', price: 'R$ 1.239' },
      ],
      total: 'R$ 1.239',
    };
  }

  if (objetivo === 'defesa_casa' && documentacao === 'posse_pf') {
    return {
      url,
      title: 'Manter sua posse regular',
      desc: 'Como voce ja informou posse na PF, o caminho indicado e revisar e renovar a regularidade.',
      services: [
        { name: 'Renovacao de posse de arma de fogo', desc: 'Renovacao ou regularizacao da posse no fluxo da PF.' },
      ],
    };
  }

  if (objetivo === 'defesa_casa') {
    return {
      url,
      title: 'Arma legalizada em casa',
      desc: 'Para defesa residencial, o caminho indicado e aquisicao, registro e posse pela PF.',
      services: [
        { name: 'Aquisicao, registro e posse de arma de fogo', desc: 'Fluxo para comprar, registrar e manter a arma no endereco declarado.' },
      ],
    };
  }

  if (objetivo === 'profissao') {
    return {
      url,
      title: 'Enquadramento profissional',
      desc: 'Quando a motivacao vem da atividade profissional, o caminho indicado e porte conforme a regra aplicavel.',
      services: [
        { name: 'Porte de arma de fogo', desc: 'Analise e protocolo do pedido conforme atividade e justificativa.' },
      ],
    };
  }

  return {
    url,
    title: 'Treinar antes de decidir',
    desc: 'Para experimentar ou desenvolver tecnica antes de escolher PF/CAC, o caminho indicado e curso inicial.',
    services: [
      { name: 'Operador de pistola nivel I', desc: 'Curso inicial para seguranca, fundamentos e evolucao tecnica.' },
    ],
  };
}

const QuizPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<Question['id'], AnswerId>>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const handleAnswer = (answerId: AnswerId) => {
    const nextAnswers = { ...answers, [questions[step].id]: answerId };
    setAnswers(nextAnswers);
    if (step + 1 < questions.length) {
      setStep(step + 1);
    } else {
      setStep(questions.length);
    }
  };

  const handleBack = () => {
    if (step >= questions.length) {
      setStep(questions.length - 1);
      return;
    }
    if (step <= 0) return;
    const currentQuestionId = questions[step].id;
    setAnswers((current) => {
      const next = { ...current };
      delete next[currentQuestionId];
      return next;
    });
    setStep(step - 1);
  };

  const q = questions[step];
  const isResultStep = step >= questions.length;
  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const path = explainPath(answers);
  const recommendation = resolveRecommendation(answers);
  const answeredTrail = questions
    .filter((question) => answers[question.id])
    .map((question) => ({
      label: questionLabels[question.id],
      value: answerLabels[answers[question.id] as AnswerId],
    }));

  return (
  const journeyItems = [
    { n: 1, label: 'Caminho escolhido', detail: isResultStep ? 'Caminho confirmado' : 'Diagnóstico em andamento', active: true },
    { n: 2, label: 'Documentos e dados', detail: 'Enviar ou preencher manualmente', active: false },
    { n: 3, label: 'Revisão do cadastro', detail: 'Dados reaproveitados ou digitados', active: false },
    { n: 4, label: 'Contrato e pagamento', detail: 'Aceite, cobrança e assinatura', active: false },
    { n: 5, label: 'Arsenal Inteligente', detail: 'Conta criada ou liberada ao concluir', active: false },
  ];

  return (
    <div className="qa-refinado">
      <SEO
        title="Descobrir Meu Caminho - Diagnostico Tatico | Quero Armas"
        description="Em 3 perguntas voce descobre o caminho certo: posse domiciliar, CR no Exercito ou curso de tiro. Diagnostico rapido e direto."
        canonical="/descobrir-meu-caminho"
      />
      <QACadastroRefinadoHeader
        contextTag="EM ANDAMENTO"
        step={step + 1}
        total={TOTAL_STEPS}
        onBack={step > 0 ? handleBack : () => navigate(-1)}
        showBack
        onClose={() => navigate('/')}
      />
      <main className="qa-ref-shell">
        <div className="qa-ref-integrated-grid">
          <div className="qa-ref-integrated-main" key={isResultStep ? 'resultado' : q.id}>
            {isResultStep ? (
              <>
                <span className="qa-ref-caps qa-ref-eyebrow">CAMINHO RECOMENDADO</span>
                <h1 className="qa-ref-title">SEU PRÓXIMO PASSO ESTÁ DEFINIDO</h1>
                <p className="qa-ref-subtitle">{recommendation.desc}</p>
                <div className="qa-ref-section">
                  <div className="qa-ref-opt-list">
                    {recommendation.services.map((service, index) => (
                      <div key={service.name} className="qa-ref-opt-card is-popular" style={{ cursor: 'default' }}>
                        <div className="qa-ref-opt-icon" aria-hidden>
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="qa-ref-opt-body">
                          <span className="qa-ref-caps qa-ref-opt-eyebrow">
                            SERVIÇO {index + 1} DE {recommendation.services.length}
                          </span>
                          <div className="qa-ref-opt-title">{service.name}</div>
                          <div className="qa-ref-opt-desc">{service.desc}</div>
                        </div>
                        {service.price && (
                          <span className="qa-ref-opt-tag-popular" style={{ position: 'static', fontSize: 13 }}>
                            {service.price}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {recommendation.total && (
                    <div
                      className="qa-ref-opt-card"
                      style={{ marginTop: 12, justifyContent: 'space-between', cursor: 'default' }}
                    >
                      <span className="qa-ref-caps" style={{ color: 'var(--qa-ref-ink-soft)' }}>
                        TOTAL DOS SERVIÇOS
                      </span>
                      <strong style={{ color: 'var(--qa-ref-accent)', fontFamily: 'Oswald, system-ui', fontSize: 22 }}>
                        {recommendation.total}
                      </strong>
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                    <button
                      type="button"
                      aria-label="Contratar serviço recomendado"
                      data-testid="quiz-final-cta"
                      className="qa-ref-btn-primary"
                      style={{ padding: '14px 18px', borderRadius: 'var(--qa-ref-radius)', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onClick={() => navigate(recommendation.url)}
                    >
                      CONTRATAR SERVIÇO RECOMENDADO
                      <ChevronRight size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Voltar para serviços"
                      data-testid="quiz-secondary-cta"
                      onClick={() => navigate('/servicos')}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 'var(--qa-ref-radius)',
                        background: 'transparent',
                        color: 'var(--qa-ref-ink)',
                        border: '0.5px solid var(--qa-ref-border)',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      VOLTAR PARA SERVIÇOS
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="qa-ref-caps qa-ref-eyebrow">DIAGNÓSTICO · ETAPA {step + 1} DE {TOTAL_STEPS}</span>
                <h1 className="qa-ref-title">DESCUBRA O CAMINHO CERTO PRA VOCÊ</h1>
                <p className="qa-ref-subtitle">
                  Três perguntas, uma confirmação final e o checkout do serviço correto.
                </p>
                <div className="qa-ref-section">
                  <h2
                    className="qa-ref-caps"
                    style={{ color: 'var(--qa-ref-ink)', fontSize: 14, marginBottom: 4 }}
                  >
                    {q.title}
                  </h2>
                  {q.subtitle && (
                    <p style={{ color: 'var(--qa-ref-ink-soft)', fontSize: 13, marginBottom: 14 }}>
                      {q.subtitle}
                    </p>
                  )}
                  <div className="qa-ref-opt-list">
                    {q.options.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-label={opt.label}
                          data-testid={`quiz-option-${opt.id.replace(/_/g, '-')}`}
                          onClick={() => handleAnswer(opt.id)}
                          className="qa-ref-opt-card"
                        >
                          <div className="qa-ref-opt-icon" aria-hidden>
                            <Icon size={18} />
                          </div>
                          <div className="qa-ref-opt-body">
                            <div className="qa-ref-opt-title">{opt.label}</div>
                            <div className="qa-ref-opt-desc">{opt.desc}</div>
                          </div>
                          <ChevronRight size={18} className="qa-ref-opt-chevron" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {answeredTrail.length > 0 && (
              <div className="qa-ref-section">
                <div className="qa-ref-caps" style={{ color: 'var(--qa-ref-ink-soft)', fontSize: 11, marginBottom: 8 }}>
                  SUAS RESPOSTAS
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {answeredTrail.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: '10px 12px',
                        border: '0.5px solid var(--qa-ref-border)',
                        borderRadius: 'var(--qa-ref-radius)',
                        background: 'var(--qa-ref-paper)',
                      }}
                    >
                      <div className="qa-ref-caps" style={{ fontSize: 10, color: 'var(--qa-ref-ink-soft)' }}>
                        {item.label}
                      </div>
                      <div style={{ marginTop: 2, color: 'var(--qa-ref-ink)', fontSize: 13, fontWeight: 600 }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="qa-ref-journey" aria-label="Resumo do caminho do cliente">
            <div className="qa-ref-journey-kicker">JORNADA DO CLIENTE</div>
            <h2 className="qa-ref-journey-title">DO DIAGNÓSTICO AO ARSENAL</h2>
            <p className="qa-ref-journey-desc">
              O cliente segue no mesmo fluxo até a conclusão do checkout. Nada é perdido entre documentos, dados, contrato, pagamento e acesso.
            </p>
            <ol className="qa-ref-journey-list">
              {journeyItems.map((item) => (
                <li key={item.n} className={item.active ? 'is-active' : ''}>
                  <span className="qa-ref-journey-num">{item.n}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </main>
      <QACadastroRefinadoFooter />
    </div>
  );
};

export default QuizPage;
