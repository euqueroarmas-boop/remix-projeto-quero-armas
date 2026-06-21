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
  bg: "#050505",
  paper: "#171717",
  paper2: "#111111",
  border: "rgba(255,255,255,0.09)",
  borderSoft: "rgba(255,255,255,0.05)",
  ink: "#f0ece5",
  inkSoft: "#ccc5b9",
  inkFaint: "#6b6560",
  /* vermelho bordô — cor da empresa */
  red: "#c4253b",
  redDeep: "#7A1F2B",
  redAlpha: "rgba(196,37,59,0.12)",
  redAlphaStrong: "rgba(196,37,59,0.30)",
  redGlow: "rgba(196,37,59,0.40)",
  success: "#7fbf6a",
  successAlpha: "rgba(127,191,106,0.10)",
  successBorder: "rgba(127,191,106,0.30)",
  warning: "#e0a030",
  warningAlpha: "rgba(224,160,48,0.10)",
  warningBorder: "rgba(224,160,48,0.30)",
  danger: "#c0392b",
  dangerAlpha: "rgba(192,57,43,0.10)",
  dangerBorder: "rgba(192,57,43,0.25)",
  /* neutro preto/cinza — usado na seção de contrato e aceite (sem bordô) */
  neutral: "#d4d4d4",
  neutralAlpha: "rgba(212,212,212,0.10)",
  neutralAlphaStrong: "rgba(212,212,212,0.25)",
  neutralGlow: "rgba(212,212,212,0.12)",
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

function DarkCard({ children, accentLine = false, glowBorder = false, tone = "red" }: {
  children: React.ReactNode;
  accentLine?: boolean;
  glowBorder?: boolean;
  tone?: "red" | "neutral";
}) {
  const c = tone === "neutral"
    ? { main: D.neutral, mainDeep: D.neutral, alpha: D.neutralAlpha, alphaStrong: D.neutralAlphaStrong, glow: D.neutralGlow }
    : { main: D.red, mainDeep: D.redDeep, alpha: D.redAlpha, alphaStrong: D.redAlphaStrong, glow: D.redGlow };
  return (
    <div style={{
      background: D.paper,
      border: `1px solid ${glowBorder ? c.alphaStrong : D.border}`,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: glowBorder ? `0 0 20px ${c.alpha}, inset 0 0 0 1px ${c.alpha}` : "none",
    }}>
      {accentLine && (
        <div style={{
          height: "2px",
          background: `linear-gradient(to right, ${c.main}, ${c.mainDeep})`,
          boxShadow: `0 0 10px ${c.glow}`,
        }} />
      )}
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function SectionLabel({ n, done, icon: Icon, label, statusLabel, statusType, tone = "red" }: {
  n: number; done: boolean; icon: any; label: string;
  statusLabel?: string; statusType?: "ok" | "edit";
  tone?: "red" | "neutral";
}) {
  const accent = tone === "neutral" ? D.neutral : D.red;
  const accentAlpha = tone === "neutral" ? D.neutralAlpha : D.redAlpha;
  const accentAlphaStrong = tone === "neutral" ? D.neutralAlphaStrong : D.redAlphaStrong;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800,
        background: done ? accent : accentAlpha,
        border: `2px solid ${done ? accent : accentAlphaStrong}`,
        color: done ? (tone === "neutral" ? "#000" : "#fff") : accent,
        boxShadow: done ? `0 0 10px ${accentAlpha}` : "none",
        transition: "all .2s",
      }}>
        {done ? <Check size={13} /> : n}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: accentAlpha,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} color={accent} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.07em", color: D.ink,
        }}>
          {label}
        </span>
      </div>
      {statusLabel && (
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
          padding: "3px 10px", borderRadius: 99, flexShrink: 0,
          color: statusType === "ok" ? D.success : D.warning,
          background: statusType === "ok" ? D.successAlpha : D.warningAlpha,
          border: `1px solid ${statusType === "ok" ? D.successBorder : D.warningBorder}`,
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
      background: D.paper2, border: `1px solid ${D.borderSoft}`,
      borderRadius: 8, padding: "10px 14px",
      fontSize: 13, color: D.inkSoft, lineHeight: 1.7,
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
      {(["sim", "nao"] as const).map((opt) => {
        const isSelected = value === opt;
        const isOk = opt === "sim";
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} style={{
            position: "relative",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            borderRadius: 10, padding: "12px 8px",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
            cursor: "pointer", transition: "all .15s",
            background: isSelected ? (isOk ? D.successAlpha : D.warningAlpha) : D.paper2,
            border: `2px solid ${isSelected ? (isOk ? D.successBorder : D.warningBorder) : D.borderSoft}`,
            color: isSelected ? (isOk ? D.success : D.warning) : D.inkFaint,
          }}>
            {isSelected && (
              <CheckCircle2 size={14} color={isOk ? D.success : D.warning}
                style={{ position: "absolute", top: 8, right: 8 }} />
            )}
            {isOk
              ? <Check size={16} color={isSelected ? D.success : D.inkFaint} />
              : <Pencil size={16} color={isSelected ? D.warning : D.inkFaint} />
            }
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
        height: 40, padding: "0 14px",
        fontSize: 12, textTransform: "uppercase",
        background: D.paper2,
        border: `1.5px solid ${focused ? D.red : D.border}`,
        borderRadius: 8, color: D.ink, outline: "none", width: "100%", boxSizing: "border-box",
        boxShadow: focused ? `0 0 0 3px ${D.redAlpha}` : "none",
        transition: "border-color .15s, box-shadow .15s",
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

        /* Grid de endereço: 3 cols em desktop, 2 em tablet, 1 em mobile */
        .qa-addr-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        .qa-input-wide { grid-column: span 3 !important; }

        @media (max-width: 768px) {
          .qa-addr-grid { grid-template-columns: 1fr 1fr !important; }
          .qa-input-wide { grid-column: span 2 !important; }
        }
        @media (max-width: 480px) {
          .qa-addr-grid { grid-template-columns: 1fr !important; }
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
              background: `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`,
              border: `2px solid ${D.redAlphaStrong}`,
              boxShadow: `0 0 16px ${D.redAlpha}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#fff", userSelect: "none",
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
            padding: "18px 24px", borderRadius: 14, border: "none",
            cursor: podeConfirmar ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
            background: podeConfirmar
              ? `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`
              : D.paper2,
            color: podeConfirmar ? "#fff" : D.inkFaint,
            boxShadow: podeConfirmar ? `0 6px 30px ${D.redGlow}, 0 0 0 1px ${D.redAlphaStrong}` : "none",
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
