import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SiteShell } from "@/shared/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { getServiceBySlug, type ServiceWithCategory } from "@/shared/data/catalog";
import {
  getServiceLegalDetails,
  type ServiceLegalDetails,
} from "@/lib/quero-armas/serviceLegalDetails";
import { formatBRL } from "@/shared/lib/formatters";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  ListChecks,
  Scale,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const publicSectionCls =
  "relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-hidden";
const publicInnerCls = "w-full px-4 sm:px-6 lg:px-10 2xl:px-16";

type LoadState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ok"; service: ServiceWithCategory; details: ServiceLegalDetails };

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Building2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-border bg-surface-elevated/40 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-accent/40 bg-accent/10 text-accent">
          <Icon className="size-4" />
        </span>
        <h2 className="font-heading text-sm font-bold uppercase tracking-[0.18em]">
          {title}
        </h2>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ServicoDetalhePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    getServiceBySlug(slug)
      .then((res) => {
        if (!active) return;
        if (!res) {
          setState({ status: "not_found" });
          return;
        }
        const details = getServiceLegalDetails(slug, {
          nome: res.service.name,
          categoria: res.service.category?.name ?? null,
        });
        setState({ status: "ok", service: res.service, details });
      })
      .catch((e) =>
        active ? setState({ status: "error", message: e?.message ?? "Erro ao carregar serviço." }) : null,
      );
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (state.status === "ok") {
      document.title = `${state.details.titulo} | Quero Armas`;
    } else if (state.status === "not_found") {
      document.title = "Serviço não encontrado | Quero Armas";
    }
  }, [state]);

  if (state.status === "loading") {
    return (
      <SiteShell>
        <section className={`${publicSectionCls} min-h-[60vh]`}>
          <div className={`${publicInnerCls} flex min-h-[60vh] items-center justify-center py-20`}>
            <Loader2 className="size-6 animate-spin text-accent" />
          </div>
        </section>
      </SiteShell>
    );
  }

  if (state.status === "not_found" || state.status === "error") {
    const isError = state.status === "error";
    return (
      <SiteShell>
        <section className={`${publicSectionCls} border-b border-border`}>
          <div className={`${publicInnerCls} flex min-h-[60vh] flex-col items-start justify-center py-20`}>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
              {isError ? "Erro" : "Serviço não encontrado"}
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              {isError ? "Não foi possível carregar o serviço." : "Este serviço não existe ou está inativo."}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {isError
                ? state.message
                : "O link pode estar desatualizado. Volte ao catálogo para escolher um serviço disponível."}
            </p>
            <Button asChild className="mt-6 font-heading uppercase tracking-wide">
              <Link to="/servicos">
                <ArrowLeft className="mr-2 size-4" /> Voltar ao catálogo
              </Link>
            </Button>
          </div>
        </section>
      </SiteShell>
    );
  }

  const { service, details } = state;
  const preco = service.base_price_cents > 0 ? formatBRL(service.base_price_cents) : "Sob consulta";

  return (
    <SiteShell>
      {/* HERO */}
      <section className={`${publicSectionCls} border-b border-border bg-background`}>
        <div className={`${publicInnerCls} py-12 sm:py-16`}>
          <button
            type="button"
            onClick={() => navigate("/servicos")}
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Voltar ao catálogo
          </button>
          <p className="font-heading text-[11px] font-bold uppercase tracking-[0.32em] text-accent">
            {details.orgaoLabel}
          </p>
          <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight text-foreground sm:text-5xl">
            {details.titulo}
          </h1>
          {service.short_description ? (
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
              {service.short_description}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="font-heading uppercase tracking-wide"
            >
              <Link to={`/cadastro?servico=${encodeURIComponent(service.slug)}`}>
                Iniciar cadastro <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="font-heading uppercase tracking-wide"
            >
              <Link to="/servicos">Ver outros serviços</Link>
            </Button>
            <div className="sm:ml-auto">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                A partir de
              </p>
              <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {preco}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DETALHES */}
      <section className={`${publicSectionCls} border-b border-border`}>
        <div className={`${publicInnerCls} py-12 sm:py-16`}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Block icon={Building2} title="Órgão competente">
              <p>{details.orgaoLabel}</p>
            </Block>
            <Block icon={FileText} title="Natureza do serviço">
              <p>{details.natureza}</p>
            </Block>
            <Block icon={Scale} title="Fundamento legal/regulatório">
              <List items={details.fundamento} />
            </Block>
            <Block icon={ListChecks} title="Requisitos principais">
              <List items={details.requisitos} />
            </Block>
            <Block icon={FileText} title="Documentos normalmente exigidos">
              <List items={details.documentos} />
            </Block>
            <Block icon={ListChecks} title="Etapas do atendimento">
              <ol className="space-y-2">
                {details.etapas.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-heading text-xs font-bold text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{e}</span>
                  </li>
                ))}
              </ol>
            </Block>
            <Block icon={Clock} title="Prazo estimado">
              <p>{details.prazoEstimado}</p>
            </Block>
            <Block icon={AlertTriangle} title="Observações importantes">
              <List items={details.observacoes} />
            </Block>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`${publicSectionCls} border-b border-border bg-gradient-to-br from-accent/15 via-background to-background`}>
        <div className={`${publicInnerCls} flex flex-col items-start gap-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16`}>
          <div className="max-w-xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              Pronto para iniciar o seu processo?
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Comece agora seu cadastro para este serviço com acompanhamento técnico da Quero Armas.
            </p>
          </div>
          <Button asChild size="lg" className="font-heading uppercase tracking-wide">
            <Link to={`/cadastro?servico=${encodeURIComponent(service.slug)}`}>
              Iniciar cadastro <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}