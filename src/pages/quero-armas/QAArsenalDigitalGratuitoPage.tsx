import { Link } from "react-router-dom";
import { SiteShell } from "@/shared/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { SEO } from "@/shared/components/SEO";
import {
  ArrowRight,
  ShieldCheck,
  Crosshair,
  FileText,
  Calendar,
  Lock,
  CheckCircle2,
  FolderArchive,
  Sparkles,
  UserPlus,
  ShoppingBag,
  Phone,
} from "lucide-react";

const FAQ = [
  {
    q: "Preciso contratar algum serviço para usar o Arsenal Digital?",
    a: "Não. A conta é 100% gratuita e serve apenas para você organizar suas armas, documentos e vencimentos. Nenhuma cobrança é gerada ao criar conta ou cadastrar dados.",
  },
  {
    q: "Posso cadastrar arma manualmente?",
    a: "Sim. Você cadastra cada arma com marca, modelo, calibre, número de série, CRAF/SINARM/SIGMA e autorização de compra — tudo direto pelo seu portal.",
  },
  {
    q: "Posso enviar documentos do meu acervo?",
    a: "Sim. Você anexa CR, CRAF, GTE, autorizações de compra e comprovantes. Os arquivos ficam guardados de forma privada na sua conta.",
  },
  {
    q: "A Quero Armas aprova ou valida meus documentos?",
    a: "Apenas se você quiser. A equipe operacional pode revisar e aprovar como cortesia, mas o Arsenal Digital não substitui órgão público nem emite documento oficial.",
  },
  {
    q: "Isso substitui meu cadastro no Exército ou na Polícia Federal?",
    a: "Não. O Arsenal Digital é uma ferramenta privada de organização pessoal. Os registros oficiais continuam sendo SIGMA (Exército) e SINARM (Polícia Federal).",
  },
  {
    q: "Posso contratar um serviço da Quero Armas depois?",
    a: "Sim, quando quiser. A qualquer momento você solicita posse, porte, CRAF, GTE, CR ou apostilamento direto pelo portal — sem precisar criar outra conta.",
  },
];

const ORGANIZA = [
  { icon: Crosshair, label: "Armas do acervo" },
  { icon: FileText, label: "CR — Certificado de Registro" },
  { icon: FileText, label: "CRAF / SIGMA" },
  { icon: FileText, label: "GTE — Guia de Tráfego" },
  { icon: FileText, label: "Autorizações de compra" },
  { icon: FileText, label: "Exames psicológico e técnico" },
  { icon: Calendar, label: "Vencimentos e alertas" },
  { icon: FolderArchive, label: "Documentos do acervo" },
];

const PASSOS = [
  { n: "1", t: "Crie sua conta gratuita", d: "Apenas CPF, nome, e-mail e telefone. Leva menos de 1 minuto." },
  { n: "2", t: "Cadastre suas armas", d: "Você mesmo registra cada arma manualmente, com marca, modelo, calibre e número de série." },
  { n: "3", t: "Anexe seus documentos", d: "CR, CRAF, GTE, autorizações e comprovantes ficam guardados em um só lugar." },
  { n: "4", t: "Receba alertas de vencimento", d: "Acompanhe prazos antes que algo expire e perca a validade." },
];

