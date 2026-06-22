import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  MapPin,
  User,
  FileCheck2,
  AlertCircle,
  ChevronRight,
  BadgeDollarSign,
  Check,
  Pencil,
  FileSignature,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import CheckoutShell from "@/components/quero-armas/checkout/CheckoutShell";
import { fetchChecklistEtapa02 } from "@/lib/quero-armas/etapa02Checklist";
import { useCart } from "@/shared/cart/CartProvider";

/* =============================================================================
 * Design tokens — dark premium, vermelho bordô da empresa.
 * ============================================================================= */
const D = {
  /* Paleta monocromática (preto + cinza chumbo) — Timeline editorial */
  bg: "#000000",
  paper: "#0A0A0A",
  paper2: "#141414",
  border: "#2A2A2A",
  borderSoft: "rgba(255,255,255,0.05)",
  ink: "#C7C7C7",
  inkSoft: "#C7C7C7",
  inkFaint: "#5C5C5C",
  /* "red" mantém o nome mas agora é o acento monocromático claro */
  red: "#C7C7C7",
  redDeep: "#8a8a8a",
  redAlpha: "rgba(199,199,199,0.08)",
  redAlphaStrong: "rgba(199,199,199,0.25)",
  redGlow: "rgba(199,199,199,0.20)",
  success: "#C7C7C7",
  successAlpha: "rgba(199,199,199,0.08)",
  successBorder: "rgba(199,199,199,0.30)",
  warning: "#8a8a8a",
  warningAlpha: "rgba(138,138,138,0.10)",
  warningBorder: "rgba(138,138,138,0.35)",
  danger: "#C7C7C7",
  dangerAlpha: "rgba(199,199,199,0.08)",
  dangerBorder: "rgba(199,199,199,0.30)",
  /* neutro = mesma família */
  neutral: "#C7C7C7",
  neutralAlpha: "rgba(199,199,199,0.08)",
  neutralAlphaStrong: "rgba(199,199,199,0.30)",
  neutralGlow: "rgba(199,199,199,0.15)",
};

interface Catalogo {
  id: string;
  slug: string;
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
  gera_processo: boolean;
  servico_id: number | null;
}

interface ClienteData {
  id: number;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  estado_civil: string | null;
  profissao: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

const ESTADOS_CIVIS = ["SOLTEIRO(A)", "CASADO(A)", "DIVORCIADO(A)", "VIÚVO(A)", "UNIÃO ESTÁVEL"];

type Confirmacao = "sim" | "nao" | null;

/* ── Primitivos de UI ───────────────────────────────────────────────────────── */

/* Timeline editorial: cada seção é apenas um bloco vertical com um filete
   inferior, sem caixa, sem borda arredondada. */
function DarkCard({ children, last = false }: {
  children: React.ReactNode;
  accentLine?: boolean;
  glowBorder?: boolean;
  tone?: "red" | "neutral";
  last?: boolean;
}) {
  return (
    <div style={{
      padding: "28px 0",
      borderBottom: last ? "none" : `1px solid ${D.border}`,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ n, done, icon: Icon, label, statusLabel, statusType, tone = "red" }: {
  n: number; done: boolean; icon: any; label: string;
  statusLabel?: string; statusType?: "ok" | "edit";
  tone?: "red" | "neutral";
}) {
  const numStr = String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 18 }}>
      <span style={{
        fontFamily: "Oswald, sans-serif",
        fontSize: 36, fontWeight: 300, lineHeight: 1,
        letterSpacing: "0.02em",
        color: done ? D.ink : D.inkFaint,
        flexShrink: 0, width: 56,
        transition: "color .2s",
      }}>
        {numStr}
      </span>
      <span style={{
        flex: 1, minWidth: 0,
        fontFamily: "Oswald, sans-serif",
        fontSize: 11, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.32em", color: D.ink,
      }}>
        {label}
      </span>
      {statusLabel && (
        <span style={{
          fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.2em",
          flexShrink: 0,
          color: statusType === "ok" ? D.ink : D.inkFaint,
        }}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}

function DataRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      paddingLeft: 76,
      fontSize: 14, color: D.inkSoft, lineHeight: 1.7,
      fontWeight: 300,
    }}>
      {children}
    </div>
  );
}

