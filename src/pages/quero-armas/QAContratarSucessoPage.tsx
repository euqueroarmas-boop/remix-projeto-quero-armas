import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/shared/cart/CartProvider";
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Clock,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  ListChecks,
  Rocket,
  MessageCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

/**
 * BLOCO 9 — Tela premium pós-contratação.
 * Mostra:
 *  - Confirmação cinematográfica
 *  - Timeline da jornada (7 etapas)
 *  - Próximas ações
 *  - CTAs (catálogo, WhatsApp, portal)
 *  - Status operacional real (qa_vendas.status) quando ?venda=<id>
 *
 * NÃO cria nova arquitetura, NÃO altera CartProvider/catálogo/financeiro.
 */

const WHATSAPP =
  "https://wa.me/5562994040220?text=" +
  encodeURIComponent(
    "Olá, acabei de contratar um serviço na Quero Armas e gostaria de acompanhar.",
  );

interface Catalogo {
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
}

interface Venda {
  id: number;
  status: string | null;
  status_validacao_valor: string | null;
  valor_aprovado: number | null;
  data_cadastro: string | null;
}

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const TIMELINE = [
  { Icon: CheckCircle2, label: "Contratação recebida" },
  { Icon: ShieldCheck, label: "Validação pela Equipe Quero Armas" },
  { Icon: CreditCard, label: "Liberação da cobrança" },
  { Icon: Sparkles, label: "Confirmação do pagamento" },
  { Icon: FileSignature, label: "Contrato digital" },
  { Icon: ListChecks, label: "Portal + checklist + documentos" },
  { Icon: Rocket, label: "Início do processo" },
];

/**
 * Mapeia (qa_vendas.status + status_validacao_valor) — valores reais do
 * banco — para a etapa visual da timeline (1..7).
 *  - INSERT inicial: status="À INICIAR", validacao="aguardando_validacao"  → 1
 *  - Admin valida valor:                  validacao="aprovado"             → 3 (cobrança liberada)
 *  - Pagamento confirmado: status="PAGO"                                   → 4
 *  - Pasta em montagem: "MONTANDO PASTA" / "AGUARDANDO DOCUMENTAÇÃO"      → 6
 *  - Concluído                                                             → 7
 */
function statusToStep(s: string | null | undefined, v: string | null | undefined): number {
  const st = (s || "").toUpperCase().trim();
  const vv = (v || "").toLowerCase().trim();
  if (st === "CONCLUÍDO" || st === "CONCLUIDO" || st === "DEFERIDO") return 7;
  if (
    st === "MONTANDO PASTA" ||
    st.startsWith("AGUARDANDO DOCUMENTA") ||
    st === "EM ANÁLISE" ||
    st === "EM ANALISE" ||
    st.startsWith("PRONTO PARA AN") ||
    st === "RECURSO ADMINISTRATIVO"
  ) return 6;
  if (st === "PAGO") return 4;
  if (vv === "aprovado") return 3;
  if (vv === "corrigido" || vv === "reprovado") return 2;
  return 1;
}

