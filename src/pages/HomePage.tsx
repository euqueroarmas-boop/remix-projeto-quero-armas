import { Link } from 'react-router-dom';
import { SiteShell } from '@/shared/components/layout/SiteShell';
import { Button } from '@/components/ui/button';
import { GoogleReviewsCarousel } from '@/shared/components/GoogleReviewsCarousel';
import { SEO } from '@/shared/components/SEO';
import homeArsenal from '@/assets/home-arsenal.jpg';
import homeColete from '@/assets/home-colete.jpg';
import homeMunicao from '@/assets/home-municao.jpg';
import homeCursoOperador from '@/assets/home-curso-operador.jpg';
import homeDor from '@/assets/home-dor.jpg';
import homeManchetes from '@/assets/home-manchetes.jpg';
import homeColapso from '@/assets/home-colapso.jpg';
import homePilares from '@/assets/home-pilares.jpg';
import homeLei from '@/assets/home-lei.jpg';
import homeCacRecarga from '@/assets/home-cac-recarga.jpg';
import homeFamilia from '@/assets/home-familia.jpg';
import homeProtocolo from '@/assets/home-protocolo.jpg';
import homeMulherArmada from '@/assets/home-mulher-armada.jpg';
import homeLoja from '@/assets/home-loja.jpg';
import homeJornada from '@/assets/home-jornada.jpg';
import {
  ArrowRight, ShieldAlert, Crosshair, Skull, Clock, Newspaper, AlertTriangle,
  CheckCircle2, Target, Flame, Lock, Scale, Gavel, Swords, Home, Zap, Shield,
  Store, PackageX, Wrench, Boxes, Factory, Heart, KeyRound, Phone, UserCheck,
  GraduationCap, BookOpen, Coffee, Users, MapPin, Calendar, Award,
} from 'lucide-react';

const PORTAL_PATH = '/quero-armas/area-do-cliente';

const pillars = [
  { icon: Swords, kicker: 'Pilar 01 · Armamento', title: 'Arma curta ou longa. A que vai salvar a sua família.', desc: 'Pistola pra andar com você. Espingarda pra dormir tranquilo. Revólver que nunca falha. Não é coleção. Não é hobby. É a ferramenta que decide se sua mulher vai dormir viúva ou se seus filhos vão crescer com pai. Te orientamos na escolha certa pro seu perfil, sua casa e a ameaça real do seu CEP.' },
  { icon: Scale, kicker: 'Pilar 02 · Lei', title: 'O direito de ter arma em casa é seu — e está escrito.', desc: 'Lei 10.826/03 (Estatuto do Desarmamento), Decreto 11.615/23, Instruções Normativas DG/PF 201 e 311. Você pode ter arma. Você pode comprar munição. Você pode defender sua casa. Conduzimos toda a documentação na PF e no Exército — você sai legalizado, registrado e blindado juridicamente.' },
  { icon: Crosshair, kicker: 'Pilar 03 · Curso', title: 'Arma sem treino é arma do bandido.', desc: 'Não adianta ter Ferrari e não saber dirigir. O curso é complemento obrigatório — antes ou depois da compra, mas nunca opcional. Saque, mira sob estresse, decisão tática, defesa jurídica pós-disparo.' },
];

const painPoints = [
  { icon: Skull, title: 'Desarmado quando importou', desc: 'Quatro homens cercam o carro. Sua filha no banco de trás. Você só tem as mãos. A polícia chega em sete minutos. A execução leva quarenta segundos.' },
  { icon: AlertTriangle, title: 'Armado e despreparado', desc: 'Pistola na gaveta, sem treino. Trava engatada na hora errada, mira no chão, dedo no gatilho antes da decisão. Você entrega sua própria munição pro criminoso.' },
  { icon: Gavel, title: 'Reagiu, errou, foi preso', desc: 'Sem instrução jurídica, defender a família vira inquérito. Disparo nas costas, tiro de misericórdia, calibre irregular. Você troca o caixão pela cela.' },
  { icon: Home, title: 'O dia em que o sistema cair', desc: 'Apagão prolongado, colapso institucional, saque coletivo. Não é teoria — é Argentina, Venezuela, Chile. Quando o Estado some, sobra você, sua casa e quem bate na porta.' },
];

const newsHeadlines = [
  { tag: 'São Paulo · Desarmado', title: 'Pai de família é morto sem arma defendendo a casa de invasores', meta: 'Reagiu com as mãos. Não tinha pistola. A esposa assistiu tudo.' },
  { tag: 'Rio de Janeiro · 9mm permitido', title: 'Comerciante reagiu com 9mm legal e neutralizou três assaltantes', meta: 'Tinha 9mm, .380 e .38 registrados. Sabia sacar. Voltou pra casa pro jantar.' },
  { tag: 'Minas Gerais · Sem porte', title: 'Sequestro termina em chacina porque vítima estava desarmada', meta: 'Tinha condições legais de ter arma. Não tirou os documentos a tempo.' },
  { tag: 'Brasil · Estatística', title: 'A cada 9 minutos uma pessoa é assassinada — a maioria desarmada', meta: 'Você vai esperar a polícia ou vai ter sua própria arma em casa?' },
];

const arsenal = [
  { cal: '.40 S&W', tag: 'Defesa pessoal', desc: 'Calibre policial. Poder de parada superior ao 9mm padrão. Recuo controlável com treino.' },
  { cal: '.45 ACP', tag: 'Stopping power', desc: 'Projétil pesado, energia transferida no alvo. Tradição de combate desde 1911.' },
  { cal: '12 Cal.', tag: 'Defesa de domicílio', desc: 'Espingarda calibre 12. O som do bombeamento já encerra 80% das invasões.' },
  { cal: '.357 Mag', tag: 'Revólver tático', desc: 'Confiabilidade absoluta. Não falha. Não trava. Para quem quer simplicidade letal.' },
];

