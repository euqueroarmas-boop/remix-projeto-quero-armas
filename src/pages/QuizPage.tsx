import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { SEO } from '@/shared/components/SEO';
import { ArrowRight, Shield, Target, Crosshair, Home, Trophy, Briefcase, CheckCircle2 } from 'lucide-react';

type Profile = 'defesa-pessoal-posse' | 'cac-cr' | 'atividades-avulsas';

interface Question {
  id: string;
  title: string;
  subtitle?: string;
  options: { label: string; desc: string; icon: typeof Shield; weight: Record<Profile, number> }[];
}

const questions: Question[] = [
  {
    id: 'objetivo',
    title: 'Qual é a sua motivação real?',
    subtitle: 'Sem rodeio. Por que você está aqui?',
    options: [
      { label: 'Defender minha família dentro de casa', desc: 'Quero arma legalizada em casa. Dormir tranquilo. Proteger quem amo.', icon: Home, weight: { 'defesa-pessoal-posse': 3, 'cac-cr': 0, 'atividades-avulsas': 0 } },
      { label: 'Colecionar, atirar e caçar (CAC)', desc: 'Quero CR no Exército. Construir acervo. Treinar habitualidade.', icon: Trophy, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 3, 'atividades-avulsas': 1 } },
      { label: 'Só quero atirar de vez em quando', desc: 'Curiosidade, lazer, experiência no estande. Sem compromisso.', icon: Target, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
      { label: 'Profissão exige (segurança, escolta, VIP)', desc: 'Trabalho na área. Preciso de capacitação técnica.', icon: Briefcase, weight: { 'defesa-pessoal-posse': 1, 'cac-cr': 1, 'atividades-avulsas': 2 } },
    ],
  },
  {
    id: 'documentacao',
    title: 'Onde você está hoje na documentação?',
    options: [
      { label: 'Não tenho nada. Começando do zero.', desc: 'Nunca dei entrada em nada.', icon: Shield, weight: { 'defesa-pessoal-posse': 2, 'cac-cr': 2, 'atividades-avulsas': 1 } },
      { label: 'Já tenho posse na PF', desc: 'Arma registrada em casa. Quero treinar mais ou expandir acervo.', icon: CheckCircle2, weight: { 'defesa-pessoal-posse': 2, 'cac-cr': 1, 'atividades-avulsas': 0 } },
      { label: 'Já sou CAC com CR ativo', desc: 'Tenho CR no Exército. Preciso de habitualidade e suporte.', icon: Trophy, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 3, 'atividades-avulsas': 0 } },
      { label: 'Só quero experimentar antes de decidir', desc: 'Quero atirar primeiro, depois decido.', icon: Target, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
    ],
  },
  {
    id: 'frequencia',
    title: 'Com que frequência você pretende atirar?',
    options: [
      { label: 'Toda semana. Quero virar operador.', desc: 'Treino sério, evolução técnica.', icon: Crosshair, weight: { 'defesa-pessoal-posse': 1, 'cac-cr': 3, 'atividades-avulsas': 1 } },
      { label: 'Mensal. Manter o que sei.', desc: 'Manutenção da técnica.', icon: Target, weight: { 'defesa-pessoal-posse': 3, 'cac-cr': 1, 'atividades-avulsas': 1 } },
      { label: 'Esporádico. Quando der vontade.', desc: 'Hobby leve.', icon: Shield, weight: { 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 3 } },
    ],
  },
];

const QuizPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<Profile, number>>({ 'defesa-pessoal-posse': 0, 'cac-cr': 0, 'atividades-avulsas': 0 });

  const handleAnswer = (weight: Record<Profile, number>) => {
    const next: Record<Profile, number> = {
      'defesa-pessoal-posse': scores['defesa-pessoal-posse'] + weight['defesa-pessoal-posse'],
      'cac-cr': scores['cac-cr'] + weight['cac-cr'],
      'atividades-avulsas': scores['atividades-avulsas'] + weight['atividades-avulsas'],
    };
    setScores(next);
    if (step + 1 < questions.length) setStep(step + 1);
    else {
      const winner = (Object.entries(next) as [Profile, number][]).sort((a, b) => b[1] - a[1])[0][0];
      navigate(`/lp/${winner}`);
    }
  };

  const q = questions[step];
  const progress = ((step + 1) / questions.length) * 100;

  return (
    <SiteShell>
      <SEO
        title="Descobrir Meu Caminho · Diagnóstico Tático | Quero Armas"
        description="Em 2 perguntas você descobre o caminho certo: posse domiciliar, CR no Exército ou atividades avulsas no estande. Diagnóstico rápido e direto."
        canonical="/descobrir-meu-caminho"
      />
      <section className="container max-w-4xl py-16 sm:py-24">
        <div className="mb-8 text-center">
          <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">
            Diagnóstico Tático · Etapa {step + 1} de {questions.length}
          </div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            Descubra o caminho certo <span className="text-accent">pra você</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Três perguntas. Resposta direta. Zero enrolação.
          </p>
        </div>
        <div className="mb-10 h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div key={q.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 text-center">
            <h2 className="font-heading text-2xl font-bold uppercase sm:text-3xl">{q.title}</h2>
            {q.subtitle && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{q.subtitle}</p>}
          </div>
          <div className="grid gap-3 sm:gap-4">
            {q.options.map((opt) => {
              const Icon = opt.icon;
              return (
                <button key={opt.label} onClick={() => handleAnswer(opt.weight)}
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
          {step > 0 && (
            <div className="mt-8 text-center">
              <button onClick={() => setStep(step - 1)} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
                ← Voltar
              </button>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
};

export default QuizPage;