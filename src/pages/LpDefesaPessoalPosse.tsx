import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { ArrowRight, Home, Shield, Skull, AlertTriangle, CheckCircle2, Lock, Scale, Target, Phone, X, FileCheck, Users } from 'lucide-react';

const LpDefesaPessoalPosse = () => (
  <SiteShell>
    <section className="relative w-full overflow-hidden border-b border-border bg-background py-20 sm:py-28">
      <div className="container max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-3 py-1.5">
          <Home className="size-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-[0.2em] text-accent">Defesa Pessoal · Posse Domiciliar · Lei 10.826/03</span>
        </div>
        <h1 className="font-heading text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
          Quando ele pular o muro, <span className="text-accent">ninguém vai chegar a tempo.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
          <strong className="text-foreground">7 minutos</strong> é o tempo médio do COPOM. <strong className="text-foreground">40 segundos</strong> é uma execução dentro de casa. <strong className="text-foreground">1.5 segundo</strong> é o saque de quem treina. A única variável que <strong className="text-foreground">você controla</strong> é estar armado, treinado e legalizado <strong className="text-foreground">antes</strong>.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/servicos">Quero minha posse legalizada <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer"><Phone className="mr-2 size-4" /> Falar com especialista</a>
          </Button>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[{v:'+800',l:'Posses concedidas'},{v:'60-120',l:'Dias até estar legal'},{v:'0',l:'Processos travados'}].map((s) => (
            <div key={s.l} className="rounded-sm border border-border bg-card/50 p-4">
              <div className="font-heading text-3xl font-bold text-accent">{s.v}</div>
              <div className="mt-1 font-heading text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">O cenário real</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Você tem <span className="text-accent">três opções</span>. Só uma te mantém vivo.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Skull, title: 'Desarmado', desc: 'Você reza. Negocia. 41% das mortes em assalto residencial acontecem APÓS a entrega dos bens.' },
            { icon: AlertTriangle, title: 'Armado sem treino', desc: 'Trava engatada na hora errada. Tiro no chão. Eles tomam sua arma e usam contra você.' },
            { icon: Shield, title: 'Armado, treinado, legalizado', desc: 'Decisão em 1.5s. Mira certa. Excludente de ilicitude no Art. 25 do CP. Família dorme.' },
          ].map((p, i) => {
            const Icon = p.icon;
            const winner = i === 2;
            return (
              <div key={p.title} className={`rounded-sm border p-6 ${winner ? 'border-accent bg-accent/5' : 'border-border bg-card'}`}>
                <Icon className={`mb-3 size-6 ${winner ? 'text-accent' : 'text-muted-foreground'}`} />
                <h3 className="mb-2 font-heading text-lg font-bold uppercase">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    <section className="w-full border-b border-border bg-background py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Sem nós × Com nós</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">A diferença entre <span className="text-accent">tentar sozinho</span> e <span className="text-accent">ser conduzido</span></h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-6">
            <div className="mb-4 flex items-center gap-2"><X className="size-5 text-destructive" /><h3 className="font-heading text-lg font-bold uppercase text-destructive">Sozinho na PF</h3></div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {['Site da PF cai. Formulário com campos sem sentido.','Atestado psicológico em clínica errada — laudo recusado.','Capacitação técnica em "instrutor de carimbo" — PF identifica.','Documentação devolvida 3 vezes. 8 meses perdidos.','Cofre fora da norma SINARM. Vistoria reprovada.','Sem protocolo pós-disparo: depoimento improvisado vira prisão preventiva.'].map((t) => (
                <li key={t} className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-destructive" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-sm border border-accent bg-accent/5 p-6">
            <div className="mb-4 flex items-center gap-2"><CheckCircle2 className="size-5 text-accent" /><h3 className="font-heading text-lg font-bold uppercase text-accent">Conduzido pela Quero Armas</h3></div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {['Despachante credenciado conduz cada formulário.','Rede de psicólogos credenciados PF — laudo aceito na primeira.','Capacitação técnica nossa, com instrutor reconhecido.','Posse em 60 a 120 dias.','Orientação de cofre conforme IN PF 201/19.','Protocolo pós-disparo plastificado e treino do que falar.'].map((t) => (
                <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">O que você leva</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Pacote <span className="text-accent">Posse Domiciliar</span> completo</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Scale, title: 'Assessoria administrativa na PF', desc: 'Análise de antecedentes, dossiê, requerimento SINARM, protocolo e acompanhamento semanal.' },
            { icon: Target, title: 'Capacitação técnica certa', desc: 'Curso obrigatório (Art. 4º, IV, Lei 10.826) com instrutor reconhecido e estande regularizado.' },
            { icon: Lock, title: 'Orientação de armamento e cofre', desc: 'Calibre certo, cofre IN PF 201/19, posicionamento para acesso em 3 segundos.' },
            { icon: Shield, title: 'Protocolo pós-disparo', desc: 'O que falar pra PM, o que calar, excludentes (Art. 23 e 25 CP). Defesa jurídica é à parte.' },
            { icon: FileCheck, title: 'Renovação automática', desc: 'Posse vence a cada 5 anos (Decreto 11.615/23). Avisamos 6 meses antes.' },
            { icon: Users, title: 'Conversa de família guiada', desc: 'Roteiro pra abrir o assunto com sua esposa antes do CR. Transformar medo em confiança.' },
          ].map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex gap-4 rounded-sm border border-border bg-card p-6">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10"><Icon className="size-5 text-accent" /></div>
                <div><h3 className="mb-1 font-heading text-base font-bold uppercase">{b.title}</h3><p className="text-sm text-muted-foreground">{b.desc}</p></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    <section className="w-full bg-background py-20">
      <div className="container max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Sua família. Sua casa. <span className="text-accent">Sua decisão.</span></h2>
        <p className="mt-4 text-base text-muted-foreground">Lei 10.826/03 te ampara. Decreto 11.615/23 te garante. A gente te conduz.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/servicos">Iniciar minha Posse <ArrowRight className="ml-2 size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/descobrir-meu-caminho">Descobrir meu caminho</Link></Button>
        </div>
      </div>
    </section>
  </SiteShell>
);

export default LpDefesaPessoalPosse;