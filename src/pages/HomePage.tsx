import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { ArrowRight, Flame, CheckCircle2, Skull, AlertTriangle, Gavel, Home, Crosshair, Scale, Swords, Clock } from 'lucide-react';

const pillars = [
  { icon: Swords, kicker: 'Pilar 01 · Armamento', title: 'Arma curta ou longa. A que vai salvar a sua família.', desc: 'Pistola pra andar com você. Espingarda pra dormir tranquilo. Te orientamos na escolha certa pro seu perfil, sua casa e a ameaça real do seu CEP.' },
  { icon: Scale, kicker: 'Pilar 02 · Lei', title: 'O direito de ter arma em casa é seu — e está escrito.', desc: 'Lei 10.826/03, Decreto 11.615/23, IN DG/PF 201 e 311. Conduzimos toda a documentação na PF e no Exército — você sai legalizado e blindado juridicamente.' },
  { icon: Crosshair, kicker: 'Pilar 03 · Curso', title: 'Arma sem treino é arma do bandido.', desc: 'Saque, mira sob estresse, decisão tática, defesa jurídica pós-disparo. O curso é complemento obrigatório.' },
];

const painPoints = [
  { icon: Skull, title: 'Desarmado quando importou', desc: 'Quatro homens cercam o carro. Sua filha no banco de trás. A polícia chega em sete minutos. A execução leva quarenta segundos.' },
  { icon: AlertTriangle, title: 'Armado e despreparado', desc: 'Pistola na gaveta, sem treino. Trava engatada na hora errada. Você entrega sua própria munição pro criminoso.' },
  { icon: Gavel, title: 'Reagiu, errou, foi preso', desc: 'Sem instrução jurídica, defender a família vira inquérito. Você troca o caixão pela cela.' },
  { icon: Home, title: 'O dia em que o sistema cair', desc: 'Apagão prolongado, colapso institucional, saque coletivo. Quando o Estado some, sobra você, sua casa e quem bate na porta.' },
];

const HomePage = () => {
  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
        <div className="container relative flex flex-col items-stretch gap-10 py-14 sm:py-20 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-28">
          <div className="col-span-12 flex min-w-0 flex-col gap-6 sm:gap-8 lg:col-span-8">
            <div className="inline-flex w-fit items-center gap-2.5 rounded-sm border border-primary/50 bg-primary/10 px-3 py-1.5 sm:px-4">
              <Flame className="size-3.5 text-primary sm:size-4" />
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/90 sm:tracking-[0.2em]">
                Sua arma · Sua casa · Seu direito
              </span>
            </div>
            <h1 className="max-w-full text-pretty break-words font-heading text-[2rem] font-bold uppercase leading-[1.02] tracking-tight sm:text-balance sm:text-5xl md:text-6xl lg:text-[4.5rem]">
              Quando o bandido arrombar sua porta às 3 da manhã, <span className="text-tactical-gradient">você reza ou saca a sua arma?</span>
            </h1>
            <p className="w-full max-w-full text-base leading-relaxed text-muted-foreground text-pretty sm:max-w-[60ch] sm:text-lg">
              <strong className="text-foreground">Um homicídio a cada 9 minutos.</strong> A <strong className="text-foreground">Lei 10.826/03</strong> e o <strong className="text-foreground">Decreto 11.615/23</strong> te garantem o direito de comprar arma, registrar e defender sua família. Conduzimos os três pilares: <strong className="text-foreground">arma, lei e treino</strong>.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Button asChild size="lg" className="w-full font-heading uppercase tracking-[0.1em] sm:w-auto">
                <Link to="/servicos">Quero estar armado e legal <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full font-heading uppercase tracking-[0.1em] sm:w-auto">
                <Link to="/descobrir-meu-caminho">Descobrir meu caminho</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full font-heading uppercase tracking-[0.1em] sm:w-auto">
                <a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
              </Button>
            </div>
          </div>
          <div className="relative col-span-12 min-w-0 lg:col-span-4">
            <article className="relative flex h-full w-full max-w-full flex-col gap-5 rounded-sm border border-primary/40 bg-card p-6 shadow-deep sm:gap-6 sm:p-8">
              <div className="absolute left-0 top-0 h-[3px] w-full bg-gradient-tactical" />
              <div className="font-heading text-xs font-medium uppercase tracking-[0.2em] text-primary">Programa Quero Armas</div>
              <h3 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-3xl">Arma + Lei +<br />Treino.</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                A tríade da defesa pessoal séria. Sem arma você reza. Sem lei você é preso. Sem treino você morre.
              </p>
              <ul className="flex flex-col gap-3 text-sm font-medium">
                {['Aquisição da sua arma de fogo longa / curta', 'Documentação PF e Exército blindada', 'Curso operacional em estande homologado'].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t border-border pt-5 sm:pt-6">
                <Button asChild size="lg" className="w-full font-heading uppercase tracking-widest">
                  <Link to="/servicos">Iniciar agora <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* DOR */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className="container">
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">Diagnóstico tático</div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Quatro cenários. <span className="text-tactical-gradient">Você já está em pelo menos um.</span>
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
            {painPoints.map((p, i) => {
              const Icon = p.icon;
              return (
                <article key={p.title} className="group relative flex flex-col gap-5 rounded-sm border border-border bg-card p-6 transition-colors hover:border-primary/50 sm:p-8">
                  <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-tactical opacity-60" />
                  <div className="flex items-center justify-between">
                    <Icon className="size-8 text-primary" />
                    <span className="font-heading text-3xl font-bold tabular-nums text-muted-foreground/30 sm:text-4xl">0{i + 1}</span>
                  </div>
                  <h3 className="font-heading text-xl font-bold uppercase leading-tight sm:text-2xl">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{p.desc}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 rounded-sm border border-primary/40 bg-primary/5 p-6 sm:mt-14 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Clock className="size-10 shrink-0 text-primary" />
              <div className="flex-1">
                <h3 className="font-heading text-lg font-bold uppercase leading-tight sm:text-xl">A polícia chega em 7 minutos. O bandido decide em 7 segundos.</h3>
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">Treinamento e armamento não são luxo de paranoico.</p>
              </div>
              <Button asChild size="lg" className="w-full font-heading uppercase tracking-widest sm:w-auto">
                <Link to="/servicos">Quero o programa <ArrowRight className="ml-2 size-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* PILARES */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className="container">
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">A tríade não-negociável</div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Existe um caminho. <span className="text-tactical-gradient">Três pilares</span>. Falta um, falham todos.
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <article key={p.title} className="group relative flex flex-col gap-5 rounded-sm border border-border bg-card p-6 transition-colors hover:border-primary/50 sm:p-8">
                  <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-tactical opacity-60" />
                  <Icon className="size-9 text-primary" />
                  <div>
                    <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">{p.kicker}</div>
                    <h3 className="font-heading text-xl font-bold uppercase leading-tight sm:text-2xl">{p.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{p.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative w-full bg-surface-overlay/40 py-16 sm:py-24">
        <div className="container max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            A lei te dá o direito. <span className="text-tactical-gradient">Nós entregamos a arma.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Pare de adiar. Sua família não pode esperar a próxima manchete.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="font-heading uppercase tracking-[0.1em]">
              <Link to="/servicos">Ver catálogo de serviços <ArrowRight className="ml-2 size-5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-heading uppercase tracking-[0.1em]">
              <Link to="/descobrir-meu-caminho">Fazer diagnóstico</Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
};

export default HomePage;