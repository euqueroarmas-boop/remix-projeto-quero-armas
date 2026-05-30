import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SiteShell } from "@/shared/components/layout/SiteShell";
import { Button } from "@/components/ui/button";
import { getServiceBySlug, type ServiceWithCategory } from "@/shared/data/catalog";
import { useCart } from "@/shared/cart/CartProvider";
import { useToast } from "@/hooks/use-toast";
import {
  getServiceLegalDetails,
  sistemaLabel,
  type ServiceLegalDetails,
} from "@/lib/quero-armas/serviceLegalDetails";
import { formatBRL } from "@/shared/lib/formatters";
import { ArrowLeft, ArrowRight, Loader2, ShoppingCart } from "lucide-react";

const sectionCls =
  "relative left-1/2 w-dvw max-w-none -translate-x-1/2 overflow-hidden";
const innerCls = "w-full px-4 sm:px-6 lg:px-10 2xl:px-16";
const proseCls = "mx-auto max-w-3xl";

type LoadState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ok"; service: ServiceWithCategory; details: ServiceLegalDetails | null };

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 font-heading text-base font-bold uppercase tracking-[0.22em] text-foreground">
      {children}
    </h2>
  );
}

function Divider() {
  return <hr className="my-6 border-border" />;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="font-heading text-xs font-bold text-accent">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

export default function ServicoDetalhePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const { addItem } = useCart();
  const { toast } = useToast();

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
        setState({
          status: "ok",
          service: res.service,
          details: getServiceLegalDetails(slug),
        });
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
      document.title = `${state.details?.titulo ?? state.service.name} | Quero Armas`;
    } else if (state.status === "not_found") {
      document.title = "Serviço não encontrado | Quero Armas";
    }
  }, [state]);

  if (state.status === "loading") {
    return (
      <SiteShell>
        <section className={`${sectionCls} min-h-[60vh]`}>
          <div className={`${innerCls} flex min-h-[60vh] items-center justify-center py-20`}>
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
        <section className={`${sectionCls} border-b border-border`}>
          <div className={`${innerCls} py-20`}>
            <div className={proseCls}>
              <p className="font-heading text-xs font-bold uppercase tracking-[0.3em] text-accent">
                {isError ? "Erro" : "Serviço não encontrado"}
              </p>
              <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                {isError
                  ? "Não foi possível carregar o serviço."
                  : "Este serviço não existe ou está inativo."}
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                {isError
                  ? state.message
                  : "O link pode estar desatualizado. Volte ao catálogo para escolher um serviço disponível."}
              </p>
              <Button asChild className="mt-8 font-heading uppercase tracking-wide">
                <Link to="/servicos">
                  <ArrowLeft className="mr-2 size-4" /> Voltar ao catálogo
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  const { service, details } = state;
  const preco =
    service.base_price_cents > 0 ? formatBRL(service.base_price_cents) : "Sob consulta";
  const cadastroHref = `/cadastro?servico=${encodeURIComponent(service.slug)}`;

  return (
    <SiteShell>
      {/* HERO EDITORIAL */}
      <section className={`${sectionCls} border-b border-border bg-background`}>
        <div className={`${innerCls} py-12 sm:py-16`}>
          <div className={proseCls}>
            <button
              type="button"
              onClick={() => navigate("/servicos")}
                data-testid="service-detail-back"
              className="mb-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Voltar ao catálogo
            </button>

            <p className="font-heading text-[11px] font-bold uppercase tracking-[0.32em] text-accent">
              {details ? sistemaLabel[details.sistema] : "Catálogo Quero Armas"}
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold uppercase tracking-tight text-foreground sm:text-[2.75rem] sm:leading-tight">
              {details?.titulo ?? service.name}
            </h1>
            {service.short_description ? (
              <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
                {service.short_description}
              </p>
            ) : null}
            {service.base_legal ? (
              <p className="mt-2 text-[12px] italic leading-snug text-muted-foreground/80">
                {service.base_legal}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="font-heading uppercase tracking-wide"
                data-testid="service-detail-contract"
              >
                <Link to={cadastroHref}>
                  Contratar este serviço <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-heading uppercase tracking-wide"
                data-testid="service-detail-add-cart"
                onClick={() => {
                  addItem({
                    service_id: service.id,
                    service_slug: service.slug,
                    service_name: service.name,
                    unit_price_cents: service.base_price_cents,
                    quantity: 1,
                  });
                  toast({
                    title: "Serviço adicionado ao carrinho.",
                    description: service.name,
                  });
                  navigate("/carrinho");
                }}
              >
                <ShoppingCart className="mr-2 size-4" /> Adicionar ao carrinho
              </Button>
              <div className="sm:ml-auto">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  A partir de
                </p>
                <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {preco}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORPO TÉCNICO EDITORIAL */}
      <section className={`${sectionCls} border-b border-border`}>
        <div className={`${innerCls} py-12 sm:py-16`}>
          <article className={proseCls}>
            {details ? (
              <>
                {/* Cabeçalho normativo */}
                <p className="font-heading text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Órgão competente
                </p>
                <p className="mt-2 text-[15px] text-foreground">{details.orgaoCompetente}</p>
                <p className="mt-4 font-heading text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Sistema aplicável
                </p>
                <p className="mt-2 text-[15px] text-foreground">
                  {sistemaLabel[details.sistema]}
                </p>

                <Divider />

                <H2>Base legal e normativa</H2>
                <Bullets items={details.baseLegal} />

                <H2>O que é</H2>
                <Paragraph>{details.oQueE}</Paragraph>

                <H2>Quando se aplica</H2>
                <Paragraph>{details.quandoSeAplica}</Paragraph>

                <H2>Quem pode solicitar</H2>
                <Bullets items={details.quemPodeSolicitar} />

                <H2>Requisitos principais</H2>
                <Bullets items={details.requisitos} />

                <H2>Documentos normalmente exigidos</H2>
                <Bullets items={details.documentos} />

                <H2>Etapas práticas do processo</H2>
                <Steps items={details.etapas} />

                <H2>Pontos de atenção</H2>
                <Bullets items={details.pontosAtencao} />

                <H2>Limites do serviço da Quero Armas</H2>
                <Paragraph>{details.limitesQA}</Paragraph>
              </>
            ) : (
              <>
                <H2>Conteúdo técnico em revisão</H2>
                <Paragraph>
                  O conteúdo técnico-jurídico específico deste serviço está em revisão pela
                  equipe da Quero Armas e será publicado em breve. Para evitar informação
                  imprecisa, optamos por não exibir texto genérico.
                </Paragraph>
                <Paragraph>
                  Você pode iniciar seu cadastro normalmente: o atendimento técnico
                  apresentará todos os requisitos, documentos e etapas aplicáveis ao seu caso
                  concreto.
                </Paragraph>
              </>
            )}

            <Divider />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="font-heading uppercase tracking-wide">
                <Link to={cadastroHref}>
                  Contratar este serviço <ArrowRight className="ml-2 size-4" />
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
            </div>
          </article>
        </div>
      </section>
    </SiteShell>
  );
}