import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { ArrowRight, Trophy, Crosshair, Boxes, FileText, Shield, Award, Target, Phone } from 'lucide-react';

const LpCacCr = () => (
  <SiteShell>
    <section className="relative w-full overflow-hidden border-b border-border bg-background py-20 sm:py-28">
      <div className="container max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-3 py-1.5">
          <Trophy className="size-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-[0.2em] text-accent">CR · Colecionador, Atirador e Caçador</span>
        </div>
        <h1 className="font-heading text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
          CR no Exército. Acervo legal. <span className="text-accent">Habitualidade blindada.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Você quer construir <strong className="text-foreground">acervo</strong>, dominar a técnica e viver o universo armado dentro da lei. CR exige rotina, papel, prazo. A gente carrega tudo pra você focar no que importa: <strong className="text-foreground">atirar</strong>.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/servicos">Quero meu CR ativo <ArrowRight className="ml-2 size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer"><Phone className="mr-2 size-4" /> Especialista CAC</a></Button>
        </div>
      </div>
    </section>

    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">A verdade que ninguém te conta</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">CR não é só pegar o registro. <span className="text-accent">É manter.</span></h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Habitualidade vencida', desc: 'Esquece um ano de comprovação no Exército e perde o direito de comprar munição. Acervo travado.' },
            { title: 'GT, CRAF, psicotécnico', desc: 'Cada arma tem prazo. Cada laudo vence. Quem perde data, perde arma — e às vezes responde por porte ilegal.' },
            { title: 'Acervo sem controle', desc: 'Dez armas, dez prazos. Sem sistema, vira pesadelo. Com sistema, vira coleção legítima.' },
          ].map((p) => (
            <div key={p.title} className="rounded-sm border border-border bg-card p-6">
              <h3 className="mb-2 font-heading text-base font-bold uppercase text-accent">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="w-full border-b border-border bg-background py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">O ecossistema CAC completo</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Do <span className="text-accent">primeiro CR</span> ao acervo dos sonhos</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: FileText, title: 'Concessão e renovação de CR', desc: 'Documentação no Exército. CR ativo em até 90 dias. Renovação a cada 3 anos com lembrete.' },
            { icon: Boxes, title: 'Gestão digital do acervo', desc: 'Cada arma cadastrada com série, CRAF, GT, fotos, NF. Vencimentos com alerta automático.' },
            { icon: Crosshair, title: 'Habitualidade real', desc: 'Cronograma de treinos mensais e documentação correta. Relatório pronto para auditoria.' },
            { icon: Award, title: 'Cursos de evolução técnica', desc: 'Operador de Pistola I, II e III. Carabina. Tiro defensivo. Saque sob estresse.' },
            { icon: Shield, title: 'Orientação normativa CAC', desc: 'Domínio do Estatuto, IN 201, IN 311. Defesa jurídica é contratada à parte com criminalista.' },
            { icon: Target, title: 'Compra de armas e munições', desc: 'Orientação de calibre, parceria com lojas, importação quando faz sentido.' },
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

    <section className="w-full bg-surface-elevated py-20">
      <div className="container max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Acervo na sua mão. <span className="text-accent">Papel na nossa.</span></h2>
        <p className="mt-4 text-base text-muted-foreground">Estatuto, IN 201, IN 311. CR Atirador a partir de R$ 1.127,00 — filiação inclusa.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/servicos">Ver pacotes CAC <ArrowRight className="ml-2 size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/descobrir-meu-caminho">Descobrir meu caminho</Link></Button>
        </div>
      </div>
    </section>
  </SiteShell>
);

export default LpCacCr;