const ArsenalDigitalGratuito = () => (
  <SiteShell>
    <SEO
      title="Arsenal Digital Gratuito — Organize armas e documentos | Quero Armas"
      description="Conta gratuita para CACs e atiradores organizarem armas, CR, CRAF, GTE, autorizações, exames e vencimentos em um só lugar. Sem compra automática."
      canonical="/arsenal-digital-gratuito"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Arsenal Digital Quero Armas",
        applicationCategory: "BusinessApplication",
        offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        provider: { "@type": "Organization", name: "Quero Armas" },
        description:
          "Aplicativo gratuito para organização privada de armas, documentos e vencimentos do acervo do CAC.",
      }}
    />

    {/* HERO */}
    <section className="relative w-full overflow-hidden border-b border-border bg-background py-20 sm:py-28">
      <div className="container max-w-5xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-3 py-1.5">
          <Sparkles className="size-3.5 text-accent" />
          <span className="font-heading text-xs uppercase tracking-[0.2em] text-accent">
            Conta gratuita · Sem cobrança · Sem compra automática
          </span>
        </div>
        <h1 className="font-heading text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
          Seu <span className="text-accent">Arsenal Digital</span><br />em um só lugar.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Organize <strong className="text-foreground">suas armas</strong>, <strong className="text-foreground">CR, CRAF, GTE, autorizações</strong>, exames e vencimentos do acervo. Você cadastra tudo sozinho — a Quero Armas só entra quando você precisar contratar um serviço.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/area-do-cliente/criar-conta">
              <UserPlus className="mr-2 size-4" /> Criar conta gratuita <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/area-do-cliente/contratar">
              <ShoppingBag className="mr-2 size-4" /> Contratar serviço com a Quero Armas
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Já tenho conta? <Link to="/area-do-cliente/login" className="text-accent hover:underline">Entrar no portal</Link>
        </p>
      </div>
    </section>

    {/* O QUE É */}
    <section className="border-b border-border bg-card/30 py-16 sm:py-20">
      <div className="container max-w-5xl">
        <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
          O que é o Arsenal Digital
        </h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          É um <strong className="text-foreground">aplicativo gratuito</strong> dentro do portal da Quero Armas onde o CAC, atirador, caçador ou colecionador organiza tudo o que envolve seu acervo de armas legalizado. Não substitui SIGMA nem SINARM — é uma ferramenta privada para você não perder prazo, documento ou autorização.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ORGANIZA.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-sm border border-border bg-card p-4">
              <Icon className="size-4 text-accent shrink-0" />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* COMO FUNCIONA */}
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <div className="container max-w-5xl">
        <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">Como funciona</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Quatro passos para ter seu acervo 100% organizado. Você no controle, sem intermediário, sem cobrança.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p) => (
            <div key={p.n} className="rounded-sm border border-border bg-card p-5">
              <div className="font-heading text-3xl font-bold text-accent">{p.n}</div>
              <div className="mt-2 font-heading text-sm font-bold uppercase tracking-wider text-foreground">{p.t}</div>
              <div className="mt-1 text-sm text-muted-foreground leading-relaxed">{p.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* GRATUITO E SEM COMPRA */}
    <section className="border-b border-border bg-card/30 py-16 sm:py-20">
      <div className="container max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-sm border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="inline-flex items-center gap-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-2 py-1">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span className="font-heading text-[10px] uppercase tracking-widest text-emerald-500">Gratuito</span>
            </div>
            <h3 className="mt-3 font-heading text-xl font-bold uppercase">É grátis para sempre</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Criar conta, cadastrar arma, anexar documento e acompanhar vencimento <strong className="text-foreground">não gera cobrança</strong>. Não pedimos cartão de crédito, não cadastramos boleto e não enviamos cobrança automática.
            </p>
          </div>
          <div className="rounded-sm border border-border bg-card p-6">
            <div className="inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1">
              <ShoppingBag className="size-3.5 text-accent" />
              <span className="font-heading text-[10px] uppercase tracking-widest text-accent">Quando você quiser</span>
            </div>
            <h3 className="mt-3 font-heading text-xl font-bold uppercase">Contrate serviço só se precisar</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Quando precisar de <strong className="text-foreground">posse, porte, CRAF, GTE, CR ou apostilamento</strong>, você solicita pelo próprio portal. A Equipe Operacional valida, gera contrato e cobrança — só depois da sua aprovação.
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* SEGURANÇA */}
    <section className="border-b border-border bg-background py-16 sm:py-20">
      <div className="container max-w-4xl">
        <div className="rounded-sm border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10">
              <Lock className="size-5 text-accent" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold uppercase tracking-tight sm:text-2xl">Seus dados, sua privacidade</h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Cada conta enxerga apenas os próprios documentos e armas. As informações ficam visíveis somente para <strong className="text-foreground">você</strong> e para a <strong className="text-foreground">Equipe Operacional da Quero Armas</strong> — sob controle de acesso técnico (RLS) e em conformidade com a <strong className="text-foreground">LGPD</strong>. Nenhum outro cliente, vendedor externo ou terceiro tem acesso ao seu acervo.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 text-accent shrink-0" /> Acesso isolado por cliente</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 text-accent shrink-0" /> Documentos privados em storage seguro</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 text-accent shrink-0" /> Direito ao esquecimento (LGPD)</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 text-accent shrink-0" /> Auditoria interna de acessos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section className="border-b border-border bg-card/30 py-16 sm:py-20">
      <div className="container max-w-4xl">
        <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">Perguntas frequentes</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-sm border border-border bg-card p-5 open:border-accent/40">
              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                <span className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">{item.q}</span>
                <span className="text-accent transition-transform group-open:rotate-90"><ArrowRight className="size-4" /></span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    {/* CTA FINAL */}
    <section className="bg-background py-16 sm:py-20">
      <div className="container max-w-4xl text-center">
        <h2 className="font-heading text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Comece agora — leva menos de 1 minuto.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Sem cartão. Sem cobrança. Sem compromisso. Crie sua conta gratuita e organize hoje mesmo seu Arsenal Digital.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/area-do-cliente/criar-conta">
              <UserPlus className="mr-2 size-4" /> Criar conta gratuita <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/area-do-cliente/contratar">
              <ShoppingBag className="mr-2 size-4" /> Contratar serviço
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <a href="https://wa.me/5511978481919" target="_blank" rel="noopener noreferrer">
              <Phone className="mr-2 size-4" /> Falar no WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </section>
  </SiteShell>
);

export default ArsenalDigitalGratuito;