function DarkConfirmButtons({ value, onChange, labelSim, labelNao }: {
  value: Confirmacao; onChange: (v: "sim" | "nao") => void;
  labelSim: string; labelNao: string;
}) {
  return (
    <div style={{
      marginTop: 18, paddingLeft: 76,
      display: "flex", alignItems: "center", gap: 28,
    }}>
      {(["sim", "nao"] as const).map((opt) => {
        const isSelected = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} style={{
            background: "transparent", border: "none", padding: "4px 0",
            cursor: "pointer",
            fontFamily: "Oswald, sans-serif",
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.24em",
            color: isSelected ? D.ink : D.inkFaint,
            borderBottom: `1px solid ${isSelected ? D.ink : "transparent"}`,
            transition: "color .15s, border-color .15s",
          }}>
            {opt === "sim" ? labelSim : labelNao}
          </button>
        );
      })}
    </div>
  );
}

function DarkInput({ placeholder, value, onChange, wide, maxLength }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  wide?: boolean; maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={wide ? "qa-input-wide" : ""}
      style={{
        height: 38, padding: "0 2px",
        fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${focused ? D.ink : D.border}`,
        color: D.ink, outline: "none", width: "100%", boxSizing: "border-box",
        transition: "border-color .15s",
      }}
    />
  );
}

/* ── Página principal ───────────────────────────────────────────────────────── */

export default function QAContratarConfirmarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [docsReaproveitados, setDocsReaproveitados] = useState<string[]>([]);

  const [enderecoOk, setEnderecoOk] = useState<Confirmacao>(null);
  const [novoCep, setNovoCep] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const [novoComplemento, setNovoComplemento] = useState("");
  const [novoBairro, setNovoBairro] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novoEstado, setNovoEstado] = useState("");

  const [dadosOk, setDadosOk] = useState<Confirmacao>(null);
  const [novoEstadoCivil, setNovoEstadoCivil] = useState("");
  const [novaProfissao, setNovaProfissao] = useState("");

  const [aceiteContrato, setAceiteContrato] = useState(false);

  const [legadoBlock, setLegadoBlock] = useState<{
    homologacao_status?: string | null;
    recadastramento_status?: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/identificar`, { replace: true });
        return;
      }
      const uid = sess.session.user.id;

      const { data: cat } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("id, slug, nome, descricao_curta, preco, recorrente, gera_processo, servico_id")
        .eq("slug", slug).eq("ativo", true).maybeSingle();
      if (!cat) {
        toast.error("Serviço não encontrado.");
        navigate("/area-do-cliente/contratar", { replace: true });
        return;
      }
      setCatalogo(cat as any);

      const { data: link } = await supabase
        .from("cliente_auth_links" as any)
        .select("qa_cliente_id")
        .eq("user_id", uid).not("qa_cliente_id", "is", null)
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1).maybeSingle();
      const clienteId = (link as any)?.qa_cliente_id;
      if (!clienteId) {
        toast.error("Cadastro de cliente não encontrado.");
        navigate("/area-do-cliente", { replace: true });
        return;
      }

      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("id, nome_completo, cpf, email, estado_civil, profissao, cep, endereco, numero, complemento, bairro, cidade, estado")
        .eq("id", clienteId).maybeSingle();
      if (cli) setCliente(cli as any);

      try {
        const [checklist, docsResp] = await Promise.all([
          fetchChecklistEtapa02(slug),
          supabase.functions.invoke("qa-cadastro-carregar-cliente", { body: {} }),
        ]);
        const docsValidos = Array.isArray((docsResp.data as any)?.documentos_validos)
          ? ((docsResp.data as any).documentos_validos as Array<{ tipo_documento?: string | null }>)
          : [];
        const itensCompativeis = checklist.filter((item) =>
          docsValidos.some((doc) =>
            item.tiposCompativeis.includes(String(doc.tipo_documento || "").toUpperCase())
          )
        );
        setDocsReaproveitados(
          Array.from(new Set(itensCompativeis.map((item) => item.shortName || item.label)))
        );
      } catch {
        setDocsReaproveitados([]);
      }
      setLoading(false);
    })();
  }, [slug, navigate]);

  const enderecoAtualLinha = useMemo(() => {
    if (!cliente) return "";
    return [
      cliente.endereco, cliente.numero, cliente.complemento, cliente.bairro,
      cliente.cidade && cliente.estado ? `${cliente.cidade} / ${cliente.estado}` : cliente.cidade,
      cliente.cep,
    ].filter(Boolean).join(", ");
  }, [cliente]);

  const valorNumerico = useMemo(() => {
    const n = Number(catalogo?.preco ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [catalogo]);

  const podeConfirmar =
    enderecoOk !== null && dadosOk !== null && aceiteContrato && !submitting && !loading && cliente && catalogo;

  const iniciaisNome = useMemo(() => {
    if (!cliente?.nome_completo) return "?";
    const parts = cliente.nome_completo.trim().split(" ").filter(Boolean);
    return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.[0] ?? "?";
  }, [cliente]);

  async function handleConfirmar() {
    if (!cliente || !catalogo) return;
    setSubmitting(true);
    try {
      const { data: verifData, error: verifErr } = await supabase.rpc(
        "qa_verificar_cliente_pode_contratar" as any,
        { p_cliente_id: cliente.id, p_catalogo_slug: catalogo.slug } as any
      );
      if (verifErr) throw verifErr;
      const verif = (verifData ?? {}) as {
        pode_contratar?: boolean; motivo?: string;
        homologacao_status?: string | null; recadastramento_status?: string | null;
      };
      if (verif.pode_contratar === false) {
        setLegadoBlock({ homologacao_status: verif.homologacao_status ?? null, recadastramento_status: verif.recadastramento_status ?? null });
        toast.error("Recadastramento obrigatório antes de contratar.");
        setSubmitting(false);
        return;
      }

      if (enderecoOk === "nao" || dadosOk === "nao") {
        const { error: errUpd } = await supabase.rpc(
          "qa_atualizar_dados_basicos_cliente" as any,
          {
            p_cliente_id: cliente.id,
            p_estado_civil: dadosOk === "nao" ? novoEstadoCivil : null,
            p_profissao: dadosOk === "nao" ? novaProfissao : null,
            p_cep: enderecoOk === "nao" ? novoCep : null,
            p_endereco: enderecoOk === "nao" ? novoEndereco : null,
            p_numero: enderecoOk === "nao" ? novoNumero : null,
            p_complemento: enderecoOk === "nao" ? novoComplemento : null,
            p_bairro: enderecoOk === "nao" ? novoBairro : null,
            p_cidade: enderecoOk === "nao" ? novaCidade : null,
            p_estado: enderecoOk === "nao" ? novoEstado : null,
          } as any
        );
        if (errUpd) throw errUpd;
      }

      /* Registra aceite de contrato (best-effort) */
      try {
        await supabase.functions.invoke("qa-contract-aceite-registrar", {
          body: {
            cliente_id: cliente.id, venda_id: null, solicitacao_id: null,
            servico_slug: catalogo.slug, servico_slugs: [catalogo.slug],
            servico_preco: valorNumerico,
            dados_pessoais: {
              nome_completo: cliente.nome_completo, cpf: cliente.cpf, email: cliente.email,
              estado_civil: dadosOk === "nao" && novoEstadoCivil ? novoEstadoCivil : cliente.estado_civil,
              profissao: dadosOk === "nao" && novaProfissao ? novaProfissao : cliente.profissao,
            },
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            template_codigo: "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS",
          },
        });
      } catch (aceiteFail: any) {
        console.warn("[confirmar] aceite-registrar falhou:", aceiteFail);
      }

      if (!valorNumerico) {
        toast.error("Serviço sem preço configurado no catálogo. Fale com a equipe.");
        return;
      }
      addItem({
        service_id: catalogo.id,          // UUID do catálogo (esperado pela edge function)
        service_slug: catalogo.slug,
        service_name: catalogo.nome,
        unit_price_cents: Math.round(valorNumerico * 100),
        quantity: 1,
      });
      toast.success("Tudo certo! Escolha como pagar.");
      navigate("/checkout/finalizar");
    } catch (e: any) {
      console.error("[contratar/confirmar] erro:", e);
      toast.error(e?.message || "Não foi possível concluir a contratação.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Loading ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ background: D.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} color={D.red} style={{ animation: "qa-spin 1s linear infinite" }} />
        <style>{`@keyframes qa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!catalogo || !cliente) return null;

  /* ── Bloqueio legacy ───────────────────────────────────────────────────── */
  if (legadoBlock) {
    const waLink = "https://wa.me/5562994040220?text=" +
      encodeURIComponent(`Olá! Sou cliente antigo da Quero Armas (CPF ${cliente.cpf || "—"}) e quero atualizar meu cadastro para contratar o serviço ${catalogo.nome}.`);
    return (
      <div style={{ background: D.bg, minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ background: D.paper, border: `1px solid ${D.dangerBorder}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: D.dangerAlpha, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={20} color={D.danger} />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: D.ink, marginBottom: 8 }}>
                  Recadastramento obrigatório
                </h1>
                <p style={{ fontSize: 13, color: D.inkSoft, lineHeight: 1.7, margin: 0 }}>
                  Seu cadastro veio do sistema antigo da Quero Armas. Para comprar um novo serviço, precisamos atualizar seus documentos no sistema novo.
                </p>
                <p style={{ fontSize: 10, color: D.inkFaint, marginTop: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Status: {legadoBlock.homologacao_status || "pendente"} · Recadastramento: {legadoBlock.recadastramento_status || "—"}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => navigate("/area-do-cliente?secao=arsenal")}
                style={{ padding: "12px 16px", borderRadius: 10, background: D.red, color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: "none", cursor: "pointer", width: "100%", boxShadow: `0 0 16px ${D.redGlow}` }}>
                Enviar documentos agora
              </button>
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", padding: "12px 16px", borderRadius: 10, background: "#22a559", color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textDecoration: "none" }}>
                Falar com a Equipe Quero Armas
              </a>
              <button type="button" onClick={() => navigate("/area-do-cliente")}
                style={{ padding: "12px 16px", borderRadius: 10, background: D.paper2, color: D.inkSoft, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: `1px solid ${D.border}`, cursor: "pointer", width: "100%" }}>
                Voltar ao portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render principal ──────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @keyframes qa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Grid de endereço: timeline editorial — inputs underline, indent 76px */
        .qa-addr-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px 28px;
          margin-top: 22px;
          padding-left: 76px;
        }
        .qa-input-wide { grid-column: span 3 !important; }

        @media (max-width: 768px) {
          .qa-addr-grid { grid-template-columns: 1fr 1fr !important; }
          .qa-input-wide { grid-column: span 2 !important; }
        }
        @media (max-width: 480px) {
          .qa-addr-grid { grid-template-columns: 1fr !important; padding-left: 0 !important; }
          .qa-input-wide { grid-column: span 1 !important; }
        }
      `}</style>

      <CheckoutShell
        step={3}
        slug={slug}
        backTo="/area-do-cliente/contratar"
        hideSidebar
        summary={{ nome: catalogo.nome, descricao_curta: catalogo.descricao_curta, preco: catalogo.preco, recorrente: catalogo.recorrente }}
      >

        {/* ── Titular ─────────────────────────────────────────────────── */}
        <DarkCard accentLine>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: D.paper2,
              border: `1px solid ${D.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
              color: D.ink, userSelect: "none",
            }}>
              {iniciaisNome}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: D.inkFaint, marginBottom: 3 }}>
                Titular
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: D.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cliente.nome_completo}
              </div>
              <div style={{ fontSize: 12, color: D.inkFaint, marginTop: 3 }}>
                CPF {cliente.cpf || "—"} · {cliente.email || "sem e-mail"}
              </div>
            </div>
          </div>
        </DarkCard>

        {/* ── 1. Endereço ─────────────────────────────────────────────── */}
        <DarkCard>
          <SectionLabel
            n={1} done={enderecoOk !== null} icon={MapPin} label="Endereço"
            statusLabel={enderecoOk === "sim" ? "Confirmado" : enderecoOk === "nao" ? "Atualizar" : undefined}
            statusType={enderecoOk === "sim" ? "ok" : "edit"}
          />
          <DataRow>
            {enderecoAtualLinha || <span style={{ fontStyle: "italic", color: D.inkFaint }}>Sem endereço cadastrado.</span>}
          </DataRow>
          <DarkConfirmButtons value={enderecoOk} onChange={setEnderecoOk} labelSim="É o mesmo" labelNao="Mudou" />
          {enderecoOk === "nao" && (
            <div className="qa-addr-grid">
              <DarkInput placeholder="CEP" value={novoCep} onChange={setNovoCep} />
              <DarkInput placeholder="Estado (UF)" value={novoEstado} onChange={(v) => setNovoEstado(v.toUpperCase())} maxLength={2} />
              <DarkInput placeholder="Rua / Avenida" value={novoEndereco} onChange={(v) => setNovoEndereco(v.toUpperCase())} wide />
              <DarkInput placeholder="Número" value={novoNumero} onChange={setNovoNumero} />
              <DarkInput placeholder="Complemento" value={novoComplemento} onChange={(v) => setNovoComplemento(v.toUpperCase())} />
              <DarkInput placeholder="Bairro" value={novoBairro} onChange={(v) => setNovoBairro(v.toUpperCase())} />
              <DarkInput placeholder="Cidade" value={novaCidade} onChange={(v) => setNovaCidade(v.toUpperCase())} />
            </div>
          )}
        </DarkCard>

        {/* ── 2. Estado civil e profissão ─────────────────────────────── */}
        <DarkCard>
          <SectionLabel
            n={2} done={dadosOk !== null} icon={User} label="Estado civil e profissão"
            statusLabel={dadosOk === "sim" ? "Confirmado" : dadosOk === "nao" ? "Atualizar" : undefined}
            statusType={dadosOk === "sim" ? "ok" : "edit"}
          />
          <DataRow>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 2 }}>Estado civil</div>
                <span style={{ color: D.ink }}>{cliente.estado_civil || "—"}</span>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 2 }}>Profissão</div>
                <span style={{ color: D.ink }}>{cliente.profissao || "—"}</span>
              </div>
            </div>
          </DataRow>
          <DarkConfirmButtons value={dadosOk} onChange={setDadosOk} labelSim="Não mudou" labelNao="Mudou algo" />
          {dadosOk === "nao" && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <select value={novoEstadoCivil} onChange={(e) => setNovoEstadoCivil(e.target.value)}
                style={{ height: 40, padding: "0 14px", fontSize: 12, textTransform: "uppercase", background: D.paper2, border: `1.5px solid ${D.border}`, borderRadius: 8, color: D.inkSoft, outline: "none", width: "100%" }}>
                <option value="">Estado civil (manter o atual se vazio)</option>
                {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
              </select>
              <DarkInput placeholder="Profissão (manter atual se vazio)" value={novaProfissao} onChange={(v) => setNovaProfissao(v.toUpperCase())} wide />
            </div>
          )}
        </DarkCard>

        {/* ── 3. Documentos reaproveitados ────────────────────────────── */}
        <DarkCard>
          <SectionLabel
            n={3} done icon={FileCheck2} label="Documentos reaproveitados"
            statusLabel={docsReaproveitados.length > 0 ? `${docsReaproveitados.length} doc${docsReaproveitados.length > 1 ? "s" : ""}` : undefined}
            statusType="ok"
          />
          {docsReaproveitados.length === 0 ? (
            <DataRow>
              <span style={{ fontStyle: "italic", color: D.inkFaint }}>
                Nenhum documento prévio validado — você enviará todos no processo novo.
              </span>
            </DataRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docsReaproveitados.slice(0, 8).map((d) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, background: D.successAlpha, border: `1px solid ${D.successBorder}`, borderRadius: 8, padding: "9px 14px" }}>
                  <CheckCircle2 size={15} color={D.success} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: D.success }}>{d}</span>
                </div>
              ))}
              {docsReaproveitados.length > 8 && (
                <span style={{ fontSize: 11, color: D.inkFaint, padding: "0 4px" }}>
                  +{docsReaproveitados.length - 8} outros documentos disponíveis.
                </span>
              )}
            </div>
          )}
        </DarkCard>

        {/* ── 4. Valor do serviço ──────────────────────────────────────── */}
        <DarkCard accentLine>
          <SectionLabel n={4} done={valorNumerico > 0} icon={BadgeDollarSign} label="Valor do serviço" />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: -4 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: D.inkFaint, marginBottom: 6 }}>Total</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: D.ink, lineHeight: 1 }}>
                {valorNumerico > 0
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
                  : "—"}
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: D.success, background: D.successAlpha, border: `1px solid ${D.successBorder}`, borderRadius: 99, padding: "4px 12px" }}>
              Preço oficial
            </span>
          </div>
          <p style={{ fontSize: 12, color: D.inkFaint, marginTop: 12, lineHeight: 1.6 }}>
            Pagamento via PIX, boleto ou cartão na próxima etapa. Processo iniciado após confirmação.
          </p>
        </DarkCard>

        {/* ── 5. Contrato e aceite ─────────────────────────────────────── */}
        <DarkCard glowBorder={!aceiteContrato} tone="neutral">
          <SectionLabel
            n={5} done={aceiteContrato} icon={FileSignature} label="Contrato e aceite"
            statusLabel={aceiteContrato ? "Aceito ✓" : "Obrigatório"}
            statusType={aceiteContrato ? "ok" : "edit"}
            tone="neutral"
          />

          {/* Aviso e links legais — a leitura e o aceite do contrato completo
              (acordeão por cláusula + resumo) acontecem na etapa de
              Contrato e Pagamento, em /checkout/finalizar, igual ao fluxo
              de quem não está logado. Não duplicamos a exibição aqui. */}
          <p style={{ fontSize: 12, color: D.inkSoft, lineHeight: 1.7, marginBottom: 14 }}>
            Você vai revisar e aceitar o contrato de adesão de serviços completo na etapa de pagamento. Ao confirmar aqui, você concorda com os{" "}
            <a href="/termos" target="_blank" rel="noopener noreferrer"
              style={{ color: D.neutral, textDecoration: "none", borderBottom: `1px solid ${D.neutralAlphaStrong}`, display: "inline-flex", alignItems: "center", gap: 3 }}>
              Termos de Serviço <ExternalLink size={10} />
            </a>
            {" "}e a{" "}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer"
              style={{ color: D.neutral, textDecoration: "none", borderBottom: `1px solid ${D.neutralAlphaStrong}`, display: "inline-flex", alignItems: "center", gap: 3 }}>
              Política de Privacidade <ExternalLink size={10} />
            </a>
            {" "}da Quero Armas. O aceite eletrônico possui validade jurídica conforme a Lei n.º 14.063/2020.
          </p>

          {/* Checkbox de aceite */}
          <button
            type="button"
            onClick={() => setAceiteContrato((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "flex-start", gap: 14,
              cursor: "pointer", textAlign: "left",
              background: aceiteContrato
                ? D.successAlpha
                : `rgba(196,37,59,0.06)`,
              border: `2px solid ${aceiteContrato ? D.successBorder : D.redAlphaStrong}`,
              borderRadius: 12, padding: "14px 16px",
              transition: "all .25s",
              boxShadow: aceiteContrato
                ? `0 0 16px rgba(127,191,106,0.1)`
                : `0 0 16px ${D.redAlpha}`,
            }}
          >
            {/* Checkbox visual */}
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: aceiteContrato ? D.success : "transparent",
              border: `2px solid ${aceiteContrato ? D.success : D.red}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .2s",
              boxShadow: aceiteContrato ? `0 0 8px rgba(127,191,106,0.3)` : `0 0 6px ${D.redAlpha}`,
            }}>
              {aceiteContrato && <Check size={13} color="#fff" />}
            </div>
            <span style={{ fontSize: 13, color: aceiteContrato ? D.success : D.inkSoft, lineHeight: 1.65, flex: 1 }}>
              <strong style={{ color: aceiteContrato ? D.success : D.ink }}>Li e aceito</strong>{" "}
              os Termos de Serviço e a Política de Privacidade da Quero Armas.
              Estou ciente de que o processo será iniciado após a confirmação do pagamento.
            </span>
          </button>
        </DarkCard>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <button
          type="button"
          disabled={!podeConfirmar}
          onClick={handleConfirmar}
          style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "20px 24px", borderRadius: 4,
            cursor: podeConfirmar ? "pointer" : "not-allowed",
            fontFamily: "Oswald, sans-serif",
            fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em",
            background: podeConfirmar ? D.ink : D.paper2,
            color: podeConfirmar ? "#000" : D.inkFaint,
            border: podeConfirmar ? "none" : `1px solid ${D.border}`,
            transition: "all .25s",
          }}
        >
          {submitting
            ? <Loader2 size={20} style={{ animation: "qa-spin 1s linear infinite" }} />
            : <Sparkles size={20} />}
          {submitting ? "Processando…" : "Ir para pagamento"}
          {!submitting && <ChevronRight size={20} />}
        </button>

        {!aceiteContrato && (enderecoOk !== null || dadosOk !== null) && (
          <p style={{ textAlign: "center", fontSize: 11, color: D.red, marginTop: -6, opacity: 0.8 }}>
            Aceite o contrato acima para liberar o pagamento
          </p>
        )}

      </CheckoutShell>
    </>
  );
}
