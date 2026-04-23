import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Coffee, Users, CheckCircle2, Phone, Crosshair, GraduationCap, Calendar, Heart } from 'lucide-react';

const LpAtividadesAvulsas = () => (
  <SiteShell>
    <section className="relative w-full overflow-hidden border-b border-border bg-background py-20 sm:py-28">
      <div className="container max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-3 py-1.5">
          <Target className="size-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-[0.2em] text-accent">Experiência · Cursos Avulsos · Estande</span>
        </div>
        <h1 className="font-heading text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
          Atire de verdade. <span className="text-accent">Sem compromisso.</span> Sem burocracia.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Você não precisa ser CAC, ter posse ou entrar em processo nenhum pra sentir o coice de uma .40 na mão. Atire como visitante, faça curso avulso, traga amigos, descubra se esse universo é pra você <strong className="text-foreground">antes</strong> de assinar qualquer papel.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/servicos">Ver experiências <ArrowRight className="ml-2 size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer"><Phone className="mr-2 size-4" /> Agendar visita</a></Button>
        </div>
      </div>
    </section>

    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">O que você pode fazer</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Estande aberto. <span className="text-accent">Munição pesada.</span> Instrutores reais.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Crosshair, title: 'Experiência Pistola', desc: 'Sua primeira vez com instrutor 1-a-1. Pistola .380, 9mm e .40.' },
            { icon: GraduationCap, title: 'Curso Operador de Pistola I', desc: 'Curso de 6 a 8 horas. Vale como capacitação técnica.' },
            { icon: Users, title: 'Pacote para grupo', desc: 'Despedida, integração de empresa, encontro de amigos. Estande reservado.' },
            { icon: Heart, title: 'Experiência casal', desc: 'Atirar junto une mais que jantar. Pacote a dois, instrutor dedicado, fotos.' },
            { icon: Calendar, title: 'Aniversário no estande', desc: 'Bolo, sala privativa, estande exclusivo. Aniversário que ninguém esquece.' },
            { icon: Coffee, title: 'Day-use de tiro', desc: 'Passe o dia, treine à vontade, almoce, treine de novo.' },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="rounded-sm border border-border bg-card p-6">
                <div className="mb-3 flex size-12 items-center justify-center rounded-sm border border-accent/40 bg-accent/10"><Icon className="size-5 text-accent" /></div>
                <h3 className="mb-2 font-heading text-base font-bold uppercase">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    <section className="w-full bg-background py-20">
      <div className="container max-w-3xl text-center">
        <Target className="mx-auto mb-4 size-10 text-accent" />
        <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Próximo passo. <span className="text-accent">Resolve sua agenda.</span></h2>
        <p className="mt-4 text-base text-muted-foreground">Estandes regularizados e instrutores credenciados. Direto pelo WhatsApp ou monte seu pacote.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/servicos">Ver pacotes <ArrowRight className="ml-2 size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/descobrir-meu-caminho">Refazer diagnóstico</Link></Button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Sem compromisso</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Estandes credenciados</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Instrutor 1-a-1</span>
        </div>
      </div>
    </section>
  </SiteShell>
);

export default LpAtividadesAvulsas;