import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { SEO } from '@/shared/components/SEO';
import { ArrowRight, Trophy, Crosshair, Boxes, FileText, Shield, Award, Target, Phone, CheckCircle2, AlertTriangle, Bell, Calendar, Quote, HelpCircle } from 'lucide-react';

const LpCacCr = () => (
  <SiteShell>
    <SEO
      title="CR no Exército · CAC Colecionador, Atirador e Caçador | Quero Armas"
      description="CR ativo no Exército, acervo legal e habitualidade blindada. Documentação completa, controle de prazos e suporte CAC. Foco no tiro, papel é com a gente."
      canonical="/cac-cr"
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Registro CR — Colecionador, Atirador e Caçador',
        provider: { '@type': 'Organization', name: 'Quero Armas' },
        areaServed: 'BR',
        serviceType: 'Documentação CAC/CR no Exército Brasileiro',
        description: 'Filiação a clube, registro CR no Exército, aquisição de armas, controle de habitualidade e renovação.',
      }}
    />
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
      </div>
    </section>

    {/* Jornada do CAC */}
    <section className="w-full border-b border-border bg-background py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">Jornada CAC · 90 dias</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Da <span className="text-accent">primeira ficha</span> ao <span className="text-accent">CR ativo</span></h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', t: 'Filiação ao clube', d: 'Inscrição em clube credenciado, ATA de admissão emitida em 7 dias.' },
            { n: '02', t: 'Documentação Exército', d: 'Antecedentes, psicotécnico, capacitação técnica e dossiê SFPC montado.' },
            { n: '03', t: 'Análise SFPC', d: 'Protocolo militar, acompanhamento semanal, resposta em até 60 dias.' },
            { n: '04', t: 'CR ativo + acervo', d: 'CR emitido, primeira GT, CRAF, gestão digital ligada e calendário de habitualidade.' },
          ].map((s) => (
            <div key={s.n} className="rounded-sm border border-border bg-card p-6">
              <div className="mb-3 font-heading text-3xl font-bold text-accent">{s.n}</div>
              <h3 className="mb-2 font-heading text-base font-bold uppercase">{s.t}</h3>
              <p className="text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Objeções */}
    <section className="w-full border-b border-border bg-surface-elevated py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">As 4 dúvidas que travam todo CAC novato</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Resposta direta. <span className="text-accent">Sem enrolação.</span></h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { q: '"O Decreto 11.615/23 não acabou com o CAC?"', a: 'Não. Reduziu acervo e impôs habitualidade. CR continua ativo, com regras mais rigorosas — e mais defensáveis juridicamente.' },
            { q: '"E se eu perder a habitualidade?"', a: 'Suspende o direito de comprar munição até regularizar. Nosso sistema dispara alerta 60 dias antes para zerar esse risco.' },
            { q: '"Preciso atirar quantas vezes por ano?"', a: 'Mínimo de 4 sessões anuais por arma de uso permitido. Acompanhamos seu cronograma e geramos os relatórios para o Exército.' },
            { q: '"Posso ter posse e CR juntos?"', a: 'Sim. São registros distintos — Posse na PF (defesa) e CR no Exército (esporte/coleção). Cuidamos dos dois sem conflito.' },
          ].map((o) => (
            <div key={o.q} className="rounded-sm border border-border bg-card p-6">
              <div className="mb-2 flex items-start gap-2"><HelpCircle className="mt-0.5 size-4 shrink-0 text-accent" /><h3 className="font-heading text-sm font-bold uppercase text-accent">{o.q}</h3></div>
              <p className="text-sm text-muted-foreground">{o.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Prova social */}
    <section className="w-full border-b border-border bg-background py-20">
      <div className="container max-w-5xl">
        <div className="mb-12 text-center">
          <div className="mb-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">CACs ativos que conduzimos</div>
          <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">A prova vem de quem <span className="text-accent">já está atirando</span></h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: 'Rafael M.', r: 'CAC III · 7 armas', q: 'Larguei o despachante anterior depois de 14 meses parado. Em 73 dias já tinha CR ativo e duas armas no acervo.' },
            { n: 'Eduardo S.', r: 'Atirador · IPSC', q: 'A gestão digital salva a vida. Nunca mais perdi prazo de GT, CRAF nem habitualidade. Treino, não me preocupo.' },
            { n: 'Luciana P.', r: 'CAC II · Caçadora', q: 'Atendimento sem o machismo de praxe. Me explicaram tudo e me trataram como atiradora — não como esposa de atirador.' },
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

    {/* Alerta habitualidade */}
    <section className="w-full border-b border-border bg-surface-elevated py-16">
      <div className="container max-w-4xl">
        <div className="rounded-sm border border-accent/40 bg-accent/5 p-8 sm:p-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <Bell className="size-10 shrink-0 text-accent" />
            <div>
              <h3 className="font-heading text-2xl font-bold uppercase">Habitualidade não é detalhe. <span className="text-accent">É o que define se você continua CAC.</span></h3>
              <p className="mt-3 text-sm text-muted-foreground">Cada arma exige comprovação anual. Esquecer um relatório custa o direito de comprar munição. Nosso painel cliente envia <strong className="text-foreground">3 alertas escalonados</strong> (60, 30 e 7 dias antes) por e-mail e WhatsApp. Você nunca mais perde prazo.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/portal">Acessar painel CAC <ArrowRight className="ml-2 size-3.5" /></Link></Button>
                <Button asChild size="sm" variant="outline"><a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer"><Phone className="mr-2 size-3.5" /> Auditar meu acervo</a></Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* CTA final reforçado */}
    <section className="w-full bg-background py-20">
      <div className="container max-w-3xl text-center">
        <Trophy className="mx-auto mb-4 size-10 text-accent" />
        <h2 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Comece o CR. <span className="text-accent">Construa o acervo.</span></h2>
        <p className="mt-4 text-base text-muted-foreground">Estatuto · IN 201 · IN 311 · Decreto 11.615/23. Filiação a clube credenciado já incluída.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/servicos">Ver pacotes CAC <ArrowRight className="ml-2 size-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/descobrir-meu-caminho">Descobrir meu caminho</Link></Button>
        </div>
      </div>
    </section>
  </SiteShell>
);

export default LpCacCr;