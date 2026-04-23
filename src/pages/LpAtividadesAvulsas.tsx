import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, Coffee, Users, CheckCircle2, Phone, Crosshair, GraduationCap, Calendar, Heart, Quote, HelpCircle, MapPin, Clock, Shield } from 'lucide-react';

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

    {/* Pra quem é */}
    <section className="w-full border-b border-border bg-background py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Pra quem é</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Você <span className="text-accent">não precisa</span> de processo, CR ou posse</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: 'O curioso', d: 'Sempre quis saber como é. Quer experimentar antes de decidir se vale entrar no universo armado.' },
            { t: 'O grupo de amigos', d: 'Despedida de solteiro, integração de empresa, rolê com a galera. Estande exclusivo, instrutor dedicado.' },
            { t: 'O futuro CAC', d: 'Já decidiu, mas quer testar calibres e plataformas antes de investir no acervo. Aqui você compara na prática.' },
          ].map((p) => (
            <div key={p.t} className="rounded-sm border border-border bg-card p-6">
              <h3 className="mb-2 font-heading text-base font-bold uppercase text-accent">{p.t}</h3>
              <p className="text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Como funciona */}
    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Como funciona</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Do <span className="text-accent">WhatsApp</span> ao <span className="text-accent">primeiro disparo</span> em 48h</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', i: Phone, t: 'Contato', d: 'WhatsApp ou formulário. Escolhemos juntos a experiência ideal.' },
            { n: '02', i: Calendar, t: 'Agenda', d: 'Reservamos estande, instrutor e munição na data combinada.' },
            { n: '03', i: MapPin, t: 'Estande', d: 'Você chega, assina o termo, recebe EPI e instrução de segurança.' },
            { n: '04', i: Crosshair, t: 'Atira', d: 'Instrutor 1-a-1, calibres na mesa, fotos e relatório do desempenho.' },
          ].map((s) => {
            const Icon = s.i;
            return (
              <div key={s.n} className="rounded-sm border border-border bg-card p-6">
                <div className="mb-2 font-heading text-3xl font-bold text-accent">{s.n}</div>
                <Icon className="mb-3 size-5 text-accent" />
                <h3 className="mb-2 font-heading text-base font-bold uppercase">{s.t}</h3>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    {/* Depoimentos */}
    <section className="w-full border-b border-border bg-background py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Quem já passou pelo estande</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">A <span className="text-accent">primeira vez</span> não se esquece</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: 'Mariana T.', r: 'Primeira experiência', q: 'Eu morria de medo de arma. Saí dali querendo fazer o curso de operador. Mudou completamente minha cabeça.' },
            { n: 'Grupo TechCo', r: 'Integração corporativa', q: 'Nossa diretoria passou a tarde no estande. Foi a integração mais comentada do ano. Já agendamos a próxima.' },
            { n: 'Bruno A.', r: 'Despedida de solteiro', q: '12 caras, 3 calibres, sala privativa. Instrutor sério, segurança impecável e a galera adorou. 10/10.' },
          ].map((d) => (
            <div key={d.n} className="rounded-sm border border-border bg-card p-6">
              <Quote className="mb-3 size-5 text-accent" />
              <p className="text-sm italic text-muted-foreground">"{d.q}"</p>
              <div className="mt-4 border-t border-border pt-3"><div className="font-heading text-sm font-bold uppercase">{d.n}</div><div className="font-heading text-xs uppercase tracking-widest text-accent">{d.r}</div></div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-4xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Perguntas frequentes</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Tudo que <span className="text-accent">você precisa saber</span></h2>
        </div>
        <div className="space-y-3">
          {[
            { q: 'Preciso ter algum registro pra atirar?', a: 'Não. Como visitante, você atira sob supervisão direta de instrutor credenciado, em estande regularizado. É 100% legal pelo Estatuto.' },
            { q: 'Tem idade mínima?', a: 'Sim, 18 anos completos com documento original. Menores de idade não atiram em hipótese alguma.' },
            { q: 'Posso levar minha esposa, namorada ou amigos?', a: 'Pode e queremos. Pacotes em dupla, grupo, casal e empresa. Estande pode ser reservado privativo.' },
            { q: 'Que calibres vou poder atirar?', a: '.22, .380, 9mm, .40 e calibres maiores conforme disponibilidade do estande do dia. Tudo combinado antes.' },
            { q: 'O curso avulso vale como capacitação técnica?', a: 'Sim. O Curso Operador de Pistola I é reconhecido pela PF e Exército como capacitação técnica para Posse e CR.' },
            { q: 'Quanto custa em média?', a: 'Experiência individual a partir de R$ 350. Curso completo a partir de R$ 690. Pacotes de grupo sob consulta.' },
          ].map((f) => (
            <details key={f.q} className="group rounded-sm border border-border bg-card p-5">
              <summary className="flex cursor-pointer items-center gap-3 list-none">
                <HelpCircle className="size-4 shrink-0 text-accent" />
                <span className="font-heading text-sm font-bold uppercase">{f.q}</span>
              </summary>
              <p className="mt-3 pl-7 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    {/* Garantias */}
    <section className="w-full border-b border-border bg-background py-16">
      <div className="container max-w-5xl">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { i: Shield, t: 'Estande credenciado', d: 'Habilitado pela PF e Exército, com vistoria de cofres e instrutores reconhecidos.' },
            { i: Clock, t: 'Pontualidade', d: 'Reservamos estande na sua hora. Sem fila, sem atraso, sem improviso.' },
            { i: CheckCircle2, t: 'Satisfação garantida', d: 'Se a experiência não atender, devolvemos 100% sem perguntas. Já entendeu nosso padrão.' },
          ].map((g) => {
            const Icon = g.i;
            return (
              <div key={g.t} className="flex gap-4 rounded-sm border border-border bg-card p-5">
                <Icon className="size-6 shrink-0 text-accent" />
                <div><div className="font-heading text-sm font-bold uppercase">{g.t}</div><p className="mt-1 text-xs text-muted-foreground">{g.d}</p></div>
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