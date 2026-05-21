import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { SEO } from '@/shared/components/SEO';
import { ArrowRight, Shield, Target, Crosshair, Home, Trophy, Briefcase, CheckCircle2, Route } from 'lucide-react';

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
      { id: 'defesa_casa', label: 'Defender minha familia dentro de casa', desc: 'Quero arma legalizada em casa. Dormir tranquilo. Proteger quem amo.', icon: Home, weight: { 'defesa-pessoal-posse': 3, 'cac-cr': 0, 'atividades-avulsas': 0 } },
      { id: 'cac_objetivo', label: 'Colecionar, atirar e cacar (CAC)', desc: 'Quero CR no Exercito. Construir acervo. Treinar habitualidade.', icon: Trophy, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 3, 'atividades-avulsas': 1 } },
      { id: 'atirar_eventual', label: 'So quero atirar de vez em quando', desc: 'Curiosidade, lazer, experiencia no estande. Sem compromisso.', icon: Target, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
      { id: 'profissao', label: 'Profissao exige (seguranca, escolta, VIP)', desc: 'Trabalho na area. Preciso de capacitacao tecnica.', icon: Briefcase, weight: { 'defesa-pessoal-posse': 1, 'cac-cr': 1, 'atividades-avulsas': 2 } },
    ],
  },
  {
    id: 'documentacao',
    title: 'Onde voce esta hoje na documentacao?',
    options: [
      { id: 'zero', label: 'Nao tenho nada. Comecando do zero.', desc: 'Nunca dei entrada em nada.', icon: Shield, weight: { 'defesa-pessoal-posse': 2, 'cac-cr': 2, 'atividades-avulsas': 1 } },
      { id: 'posse_pf', label: 'Ja tenho posse na PF', desc: 'Arma registrada em casa. Quero treinar mais ou expandir acervo.', icon: CheckCircle2, weight: { 'defesa-pessoal-posse': 2, 'cac-cr': 1, 'atividades-avulsas': 0 } },
      { id: 'cr_ativo', label: 'Ja sou CAC com CR ativo', desc: 'Tenho CR no Exercito. Preciso de habitualidade e suporte.', icon: Trophy, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 3, 'atividades-avulsas': 0 } },
      { id: 'experimentar', label: 'So quero experimentar antes de decidir', desc: 'Quero atirar primeiro, depois decido.', icon: Target, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
    ],
  },
  {
    id: 'frequencia',
    title: 'Com que frequencia voce pretende atirar?',
    options: [
      { id: 'semanal_operador', label: 'Toda semana. Quero virar operador.', desc: 'Treino serio, evolucao tecnica.', icon: Crosshair, weight: { 'defesa-pessoal-posse': 1, 'cac-cr': 3, 'atividades-avulsas': 1 } },
      { id: 'mensal', label: 'Mensal. Manter o que sei.', desc: 'Manutencao da tecnica.', icon: Target, weight: { 'defesa-pessoal-posse': 3, 'cac-cr': 1, 'atividades-avulsas': 1 } },
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
    <SiteShell>
      <SEO
        title="Descobrir Meu Caminho - Diagnostico Tatico | Quero Armas"
        description="Em 3 perguntas voce descobre o caminho certo: posse domiciliar, CR no Exercito ou curso de tiro. Diagnostico rapido e direto."
        canonical="/descobrir-meu-caminho"
      />
      <section className="w-full px-4 py-16 sm:px-6 sm:py-24 lg:px-10 2xl:px-16">
        <div className="mx-auto mb-8 max-w-4xl text-center">
          <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">
            Diagnostico Tatico - Etapa {step + 1} de {TOTAL_STEPS}
          </div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            Descubra o caminho certo <span className="text-accent">pra voce</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Tres perguntas, uma confirmacao final e o checkout do servico correto.
          </p>
        </div>
        <div className="mx-auto mb-10 h-1 w-full max-w-4xl overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div key={isResultStep ? 'resultado' : q.id} className="mx-auto grid max-w-6xl gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 lg:grid-cols-[minmax(0,1fr)_360px]">
          {isResultStep ? (
            <div>
              <div className="mb-8 text-center lg:text-left">
                <h2 className="font-heading text-2xl font-bold uppercase sm:text-3xl">Confirme seu caminho</h2>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">{recommendation.desc}</p>
              </div>
              <div className="grid gap-4">
                {recommendation.services.map((service, index) => (
                  <div key={service.name} className="rounded-sm border border-border bg-card p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                          Servico {index + 1} de {recommendation.services.length}
                        </div>
                        <h3 className="font-heading text-xl font-bold uppercase leading-tight sm:text-2xl">{service.name}</h3>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{service.desc}</p>
                      </div>
                      {service.price && (
                        <div className="shrink-0 text-right font-heading text-2xl font-bold text-accent sm:text-3xl">
                          {service.price}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {recommendation.total && (
                  <div className="flex items-center justify-between rounded-sm border border-accent/35 bg-accent/10 p-4">
                    <span className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Total dos servicos</span>
                    <strong className="font-heading text-2xl text-foreground">{recommendation.total}</strong>
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Contratar serviço recomendado"
                  data-testid="quiz-final-cta"
                  className="group flex items-center justify-center gap-2 rounded-sm bg-accent px-5 py-4 font-heading text-sm font-bold uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90"
                  onClick={() => navigate(recommendation.url)}
                >
                  Contratar serviço recomendado
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  aria-label="Voltar para serviços"
                  data-testid="quiz-secondary-cta"
                  className="flex items-center justify-center gap-2 rounded-sm border border-border bg-background px-5 py-3 font-heading text-xs font-bold uppercase tracking-[0.14em] text-foreground transition-colors hover:border-accent hover:text-accent"
                  onClick={() => navigate('/servicos')}
                >
                  Voltar para serviços
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-8 text-center lg:text-left">
                <h2 className="font-heading text-2xl font-bold uppercase sm:text-3xl">{q.title}</h2>
                {q.subtitle && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{q.subtitle}</p>}
              </div>
              <div className="grid gap-3 sm:gap-4">
                {q.options.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-label={opt.label}
                      data-testid={`quiz-option-${opt.id.replace(/_/g, '-')}`}
                      onClick={() => handleAnswer(opt.id)}
                      className="group flex items-start gap-4 rounded-sm border border-border bg-card p-5 text-left transition-all hover:border-accent hover:bg-surface-elevated sm:p-6">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-border bg-background transition-colors group-hover:border-accent group-hover:bg-accent/10">
                        <Icon className="size-5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <div className="font-heading text-base font-bold uppercase tracking-wide sm:text-lg">{opt.label}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{opt.desc}</div>
                      </div>
                      <ArrowRight className="mt-2 size-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-accent" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <aside className="rounded-sm border border-border bg-card p-5 lg:self-start">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10">
                <Route className="size-5 text-accent" />
              </div>
              <div>
                <div className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-accent">Jornada do cliente</div>
                <div className="text-xs text-muted-foreground">Do diagnostico ao Arsenal</div>
              </div>
            </div>
            <h3 className="font-heading text-lg font-bold uppercase leading-tight">
              {isResultStep ? 'Caminho pronto para checkout' : path.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{path.description}</p>
            {answeredTrail.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-border pt-4">
                {answeredTrail.map((item) => (
                  <div key={item.label} className="rounded-sm bg-background p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Rota provavel</div>
              <ol className="mt-3 space-y-3">
                {path.steps.map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-accent/50 text-xs font-bold text-accent">{index + 1}</span>
                    <span className="leading-snug text-foreground">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Jornada completa</div>
              <ol className="mt-3 space-y-2">
                {[
                  { n: 1, label: "Diagnostico guiado", detail: isResultStep ? "Caminho confirmado" : "Respondendo motivacao real", active: true },
                  { n: 2, label: "Documentos e dados", detail: "Enviar ou preencher manualmente", active: false },
                  { n: 3, label: "Revisao do cadastro", detail: "Dados reaproveitados ou digitados", active: false },
                  { n: 4, label: "Contrato e pagamento", detail: "Aceite, cobranca e assinatura", active: false },
                  { n: 5, label: "Arsenal Inteligente", detail: "Conta criada ou liberada ao concluir", active: false },
                ].map((item) => (
                  <li
                    key={item.n}
                    className={`flex gap-3 rounded-sm p-3 text-sm ${item.active ? 'border border-accent/35 bg-accent/10' : 'bg-background/70'}`}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-accent/50 text-xs font-bold text-accent">
                      {item.n}
                    </span>
                    <span>
                      <strong className="block leading-snug text-foreground">{item.label}</strong>
                      <small className="text-xs leading-snug text-muted-foreground">{item.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-5 rounded-sm border border-accent/30 bg-accent/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Checkout indicado</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{path.service}</div>
            </div>
          </aside>
          {step > 0 && (
            <div className="mt-2 text-center lg:col-span-2">
              <button onClick={handleBack} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                {isResultStep ? 'Ajustar respostas' : 'Voltar'}
              </button>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
};

export default QuizPage;