const journey = [
  { n: '01', title: 'Diagnóstico tático', desc: 'Análise do seu perfil, ameaça real e arsenal ideal.' },
  { n: '02', title: 'Documentação PF/Exército', desc: 'Conduzimos CAC e/ou Defesa Pessoal do início ao CRAF.' },
  { n: '03', title: 'Aquisição do equipamento', desc: 'Recomendação técnica de calibre, marca, coldre e munição.' },
  { n: '04', title: 'Curso operacional', desc: 'Treino real em estande. Saque, tiro defensivo, decisão sob estresse.' },
  { n: '05', title: 'Protocolo pós-disparo', desc: 'Você sabe o que falar, o que calar e como agir após o disparo. Defesa jurídica é contratada à parte com criminalista de sua confiança.' },
  { n: '06', title: 'Pronto operacional', desc: 'Armado, treinado, legalizado e preparado para o pior cenário.' },
];

const HomePage = () => {
  const containerCls = 'mx-auto w-full max-w-full box-border px-4 sm:container sm:px-6 lg:px-8';
  return (
    <SiteShell>
      <SEO
        title="Quero Armas · Posse, CAC/CR e Treinamento Tático Legalizado"
        description="Posse domiciliar, CR no Exército, cursos de tiro e habitualidade. Documentação na PF e EB, treinamento real e suporte jurídico. Saia legalizado e armado."
        canonical="/"
        type="website"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Quero Armas',
            url: 'https://queroarmas.com.br',
            logo: 'https://queroarmas.com.br/logo.png',
            sameAs: ['https://wa.me/5511978481919'],
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: '+55-11-97848-1919',
              contactType: 'customer service',
              areaServed: 'BR',
              availableLanguage: ['pt-BR'],
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Quero Armas',
            url: 'https://queroarmas.com.br',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://queroarmas.com.br/servicos?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />
      {/* 1 · HERO */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
        <div className={`${containerCls} relative flex flex-col items-stretch gap-10 py-14 sm:py-20 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-28`}>
          <div className="col-span-12 flex min-w-0 flex-col gap-6 sm:gap-8 lg:col-span-8">
            <div className="inline-flex w-fit items-center gap-2.5 rounded-sm border border-primary/50 bg-primary/10 px-3 py-1.5 sm:px-4">
              <Flame className="size-3.5 text-primary sm:size-4" />
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/90 sm:tracking-[0.2em]">Sua arma · Sua casa · Seu direito</span>
            </div>
            <h1 className="max-w-full text-pretty break-words font-heading text-[2rem] font-bold uppercase leading-[1.02] tracking-tight sm:text-balance sm:text-5xl md:text-6xl lg:text-[4.5rem] xl:text-[5.25rem]">
              Quando o bandido arrombar sua porta às 3 da manhã, <span className="text-tactical-gradient">você reza ou saca a sua arma?</span>
            </h1>
            <p className="w-full max-w-full text-base leading-relaxed text-muted-foreground text-pretty sm:max-w-[60ch] sm:text-lg">
              <strong className="text-foreground">Um homicídio a cada 9 minutos.</strong> Crime organizado entrando em casa. Polícia que chega depois. A <strong className="text-foreground">Lei 10.826/03</strong> e o <strong className="text-foreground">Decreto 11.615/23</strong> te garantem o direito de <strong className="text-foreground">comprar arma, registrar, manter em casa e defender sua família</strong>. Nós conduzimos os três pilares: <strong className="text-foreground">arma, lei e treino</strong>.
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
            <div className="pointer-events-none absolute inset-2 -z-10 rounded-full bg-primary/10 blur-3xl sm:-inset-8" />
            <div className="pointer-events-none absolute -right-4 -top-4 hidden size-24 border-r-2 border-t-2 border-primary/40 sm:block" />
            <div className="pointer-events-none absolute -bottom-4 -left-4 hidden size-24 border-b-2 border-l-2 border-accent/30 sm:block" />
            <article className="group relative flex h-full w-full max-w-full flex-col gap-5 rounded-sm border border-primary/40 bg-card p-6 shadow-deep sm:gap-6 sm:p-8">
              <div className="absolute left-0 top-0 h-[3px] w-full bg-gradient-tactical" />
              <div className="font-heading text-xs font-medium uppercase tracking-[0.2em] text-primary">Programa Quero Armas</div>
              <h3 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-3xl">Arma + Lei +<br />Treino.</h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">A tríade da defesa pessoal séria. Sem arma você reza. Sem lei você é preso. Sem treino você morre. Aqui você sai com os três.</p>
              <ul className="flex flex-col gap-3 text-sm font-medium">
                {['Aquisição da sua arma de fogo longa / curta', 'Documentação PF e Exército blindada', 'Curso operacional em estande homologado'].map((item) => (
                  <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{item}</span></li>
                ))}
              </ul>
              <div className="mt-auto border-t border-border pt-5 sm:pt-6">
                <Button asChild size="lg" className="w-full font-heading uppercase tracking-widest">
                  <Link to="/servicos">Iniciar agora <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                <p className="mt-3 text-center font-heading text-xs uppercase tracking-widest text-muted-foreground">Atendimento por critério · Discrição total</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 2 · DOR */}
      <section id="dor" className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">Diagnóstico tático</div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Quatro cenários. <span className="text-tactical-gradient">Você já está em pelo menos um.</span></h2>
          </div>
          <div className="relative mb-8 overflow-hidden rounded-sm border border-border sm:mb-12">
            <img src={homeDor} alt="Silhueta de homem em sala escura às 3 da manhã empunhando pistola Glock em posição de defesa domiciliar" loading="lazy" width={1920} height={1080} className="aspect-[16/9] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
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
                <p className="mt-2 text-sm text-muted-foreground sm:text-base">Treinamento e armamento não são luxo de paranoico. São a diferença entre enterrar e ser enterrado.</p>
              </div>
              <Button asChild size="lg" className="w-full font-heading uppercase tracking-widest sm:w-auto">
                <Link to="/servicos">Quero o programa <ArrowRight className="ml-2 size-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · MANCHETES */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-8 max-w-3xl sm:mb-12">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
              <Newspaper className="size-3.5" />Manchetes desta semana
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Enquanto você lê isto, <span className="text-tactical-gradient">outra família está sendo destruída</span>.</h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">Não é manchete distante. É o seu CEP. É o caminho da escola. É o portão da sua casa às 22h47 de uma terça qualquer.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {newsHeadlines.map((n) => (
              <article key={n.title} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                <div className="flex items-center gap-2 font-heading text-xs uppercase tracking-[0.18em] text-primary">
                  <span className="block size-1.5 rounded-full bg-primary" />{n.tag}
                </div>
                <h3 className="font-heading text-base font-bold uppercase leading-snug sm:text-lg">{n.title}</h3>
                <p className="text-sm text-muted-foreground">{n.meta}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground sm:mt-10 sm:text-sm">Você vai esperar virar manchete pra agir?</p>
        </div>
      </section>

      {/* 4 · COLAPSO */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
                <Zap className="size-3.5" />Cenário Crítico · Colapso Institucional
              </div>
              <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Quando <span className="text-tactical-gradient">a ordem ruir</span>, quem te salva?</h2>
              <p className="text-base text-muted-foreground sm:text-lg">Apagão de semanas. Saque coletivo. Polícia em greve. Banco fechado. Supermercado vazio. Não é teoria — é o que aconteceu na <strong className="text-foreground">Argentina em 2001</strong>, na <strong className="text-foreground">Venezuela em 2017</strong>, no <strong className="text-foreground">Chile em 2019</strong>, nos <strong className="text-foreground">EUA em 2020</strong>.</p>
              <p className="text-base text-muted-foreground sm:text-lg">Quando o sistema cai, sobra <strong className="text-foreground">você, sua casa e quem bate na porta</strong>. Quem está armado defende. Quem está desarmado entrega.</p>
              <Button asChild size="lg" className="w-fit font-heading uppercase tracking-[0.1em]">
                <Link to="/servicos">Estar pronto antes <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {[
                  { v: '14 dias', l: 'Argentina · Saques 2001' },
                  { v: '4 meses', l: 'Venezuela · Apagão 2019' },
                  { v: '30 dias', l: 'Chile · Estado de exceção' },
                  { v: '5 noites', l: 'EUA · Saques BLM 2020' },
                ].map((s) => (
                  <div key={s.l} className="rounded-sm border border-border bg-card p-5 sm:p-6">
                    <div className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{s.v}</div>
                    <div className="mt-2 font-heading text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 · PILARES */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">A tríade não-negociável</div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Existe um caminho. <span className="text-tactical-gradient">Três pilares</span>. Falta um, falham todos.</h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">Não vendemos curso solto. Não vendemos só documento. Não somos loja. Somos a estrutura completa que te leva do civil despreparado ao operador armado, legalizado e treinado.</p>
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
          <div className="mt-10 rounded-sm border border-accent/30 bg-accent/5 p-6 sm:mt-12 sm:p-8">
            <p className="font-heading text-base uppercase leading-snug tracking-tight sm:text-xl">Não adianta ter <span className="text-tactical-gradient">Ferrari</span> e não saber dirigir. Não adianta ter <span className="text-tactical-gradient">.45</span> e não saber sacar.</p>
          </div>
        </div>
      </section>

      {/* 6 · LEI */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
              <Gavel className="size-3.5" />A lei está do seu lado · Pare de duvidar
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">"Mas é <span className="text-tactical-gradient">legal</span> ter arma em casa?" — <span className="text-tactical-gradient">Sim. E está na lei.</span></h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">Você não precisa ser policial. Não precisa ser militar. Quatro normas dão a você, cidadão comum, o direito de comprar, registrar e manter arma de fogo em casa pra defesa pessoal:</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {[
              { code: 'Lei 10.826/03', name: 'Estatuto do Desarmamento', desc: 'O artigo 4º te dá o direito à posse: arma em casa pra defender você e sua família. Você só precisa cumprir os requisitos — e nós te conduzimos por todos eles.' },
              { code: 'Decreto 11.615/23', name: 'Regulamento Atual', desc: 'Regulamenta o Estatuto. No art. 19, § 2º, autoriza o cidadão a adquirir até 2 armas de fogo para defesa pessoal e 50 munições por arma/ano. Sem ele você anda no escuro — com ele você anda armado e legal.' },
              { code: 'IN DG/PF 201', name: 'Posse e Aquisição', desc: 'Detalha o passo a passo na Polícia Federal: documentos, exame psicológico, teste de tiro, certidões. É o caminho oficial — e a gente percorre junto com você.' },
              { code: 'IN DG/PF 311', name: 'CAC e Atualizações', desc: 'Regula o registro de Caçador, Atirador e Colecionador, prazos de renovação e transporte. O atalho legal pra ter mais armas e calibres maiores.' },
            ].map((l) => (
              <article key={l.code} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-6 transition-colors hover:border-accent/50 sm:p-7">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-accent transition-all duration-500 group-hover:w-full" />
                <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">{l.name}</div>
                <div className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{l.code}</div>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{l.desc}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 rounded-sm border border-primary/40 bg-primary/5 p-6 sm:mt-12 sm:p-8">
            <div className="mb-4 font-heading text-xs uppercase tracking-[0.2em] text-primary">O que a lei diz sobre calibre · Decreto 11.615/23, art. 11 e 12</div>
            <h3 className="font-heading text-xl font-bold uppercase leading-tight sm:text-2xl">Uso permitido x uso restrito — definido por <span className="text-tactical-gradient">energia, não por fama</span>.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">O <strong className="text-foreground">art. 11</strong> classifica como <strong className="text-foreground">uso permitido</strong> as armas de porte cuja munição comum tenha até <strong className="text-foreground">407 J (300 libras-pé)</strong> na saída do cano de prova, e armas longas de alma raiada de repetição até <strong className="text-foreground">1.620 J (1.200 libras-pé)</strong>, além de espingardas calibre 12 ou inferior, de repetição. Acima disso, art. 12 → <strong className="text-foreground">uso restrito</strong>.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-sm border border-border bg-card p-4">
                <div className="font-heading text-sm uppercase tracking-[0.18em] text-accent">Uso permitido · Posse</div>
                <p className="mt-2 text-sm font-bold uppercase">.22 LR · .32 · .380 ACP · .38 SPL · .38 TPC · Calibre 12</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Calibres dentro do limite de 407 J (curtas) e 1.620 J (longas raiadas). <strong className="text-foreground">É o que cabe na Posse pra defesa em casa.</strong></p>
              </div>
              <div className="rounded-sm border border-border bg-card p-4">
                <div className="font-heading text-sm uppercase tracking-[0.18em] text-accent">Uso restrito · CAC</div>
                <p className="mt-2 text-sm font-bold uppercase">9mm Luger · .40 S&W · .357 Magnum · .45 ACP · .44 Mag · 5.56 · 7.62 · .308</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Acima de 407 J (curtas) → uso restrito. <strong className="text-foreground">Acessíveis exclusivamente pelo registro CAC</strong> (IN DG/PF 311).</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">Tradução prática: você quer pistola pra defesa em casa hoje? Posse + .380. Quer 9mm, .40 ou mais? Te conduzimos pelo CAC. <strong className="text-foreground">Os dois caminhos são legais — e nós dominamos os dois.</strong></p>
          </div>
          <div className="mt-10 rounded-sm border border-border bg-card p-6 sm:mt-12 sm:p-8">
            <div className="mb-5 font-heading text-xs uppercase tracking-[0.2em] text-accent">Você está pensando isso agora — a gente responde:</div>
            <ul className="flex flex-col gap-5 sm:gap-6">
              {[
                { q: '"E se eu for preso por ter arma?"', a: 'Não vai. Posse é direito previsto na Lei 10.826/03. Crime é não ter registro. A gente legaliza tudo na PF antes da arma sair da loja.' },
                { q: '"E se eu nunca atirei na vida?"', a: 'Melhor ainda. Você aprende do zero, do jeito certo, sem vícios. O curso é parte do programa.' },
                { q: '"Não é caro demais?"', a: 'Caro é enterrar quem você ama. O programa cabe no bolso de quem entende que segurança da família não é luxo.' },
                { q: '"E se mudar o governo e proibirem?"', a: 'Quem registrou antes está protegido por direito adquirido. Hoje a janela está aberta. Amanhã ninguém garante.' },
              ].map((item) => (
                <li key={item.q} className="flex flex-col gap-2 border-l-2 border-primary/60 pl-4 sm:pl-5">
                  <p className="font-heading text-base font-bold uppercase leading-snug tracking-tight sm:text-lg">{item.q}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{item.a}</p>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-heading text-sm uppercase tracking-[0.14em] text-foreground sm:text-base">A lei te dá o direito. Nós entregamos a arma.</p>
              <Button asChild size="lg" className="font-heading uppercase tracking-[0.1em]">
                <Link to="/servicos">Quero minha arma legalizada <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 7 · ARSENAL */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
              <Swords className="size-3.5" />Arsenal · Calibre restrito
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Poder de parada de <span className="text-tactical-gradient">verdade</span>. Não de catálogo de revista.</h2>
          </div>
          <div className="relative mb-10 overflow-hidden rounded-sm border border-border sm:mb-14">
            <img src={homeArsenal} alt="Arsenal tático: pistolas, revólver .357 Magnum e espingarda calibre 12 sobre superfície escura" loading="lazy" width={1920} height={1080} className="aspect-[16/9] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {arsenal.map((a) => (
              <article key={a.cal} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:border-accent/50 sm:p-6">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-accent transition-all duration-500 group-hover:w-full" />
                <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">{a.tag}</div>
                <div className="font-heading text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">{a.cal}</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Toda aquisição é conduzida dentro da legislação vigente, com registro e nota fiscal.</p>
        </div>
      </section>

      {/* 8 · COLETE */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
                <Shield className="size-3.5" />Colete Balístico · Nível IIIA / III
              </div>
              <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Arma sem colete é <span className="text-tactical-gradient">meia defesa</span>. O bandido também atira.</h2>
              <p className="text-base text-muted-foreground sm:text-lg">Você se preparou pra atirar. E pra <strong className="text-foreground">levar tiro</strong>? Em uma invasão, troca de tiros não é cinema. O primeiro projétil que pega você no peito encerra a defesa da sua família.</p>
              <p className="text-base text-muted-foreground sm:text-lg">Vendemos colete balístico <strong className="text-foreground">Nível IIIA</strong> (todos os calibres de pistola até .44 Magnum) e <strong className="text-foreground">Nível III</strong> com placa rígida (fuzis 7.62 e .308). Conduzimos a autorização do Exército quando exigida.</p>
              <Button asChild size="lg" className="w-fit font-heading uppercase tracking-[0.1em]">
                <Link to="/servicos">Quero meu colete <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative mb-5 overflow-hidden rounded-sm border border-border">
                <img src={homeColete} alt="Colete balístico tático preto NIJ Nível IIIA com placa rígida e webbing MOLLE" loading="lazy" width={1920} height={1080} className="aspect-[16/9] w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {[
                  { lvl: 'NIJ IIIA', stops: 'Pistola .22 → .44 Mag · 9mm · .40 · .357' },
                  { lvl: 'NIJ III', stops: 'Fuzil 7.62×51 (.308 Win) FMJ' },
                  { lvl: 'NIJ III+', stops: '7.62×39 (AK) · 5.56 M193' },
                  { lvl: 'NIJ IV', stops: '.30-06 perfurante · placa stand-alone' },
                ].map((p) => (
                  <div key={p.lvl} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:border-accent/50 sm:p-6">
                    <div className="absolute left-0 top-0 h-[2px] w-0 bg-accent transition-all duration-500 group-hover:w-full" />
                    <div className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{p.lvl}</div>
                    <div className="mt-2 text-xs text-muted-foreground sm:text-sm">{p.stops}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Padrão NIJ 0101.06 / 0101.07</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9 · MUNIÇÃO */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
              <PackageX className="size-3.5" />Munição errada · O tiro que mata quem você ama
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Você atirou no bandido. <span className="text-tactical-gradient">O projétil saiu pelas costas dele e matou seu filho no quarto.</span></h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">Não é hipótese. É física básica. <strong className="text-foreground">FMJ (ponta sólida)</strong> atravessa drywall, porta de madeira, parede de tijolo furado. Arma defensiva exige <strong className="text-foreground">munição defensiva</strong>.</p>
          </div>
          <div className="relative mb-10 overflow-hidden rounded-sm border border-border sm:mb-14">
            <img src={homeMunicao} alt="Munições defensivas em latão: cartuchos 9mm, .40 S&W, .45 ACP e .357 Magnum com projéteis FMJ e JHP" loading="lazy" width={1920} height={1080} className="aspect-[16/9] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            {[
              { tag: 'FMJ · Ponta sólida', title: 'Para treino. Nunca pra defesa em casa.', desc: 'Sobrepenetra alvo, parede e ainda mata quem está atrás.' },
              { tag: 'JHP / Expansiva', title: 'Defensiva. Para no alvo.', desc: 'Expande no impacto, transfere energia, reduz a sobrepenetração.' },
              { tag: '+P / Heavy', title: 'Mais energia, mais recuo.', desc: 'Aumenta poder de parada — exige treino e arma homologada.' },
            ].map((m) => (
              <article key={m.tag} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/50 sm:p-6">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">{m.tag}</div>
                <h3 className="font-heading text-lg font-bold uppercase leading-tight sm:text-xl">{m.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{m.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 9.5 · CAC + RECARGA */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
              <Factory className="size-3.5" />Soberania logística · CAC operacional
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Quando o sistema cair, <span className="text-tactical-gradient">a munição some das prateleiras em 48 horas</span>. Você fabrica a sua — ou reza.</h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">O registro <strong className="text-foreground">CAC</strong> te dá o direito legal de <strong className="text-foreground">comprar prensa de recarga, pólvora, projétil, espoleta e estojo</strong> — e produzir sua própria munição em casa.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
            {[
              { icon: Wrench, tag: 'Prensa de recarga', title: 'A máquina que te liberta da loja.', desc: 'Single-stage pra começar, progressiva pra produzir 400 tiros/hora.' },
              { icon: Boxes, tag: 'Insumos estratégicos', title: 'Pólvora · Espoleta · Projétil · Estojo.', desc: 'Estoque legal de componentes pelo CAC. Estojo recarregável até 7x.' },
              { icon: Target, tag: 'Calibre customizado', title: 'A munição que o mercado não vende.', desc: 'Carga reduzida pra treino. Munição de precisão pra estande.' },
              { icon: Factory, tag: 'Autonomia em colapso', title: 'Continua operacional quando todo mundo para.', desc: 'Embargo? Decreto cortou? Sua bancada continua girando.' },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <article key={m.tag} className="group relative flex flex-col gap-4 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/50 sm:p-6">
                  <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-tactical opacity-60" />
                  <Icon className="size-8 text-primary" />
                  <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">{m.tag}</div>
                  <h3 className="font-heading text-base font-bold uppercase leading-tight sm:text-lg">{m.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{m.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9.6 · FAMÍLIA / CÔNJUGE */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
                <Heart className="size-3.5" />Sua mulher tem medo · A gente entende
              </div>
              <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Sua esposa diz <span className="text-tactical-gradient">"não quero arma em casa"</span>. A gente te ensina a conduzir essa conversa — sem brigar.</h2>
              <p className="text-base text-muted-foreground sm:text-lg">Discutir com a sua mulher sobre arma é o caminho mais rápido pra ela travar de vez. <strong className="text-foreground">A decisão não se vence no grito — se vence no enquadramento.</strong> O medo dela não é da arma. É de criança mexendo, de acidente, de você indo preso.</p>
              <Button asChild size="lg" className="w-fit font-heading uppercase tracking-[0.1em]">
                <Link to="/servicos">Conversa em família guiada <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <div className="grid gap-3 sm:gap-4">
                {[
                  { q: '"E se as crianças acharem?"', a: 'Cofre biométrico fixado na parede. Abre só com a sua digital.' },
                  { q: '"E se você atirar em alguém de casa por engano?"', a: 'Treino de identificação positiva do alvo + munição expansiva que para na primeira parede.' },
                  { q: '"E se a PM vier e te prender?"', a: 'Posse 100% legal + protocolo pós-disparo + criminalista de confiança.' },
                ].map((item) => (
                  <div key={item.q} className="rounded-sm border border-border bg-card p-5 sm:p-6">
                    <p className="font-heading text-sm font-bold uppercase leading-snug tracking-tight sm:text-base">{item.q}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9.8 · PROTOCOLO PÓS-DISPARO */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
              <Phone className="size-3.5" />Protocolo pós-disparo · O minuto que decide o resto da sua vida
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Você atirou em legítima defesa. <span className="text-tactical-gradient">Agora começa o jogo de verdade.</span></h2>
          </div>
          <div className="grid gap-4 sm:gap-5">
            {[
              { n: 'T+0', title: 'Tiro disparado.', desc: 'Mantenha a arma apontada até confirmar a cessação da ameaça. Cena preservada = inquérito limpo.' },
              { n: 'T+30s', title: 'Ligar 190 · Falar 3 frases.', desc: '"Sou vítima de invasão. Atirei em legítima defesa. Estou aguardando a polícia desarmado."' },
              { n: 'T+2min', title: 'Ligar pro seu criminalista.', desc: 'Antes da PM chegar. Você tem direito constitucional ao silêncio até a presença dele.' },
              { n: 'T+10min', title: 'PM chega · Entregar a arma.', desc: 'Mãos visíveis, arma no chão. "Aguardo meu advogado pra prestar depoimento."' },
              { n: 'T+1h', title: 'Delegacia · Depoimento com criminalista presente.', desc: 'Versão única, técnica, cronológica. Sem adjetivo. Fato + fato + fato.' },
              { n: 'T+24h', title: 'Mídia, redes sociais, vizinho.', desc: 'Silêncio total. Tudo que sair da sua boca em 30 dias vira peça de acusação.' },
            ].map((m) => (
              <article key={m.n} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/50 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                <div className="flex shrink-0 items-center gap-3 sm:w-32 sm:flex-col sm:items-start">
                  <span className="font-heading text-2xl font-bold tabular-nums tracking-tight text-primary sm:text-3xl">{m.n}</span>
                  <span className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Tempo</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-base font-bold uppercase leading-tight sm:text-lg">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">{m.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 9.9 · MULHER ARMADA */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="relative order-2 lg:order-1">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                {[
                  { v: '.380', l: 'Pistola compacta · Mão menor · Recuo controlável' },
                  { v: '.38 SPL', l: 'Revólver curto · Sem trava · Não falha sob estresse' },
                  { v: '9mm +P', l: 'CAC · Munição defensiva · Volume útil' },
                  { v: '.22 LR', l: 'Treino contínuo · Custo baixo' },
                ].map((s) => (
                  <div key={s.l} className="rounded-sm border border-border bg-card p-5 sm:p-6">
                    <div className="font-heading text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{s.v}</div>
                    <div className="mt-2 font-heading text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 flex flex-col gap-6 lg:order-2">
              <div className="inline-flex w-fit items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
                <UserCheck className="size-3.5" />Mulher armada · Programa específico
              </div>
              <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Ela não precisa do <span className="text-tactical-gradient">marido</span> pra estar segura. Precisa da <span className="text-tactical-gradient">arma certa pra mão dela</span>.</h2>
              <p className="text-base text-muted-foreground sm:text-lg">Programa adaptado: <strong className="text-foreground">calibre dimensionado pra força de mão</strong>, coldre pra cintura feminina, saque com roupa de inverno. Instrutora mulher quando solicitado. Discrição absoluta.</p>
              <Button asChild size="lg" className="w-fit font-heading uppercase tracking-[0.1em]">
                <Link to="/servicos">Programa Mulher Armada <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 10 · LOJA */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
              <Store className="size-3.5" />Aquisição segura · Nada de marketplace
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Comprar arma pela internet sozinho é <span className="text-tactical-gradient">jogar R$ 8 mil no lixo</span> — ou pior, na cadeia.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            {[
              { title: 'Golpe do PIX antecipado', desc: 'Loja fake no Instagram, preço 30% abaixo do mercado. Você paga, somem com seu dinheiro.' },
              { title: 'Arma com numeração adulterada', desc: 'Quando o exame técnico da PF detecta, você responde por receptação. Crime inafiançável.' },
              { title: 'Calibre que sua arma não suporta', desc: '+P em pistola homologada pra padrão. Pistola explode na sua mão no primeiro disparo.' },
              { title: 'Coldre, mira e acessório errado', desc: 'Coldre de nylon barato que o gatilho engata sozinho. Tiro acidental na perna.' },
            ].map((g) => (
              <article key={g.title} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:p-6">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-5 text-primary" />
                  <h3 className="font-heading text-base font-bold uppercase leading-snug sm:text-lg">{g.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{g.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 10.5 · GOOGLE REVIEWS */}
      <GoogleReviewsCarousel />

      {/* 11 · JORNADA */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-2xl sm:mb-14">
            <div className="mb-3 font-heading text-xs uppercase tracking-[0.2em] text-accent">A jornada operacional · 6 etapas</div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Do <span className="text-tactical-gradient">civil desarmado</span> ao operador pronto. Em 6 passos.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {journey.map((m) => (
              <article key={m.n} className="group relative flex flex-col gap-4 rounded-sm border border-border bg-card p-6 transition-colors hover:border-accent/50 sm:p-7">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-accent transition-all duration-500 group-hover:w-full" />
                <div className="flex items-baseline justify-between">
                  <span className="font-heading text-3xl font-bold tabular-nums text-primary sm:text-4xl">{m.n}</span>
                  <span className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Etapa</span>
                </div>
                <h3 className="font-heading text-lg font-bold uppercase leading-tight sm:text-xl">{m.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{m.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 11.5 · CURSO OPERADOR DE PISTOLA I */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
              <GraduationCap className="size-3.5" />Curso Operador de Pistola I · Quero Armas
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">Pare de ser <span className="text-tactical-gradient">observador armado</span>. Vire <span className="text-tactical-gradient">operador de pistola</span>.</h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg"><strong className="text-foreground">120 disparos reais</strong>, instrutor credenciado <strong className="text-foreground">CTT-CBC (XXVIII turma)</strong>, turma de no máximo <strong className="text-foreground">5 alunos</strong>.</p>
          </div>
          <div className="relative mb-10 overflow-hidden rounded-sm border border-border sm:mb-14">
            <img src={homeCursoOperador} alt="Operador de pistola treinando em estande de tiro coberto, com pistola Glock e proteção auricular, mira em alvo de silhueta" loading="lazy" width={1920} height={1080} className="aspect-[16/9] w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div className="flex flex-col gap-6">
              <div className="font-heading text-xs uppercase tracking-[0.2em] text-accent">O que você vai dominar no curso</div>
              <div className="grid gap-4">
                {[
                  { icon: BookOpen, tag: 'História das armas de fogo', desc: 'Origem das pistolas e os dois mundos: hammers x strikers.' },
                  { icon: ShieldAlert, tag: 'Regras essenciais de segurança', desc: 'As 4 regras fundamentais de manuseio + transporte e armazenamento.' },
                  { icon: Wrench, tag: 'Funcionamento completo de pistolas', desc: 'Carregar, descarregar, resolver pane, falha de ejeção, dupla alimentação.' },
                  { icon: Crosshair, tag: 'Técnicas avançadas de tiro', desc: 'Empunhadura, controle de cano e gatilho, alinhamento de mira.' },
                  { icon: Target, tag: 'Treinamento real em estande', desc: 'Disparos sob supervisão profissional. Tiros precisos e domínio do recuo.' },
                  { icon: Wrench, tag: 'Manutenção e limpeza · 1º escalão', desc: 'Desmontagem, limpeza e lubrificação correta.' },
                  { icon: PackageX, tag: 'Tipos de munição · Defesa pessoal', desc: 'Penetrante x expansiva: o que usar em cada ambiente.' },
                  { icon: Swords, tag: 'Como escolher a sua pistola', desc: 'Hammer x striker e o impacto dos mecanismos de segurança.' },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <article key={m.tag} className="group relative flex gap-4 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/50">
                      <div className="absolute left-0 top-0 h-[2px] w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                      <Icon className="mt-1 size-6 shrink-0 text-primary" />
                      <div>
                        <div className="font-heading text-sm font-bold uppercase leading-tight tracking-tight sm:text-base">{m.tag}</div>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{m.desc}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="relative lg:sticky lg:top-24">
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/10 blur-3xl" />
              <article className="relative flex flex-col gap-6 rounded-sm border border-primary/40 bg-card p-6 shadow-deep sm:p-8">
                <div className="absolute left-0 top-0 h-[3px] w-full bg-gradient-tactical" />
                <div className="font-heading text-xs uppercase tracking-[0.2em] text-primary">Investimento · Operador de Pistola I</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-sm border border-border bg-background/40 p-5">
                    <div className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Turma</div>
                    <div className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">R$ 1.890</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Em até 18x no cartão*</div>
                  </div>
                  <div className="rounded-sm border border-accent/40 bg-accent/10 p-5">
                    <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">VIP</div>
                    <div className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">R$ 2.490</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Em até 18x no cartão*</div>
                  </div>
                </div>
                <div className="rounded-sm border border-border bg-background/40 p-5">
                  <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">Tudo incluso</div>
                  <ul className="mt-3 grid gap-2 text-sm">
                    <li className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-primary" /><span>6 a 8 horas com instrutor <strong className="text-foreground">CTT-CBC (XXVIII turma)</strong></span></li>
                    <li className="flex items-start gap-2"><Target className="mt-0.5 size-4 shrink-0 text-primary" /><span>120 disparos · 1 técnica nova a cada 20 tiros</span></li>
                    <li className="flex items-start gap-2"><PackageX className="mt-0.5 size-4 shrink-0 text-primary" /><span>Munição, alvos, óculos e abafadores inclusos</span></li>
                    <li className="flex items-start gap-2"><Coffee className="mt-0.5 size-4 shrink-0 text-primary" /><span>Café da manhã + almoço inclusos</span></li>
                    <li className="flex items-start gap-2"><Award className="mt-0.5 size-4 shrink-0 text-primary" /><span>Certificado de Conclusão</span></li>
                    <li className="flex items-start gap-2"><Users className="mt-0.5 size-4 shrink-0 text-primary" /><span>Turma máx. 5 alunos · acompanhamento individual</span></li>
                  </ul>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-sm border border-border bg-background/40 p-4 text-xs">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <div className="font-heading uppercase tracking-[0.14em] text-muted-foreground">Local</div>
                      <div className="mt-1 font-medium text-foreground">Jacareí ou SJC · a definir</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-sm border border-border bg-background/40 p-4 text-xs">
                    <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <div className="font-heading uppercase tracking-[0.14em] text-muted-foreground">Quando</div>
                      <div className="mt-1 font-medium text-foreground">Sábados · 7h às 19h</div>
                    </div>
                  </div>
                </div>
                <Button asChild size="lg" className="w-full font-heading uppercase tracking-[0.1em]">
                  <a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer">Reservar minha vaga agora <ArrowRight className="ml-2 size-5" /></a>
                </Button>
                <p className="text-center font-heading text-xs uppercase tracking-[0.14em] text-muted-foreground">Vagas limitadas · Máx. 5 alunos por turma<br />*acréscimo da maquininha de cartão</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* 11.6 · LEGISLAÇÃO COMPLETA */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-background py-14 sm:py-20">
        <div className={containerCls}>
          <div className="mb-10 max-w-3xl sm:mb-14">
            <div className="mb-3 inline-flex items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-accent">
              <Scale className="size-3.5" />Base normativa · O que rege cada decisão sua
            </div>
            <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">A lei não é opinião. É <span className="text-tactical-gradient">o que separa o cidadão armado do bandido</span>.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
            {[
              { code: 'Lei 10.826/2003', name: 'Estatuto do Desarmamento', desc: 'Marco civil do armamento. Define posse (art. 4º), porte (art. 10), crimes e o Sinarm.' },
              { code: 'Decreto 11.615/2023', name: 'Regulamento atual em vigor', desc: 'Define art. 11 e 12 (uso permitido x restrito), art. 19 (limites de aquisição) e art. 36 (guarda doméstica).' },
              { code: 'IN DG/PF 201/2024', name: 'Posse · Aquisição · Sinarm', desc: 'Detalha o procedimento operacional na PF: documentos, exame psicológico, teste técnico, vistoria, CRAF.' },
              { code: 'IN DG/PF 311/2024', name: 'CAC · Caçador · Atirador · Colecionador', desc: 'Regula o registro CAC junto ao Exército. Define níveis, calibres, GT, prazos e habitualidade.' },
            ].map((l) => (
              <article key={l.code} className="group relative flex flex-col gap-3 rounded-sm border border-border bg-card p-6 transition-colors hover:border-accent/50 sm:p-7">
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-accent transition-all duration-500 group-hover:w-full" />
                <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">{l.name}</div>
                <div className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{l.code}</div>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{l.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 11.7 · PORTAL DO CLIENTE */}
      <section className="relative w-full max-w-full overflow-x-clip border-b border-border/60 bg-surface-overlay/40 py-14 sm:py-20">
        <div className={containerCls}>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 font-heading text-xs uppercase tracking-[0.2em] text-primary">
                <Lock className="size-3.5" />Portal do Cliente · Acesso exclusivo
              </div>
              <h2 className="font-heading text-2xl font-bold uppercase leading-tight tracking-tight sm:text-4xl lg:text-5xl">O <span className="text-tactical-gradient">CRAF venceu</span> e você só descobriu na blitz. <span className="text-tactical-gradient">Aqui isso nunca mais acontece.</span></h2>
              <p className="text-base text-muted-foreground sm:text-lg">Cliente da Quero Armas <strong className="text-foreground">ganha acesso ao Portal do Cliente</strong> — central blindada com seu arsenal, vencimentos e legislação atualizada na palma da mão.</p>
              <Button asChild size="lg" className="w-fit font-heading uppercase tracking-[0.1em]">
                <Link to={PORTAL_PATH}>Acessar meu Portal <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
              <p className="font-heading text-xs uppercase tracking-[0.18em] text-muted-foreground">Acesso liberado a cada cliente do programa · Sigilo absoluto</p>
            </div>
            <div className="relative">
              <div className="grid gap-4 sm:gap-5">
                {[
                  { icon: Boxes, tag: 'Acervo e arsenal', title: 'Toda arma sua, em um painel.', desc: 'Cada arma com calibre, número de série, lote, marca e nota fiscal digitalizada.' },
                  { icon: Clock, tag: 'Controle de vencimentos', title: 'Alerta antes da PF te alertar.', desc: 'CR, CRAF, GT, exame psicológico, teste de tiro, habitualidade CAC. Avisos 90/60/30 dias antes.' },
                  { icon: Scale, tag: 'Legislação atualizada', title: 'A lei sempre na versão vigente.', desc: 'Lei 10.826/03, Decreto 11.615/23, IN PF 201, IN PF 311 sempre atualizadas.' },
                  { icon: KeyRound, tag: 'Documentos e contratos', title: 'Cofre digital de tudo que importa.', desc: 'Laudos, exames, certificados, contratos, comprovantes da PF e Exército.' },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <article key={m.tag} className="group relative flex gap-4 rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/50 sm:p-6">
                      <div className="absolute left-0 top-0 h-[2px] w-0 bg-primary transition-all duration-500 group-hover:w-full" />
                      <Icon className="mt-1 size-7 shrink-0 text-primary" />
                      <div>
                        <div className="font-heading text-xs uppercase tracking-[0.18em] text-accent">{m.tag}</div>
                        <h3 className="mt-1 font-heading text-base font-bold uppercase leading-tight sm:text-lg">{m.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{m.desc}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 12 · CTA FINAL */}
      <section className="relative w-full max-w-full overflow-x-clip py-16 sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.18),transparent_70%)]" />
        <div className={containerCls}>
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center sm:gap-8">
            <Crosshair className="size-12 text-primary sm:size-14" />
            <div className="inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-primary/10 px-3 py-1.5">
              <Flame className="size-3.5 text-primary" />
              <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-primary">Decisão final · Agora</span>
            </div>
            <h2 className="font-heading text-3xl font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">Você tem duas opções: <span className="text-tactical-gradient">torcer</span> ou <span className="text-tactical-gradient">se armar</span>.</h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">Quem torce vira número no jornal. Quem se prepara — com arma, lei e treino — volta pra casa.</p>
            <div className="grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
              {['Documentação PF/Exército blindada', 'Arma + colete + munição certa', 'Curso operacional + protocolo pós-disparo'].map((item) => (
                <div key={item} className="flex items-start gap-2.5 rounded-sm border border-border bg-card/60 p-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
            <p className="max-w-2xl font-heading text-base uppercase leading-snug tracking-tight text-foreground sm:text-lg">A janela legal está aberta hoje. <span className="text-tactical-gradient">Amanhã ninguém garante.</span></p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <Button asChild size="lg" className="w-full font-heading uppercase tracking-[0.1em] sm:w-auto">
                <Link to="/servicos">Iniciar meu programa agora <ArrowRight className="ml-2 size-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full font-heading uppercase tracking-[0.1em] sm:w-auto">
                <a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer">Falar com um especialista</a>
              </Button>
            </div>
            <p className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Atendimento por critério · Sigilo absoluto · Conformidade total com a legislação</p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
};

export default HomePage;