function statusBadge(s: string | null | undefined, v: string | null | undefined) {
  const st = (s || "").toUpperCase().trim();
  const vv = (v || "").toLowerCase().trim();
  if (st === "PAGO")
    return { label: "PAGAMENTO CONFIRMADO", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" };
  if (vv === "aprovado")
    return { label: "PENDENTE DE PAGAMENTO", cls: "bg-amber-50 border-amber-200 text-amber-800" };
  if (vv === "reprovado")
    return { label: "VALOR REPROVADO — REVISÃO", cls: "bg-rose-50 border-rose-200 text-rose-800" };
  if (vv === "corrigido")
    return { label: "VALOR EM REVISÃO", cls: "bg-sky-50 border-sky-200 text-sky-800" };
  return { label: "AGUARDANDO VALIDAÇÃO", cls: "bg-slate-100 border-slate-200 text-slate-700" };
}

export default function QAContratarSucessoPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [search] = useSearchParams();
  const vendaId = search.get("venda");
  const cart = useCart();

  const [loading, setLoading] = useState(true);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [venda, setVenda] = useState<Venda | null>(null);
  const [hasPortal, setHasPortal] = useState(false);

  useEffect(() => {
    // Limpa o carrinho — pedido já foi enviado.
    if (cart.items.length > 0) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: cat } = await supabase
          .from("qa_servicos_catalogo" as any)
          .select("nome, descricao_curta, preco, recorrente")
          .eq("slug", slug)
          .maybeSingle();
        if (!cancel && cat) setCatalogo(cat as any);

        if (vendaId) {
          const { data: v } = await supabase
            .from("qa_vendas" as any)
            .select("id, status, status_validacao_valor, valor_aprovado, data_cadastro")
            .eq("id", Number(vendaId))
            .maybeSingle();
          if (!cancel && v) setVenda(v as any);
        }

        const { data: sess } = await supabase.auth.getSession();
        if (!cancel && sess.session) setHasPortal(true);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug, vendaId]);

  const currentStep = useMemo(
    () => statusToStep(venda?.status, venda?.status_validacao_valor),
    [venda?.status, venda?.status_validacao_valor],
  );
  const badge = useMemo(
    () => statusBadge(venda?.status, venda?.status_validacao_valor),
    [venda?.status, venda?.status_validacao_valor],
  );
  const preco = formatBRL(venda?.valor_aprovado ?? catalogo?.preco ?? null);

  return (
    <div data-tactical-portal className="min-h-screen" style={{ background: "#FAFAFA" }}>
      {/* HERO — Light AAA (matches checkout confirmar) */}
      <header className="relative overflow-hidden" style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E5E5" }}>
        <div
          className="relative max-w-5xl mx-auto px-4 pt-6 pb-10 md:pt-10 md:pb-14"
          style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
        >
          <button
            onClick={() => navigate("/servicos")}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao catálogo
          </button>

          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-widest mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" /> Recebido com sucesso
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight leading-tight text-neutral-900">
            Contratação recebida
          </h1>
          <p className="text-[13px] md:text-base text-neutral-700 mt-2 max-w-2xl leading-relaxed">
            Sua solicitação foi registrada com sucesso pela Equipe Quero Armas.
          </p>
          <p className="text-[12px] md:text-sm text-neutral-500 mt-3 max-w-2xl leading-relaxed">
            Agora nossa equipe validará sua contratação e dará sequência ao fluxo
            adequado conforme o serviço contratado.
          </p>

          {/* Aviso real do fluxo (sem cobrança automática) */}
          <div className="mt-5 max-w-2xl flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <p>
              Nenhuma cobrança automática foi gerada neste momento. A Equipe Quero
              Armas validará os dados antes da continuidade.
            </p>
          </div>

          {/* Resumo + status */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Serviço contratado
              </div>
              <div className="text-sm md:text-base font-bold uppercase mt-0.5 text-neutral-900">
                {loading ? "Carregando…" : catalogo?.nome || slug.toUpperCase()}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-600">
                {preco && (
                  <span>
                    <span className="text-neutral-500">Valor:</span>{" "}
                    <strong className="text-neutral-900">{preco}</strong>
                    {catalogo?.recorrente && <span className="text-neutral-500"> /mês</span>}
                  </span>
                )}
                {venda?.id && (
                  <span>
                    <span className="text-neutral-500">Protocolo:</span>{" "}
                    <strong className="text-neutral-900">#{venda.id}</strong>
                  </span>
                )}
              </div>
            </div>

            <div
              className={`self-stretch md:self-center inline-flex items-center justify-center rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${badge.cls}`}
            >
              {badge.label}
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {/* TIMELINE */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm md:text-base font-bold uppercase tracking-wider text-slate-900">
              Sua jornada
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              Etapa {currentStep} de {TIMELINE.length}
            </span>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-7 gap-3 md:gap-2">
            {TIMELINE.map((t, i) => {
              const n = i + 1;
              const done = n < currentStep;
              const active = n === currentStep;
              return (
                <li key={t.label} className="flex md:flex-col items-start md:items-center gap-3 md:gap-2">
                  <div
                    className={`shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center border-2 transition ${
                      active
                        ? "bg-amber-500 border-amber-400 text-white shadow-[0_0_0_5px_rgba(245,158,11,0.15)]"
                        : done
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <t.Icon className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {String(n).padStart(2, "0")}
                    </div>
                    <div
                      className={`text-[12px] md:text-[11px] font-bold uppercase leading-tight ${
                        active ? "text-amber-700" : done ? "text-emerald-700" : "text-slate-600"
                      }`}
                    >
                      {t.label}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* PRÓXIMAS AÇÕES */}
        <section>
          <h2 className="text-sm md:text-base font-bold uppercase tracking-wider text-slate-900 mb-3">
            O que acontece agora
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                Icon: ShieldCheck,
                title: "Validação dos dados",
                desc: "Nossa equipe revisará suas informações e o serviço contratado.",
              },
              {
                Icon: CreditCard,
                title: "Liberação da cobrança",
                desc: "Após validação, você poderá receber uma cobrança autorizada pela equipe.",
              },
              {
                Icon: LayoutDashboard,
                title: "Acesso ao portal",
                desc: "Após o pagamento, seu portal do cliente será liberado com o checklist.",
              },
              {
                Icon: FileSignature,
                title: "Contrato digital",
                desc: "Seu contrato será disponibilizado para assinatura no portal.",
              },
              {
                Icon: Rocket,
                title: "Início do processo",
                desc: "Iniciamos o atendimento conforme as etapas do serviço contratado.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl bg-white border border-slate-200 p-4 flex gap-3"
              >
                <div className="shrink-0 h-9 w-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <c.Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-slate-900">
                    {c.title}
                  </div>
                  <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section
          className="rounded-2xl bg-white border border-neutral-200 p-5 md:p-7"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm md:text-base font-bold uppercase tracking-wider text-neutral-900">
              Próximo passo
            </h2>
          </div>
          <p className="text-[12px] md:text-sm text-neutral-600 leading-relaxed max-w-2xl">
            Você pode acompanhar o andamento pelo portal do cliente, falar com um
            especialista no WhatsApp ou voltar ao catálogo.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {hasPortal ? (
              <button
                onClick={() => navigate("/area-do-cliente")}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-bold uppercase tracking-wider transition"
              >
                <LayoutDashboard className="h-4 w-4" /> Ir para portal
              </button>
            ) : (
              <button
                onClick={() => navigate("/area-do-cliente/login")}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-bold uppercase tracking-wider transition"
              >
                <LayoutDashboard className="h-4 w-4" /> Acessar portal
              </button>
            )}

            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold uppercase tracking-wider transition"
            >
              <MessageCircle className="h-4 w-4" /> Falar com especialista
            </a>

            <button
              onClick={() => navigate("/servicos")}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-900 text-[12px] font-bold uppercase tracking-wider transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
            </button>
          </div>
        </section>

        {loading && (
          <div className="text-center text-[11px] text-slate-400 inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando detalhes…
          </div>
        )}

        <p className="text-center text-[10px] uppercase tracking-widest text-slate-400">
          Equipe Quero Armas · Suporte e acompanhamento dedicado
        </p>
      </main>
    </div>
  );
}