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
 * Design tokens — dark brass, alinhado com o checkout guiado (/cadastro).
 * ============================================================================= */
const D = {
  bg: "#050505",
  paper: "#171717",
  paper2: "#111111",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  borderAccent: "rgba(214,166,75,0.35)",
  ink: "#f8f5ef",
  inkSoft: "#b9b2a7",
  inkFaint: "#4a4540",
  brass: "#d6a64b",
  brassAlpha: "rgba(214,166,75,0.12)",
  brassAlphaStrong: "rgba(214,166,75,0.3)",
  success: "#7fbf6a",
  successAlpha: "rgba(127,191,106,0.1)",
  successBorder: "rgba(127,191,106,0.25)",
  warning: "#e0a030",
  warningAlpha: "rgba(224,160,48,0.1)",
  warningBorder: "rgba(224,160,48,0.3)",
  danger: "#c0392b",
  dangerAlpha: "rgba(192,57,43,0.1)",
  dangerBorder: "rgba(192,57,43,0.25)",
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

function DarkCard({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: D.paper,
      border: `1px solid ${accent ? D.borderAccent : D.border}`,
      borderRadius: 14,
      overflow: "hidden",
    }}>
      {accent && (
        <div style={{ height: "1.5px", background: `linear-gradient(to right, ${D.brass}, rgba(214,166,75,0.1))` }} />
      )}
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </div>
  );
}

function SectionLabel({ n, done, icon: Icon, label, statusLabel, statusType }: {
  n: number;
  done: boolean;
  icon: any;
  label: string;
  statusLabel?: string;
  statusType?: "ok" | "edit";
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      {/* number circle */}
      <div style={{
        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800,
        background: done ? D.brass : D.brassAlpha,
        border: `1.5px solid ${done ? D.brass : D.borderAccent}`,
        color: done ? D.bg : D.brass,
        transition: "all .2s",
      }}>
        {done ? <Check size={12} /> : n}
      </div>
      {/* icon box + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          background: D.brassAlpha,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={13} color={D.brass} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: D.ink }}>
          {label}
        </span>
      </div>
      {statusLabel && (
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
          padding: "2px 9px", borderRadius: 99,
          color: statusType === "ok" ? D.success : D.warning,
          background: statusType === "ok" ? D.successAlpha : D.warningAlpha,
          border: `1px solid ${statusType === "ok" ? D.successBorder : D.warningBorder}`,
          flexShrink: 0,
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
      background: D.paper2,
      border: `1px solid ${D.borderSoft}`,
      borderRadius: 8,
      padding: "10px 12px",
      fontSize: 12,
      color: D.inkSoft,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

function DarkConfirmButtons({ value, onChange, labelSim, labelNao }: {
  value: Confirmacao;
  onChange: (v: "sim" | "nao") => void;
  labelSim: string;
  labelNao: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
      {(["sim", "nao"] as const).map((opt) => {
        const isSelected = value === opt;
        const isOk = opt === "sim";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              position: "relative",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              borderRadius: 12, padding: "10px 12px",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              cursor: "pointer", transition: "all .15s",
              background: isSelected
                ? isOk ? D.successAlpha : D.warningAlpha
                : D.paper2,
              border: `1.5px solid ${isSelected
                ? isOk ? D.successBorder : D.warningBorder
                : D.borderSoft}`,
              color: isSelected
                ? isOk ? D.success : D.warning
                : D.inkFaint,
            }}
          >
            {isSelected && (
              <CheckCircle2
                size={14}
                color={isOk ? D.success : D.warning}
                style={{ position: "absolute", top: 8, right: 8 }}
              />
            )}
            {isOk
              ? <Check size={15} color={isSelected ? D.success : D.inkFaint} />
              : <Pencil size={15} color={isSelected ? D.warning : D.inkFaint} />
            }
            {opt === "sim" ? labelSim : labelNao}
          </button>
        );
      })}
    </div>
  );
}

function DarkInput({ placeholder, value, onChange, colSpan, maxLength }: {
  placeholder: string; value: string;
  onChange: (v: string) => void;
  colSpan?: 2;
  maxLength?: number;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      style={{
        gridColumn: colSpan === 2 ? "span 2" : "span 1",
        height: 36, padding: "0 12px",
        fontSize: 12, textTransform: "uppercase",
        background: D.paper2,
        border: `1px solid ${D.border}`,
        borderRadius: 8, color: D.ink,
        outline: "none",
      }}
      onFocus={(e) => { e.target.style.borderColor = D.brass; e.target.style.boxShadow = `0 0 0 2px ${D.brassAlpha}`; }}
      onBlur={(e) => { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }}
    />
  );
}

/* ── Componente principal ───────────────────────────────────────────────────── */

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
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (!cat) {
        toast.error("Serviço não encontrado.");
        navigate("/area-do-cliente/contratar", { replace: true });
        return;
      }
      setCatalogo(cat as any);

      const { data: link } = await supabase
        .from("cliente_auth_links" as any)
        .select("qa_cliente_id")
        .eq("user_id", uid)
        .not("qa_cliente_id", "is", null)
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const clienteId = (link as any)?.qa_cliente_id;
      if (!clienteId) {
        toast.error("Cadastro de cliente não encontrado.");
        navigate("/area-do-cliente", { replace: true });
        return;
      }

      const { data: cli } = await supabase
        .from("qa_clientes")
        .select(
          "id, nome_completo, cpf, email, estado_civil, profissao, cep, endereco, numero, complemento, bairro, cidade, estado"
        )
        .eq("id", clienteId)
        .maybeSingle();
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
      cliente.endereco,
      cliente.numero,
      cliente.complemento,
      cliente.bairro,
      cliente.cidade && cliente.estado ? `${cliente.cidade} / ${cliente.estado}` : cliente.cidade,
      cliente.cep,
    ]
      .filter(Boolean)
      .join(", ");
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
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : parts[0]?.[0] ?? "?";
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
        pode_contratar?: boolean;
        motivo?: string;
        homologacao_status?: string | null;
        recadastramento_status?: string | null;
      };
      if (verif.pode_contratar === false) {
        setLegadoBlock({
          homologacao_status: verif.homologacao_status ?? null,
          recadastramento_status: verif.recadastramento_status ?? null,
        });
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

      /* Registra aceite de contrato (best-effort, não bloqueia o fluxo) */
      try {
        await supabase.functions.invoke("qa-contract-aceite-registrar", {
          body: {
            cliente_id: cliente.id,
            venda_id: null,
            solicitacao_id: null,
            servico_slug: catalogo.slug,
            servico_slugs: [catalogo.slug],
            servico_preco: valorNumerico,
            dados_pessoais: {
              nome_completo: cliente.nome_completo,
              cpf: cliente.cpf,
              email: cliente.email,
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

      if (!catalogo.servico_id || !valorNumerico) {
        toast.error("Serviço sem preço configurado no catálogo. Fale com a equipe.");
        return;
      }
      addItem({
        service_id: String(catalogo.servico_id),
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
        <Loader2 size={24} color={D.brass} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!catalogo || !cliente) return null;

  /* ── Bloqueio legacy ───────────────────────────────────────────────────── */
  if (legadoBlock) {
    const waLink =
      "https://wa.me/5562994040220?text=" +
      encodeURIComponent(
        `Olá! Sou cliente antigo da Quero Armas (CPF ${cliente.cpf || "—"}) e quero atualizar meu cadastro para contratar o serviço ${catalogo.nome}.`
      );
    return (
      <div style={{ background: D.bg, minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ background: D.paper, border: `1px solid ${D.dangerBorder}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: D.dangerAlpha, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={18} color={D.danger} />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: D.ink, marginBottom: 8 }}>
                  Recadastramento obrigatório
                </h1>
                <p style={{ fontSize: 12, color: D.inkSoft, lineHeight: 1.7, margin: 0 }}>
                  Seu cadastro veio do sistema antigo da Quero Armas. Para comprar um novo
                  serviço, precisamos atualizar seus documentos no sistema novo.
                </p>
                <p style={{ fontSize: 10, color: D.inkFaint, marginTop: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Status: {legadoBlock.homologacao_status || "pendente"} · Recadastramento: {legadoBlock.recadastramento_status || "—"}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Enviar documentos agora", onClick: () => navigate("/area-do-cliente?secao=arsenal"), color: D.brass, textColor: D.bg },
                { label: "Falar com a Equipe Quero Armas", href: waLink, color: "#22a559", textColor: "#fff" },
                { label: "Voltar ao portal", onClick: () => navigate("/area-do-cliente"), color: D.paper2, textColor: D.inkSoft },
              ].map(({ label, onClick, href, color, textColor }) =>
                href ? (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "11px 16px", borderRadius: 10, background: color, color: textColor, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textDecoration: "none" }}>
                    {label}
                  </a>
                ) : (
                  <button key={label} type="button" onClick={onClick} style={{ padding: "11px 16px", borderRadius: 10, background: color, color: textColor, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: "none", cursor: "pointer", width: "100%" }}>
                    {label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render principal ──────────────────────────────────────────────────── */
  return (
    <CheckoutShell
      step={3}
      slug={slug}
      backTo="/area-do-cliente/contratar"
      hideSidebar
      summary={{
        nome: catalogo.nome,
        descricao_curta: catalogo.descricao_curta,
        preco: catalogo.preco,
        recorrente: catalogo.recorrente,
      }}
    >

      {/* ── Titular ─────────────────────────────────────────────────── */}
      <DarkCard accent>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${D.brass} 0%, rgba(122,31,43,0.8) 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
            color: D.bg, userSelect: "none",
          }}>
            {iniciaisNome}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 2 }}>
              Titular
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: D.ink, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cliente.nome_completo}
            </div>
            <div style={{ fontSize: 11, color: D.inkFaint, marginTop: 2 }}>
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
        <DarkConfirmButtons
          value={enderecoOk}
          onChange={setEnderecoOk}
          labelSim="É o mesmo"
          labelNao="Mudou"
        />
        {enderecoOk === "nao" && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <DarkInput placeholder="CEP" value={novoCep} onChange={setNovoCep} />
            <DarkInput placeholder="Estado (UF)" value={novoEstado} onChange={(v) => setNovoEstado(v.toUpperCase())} maxLength={2} />
            <DarkInput placeholder="Rua / Avenida" value={novoEndereco} onChange={(v) => setNovoEndereco(v.toUpperCase())} colSpan={2} />
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
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: D.inkFaint, marginBottom: 2 }}>Estado civil</div>
              {cliente.estado_civil || "—"}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: D.inkFaint, marginBottom: 2 }}>Profissão</div>
              {cliente.profissao || "—"}
            </div>
          </div>
        </DataRow>
        <DarkConfirmButtons
          value={dadosOk}
          onChange={setDadosOk}
          labelSim="Não mudou"
          labelNao="Mudou algo"
        />
        {dadosOk === "nao" && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              value={novoEstadoCivil}
              onChange={(e) => setNovoEstadoCivil(e.target.value)}
              style={{
                height: 36, padding: "0 12px",
                fontSize: 12, textTransform: "uppercase",
                background: D.paper2, border: `1px solid ${D.border}`,
                borderRadius: 8, color: D.inkSoft, outline: "none",
              }}
            >
              <option value="">Estado civil (manter o atual se vazio)</option>
              {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
            </select>
            <DarkInput
              placeholder="Profissão (manter atual se vazio)"
              value={novaProfissao}
              onChange={(v) => setNovaProfissao(v.toUpperCase())}
              colSpan={2}
            />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {docsReaproveitados.slice(0, 8).map((d) => (
              <div key={d} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: D.successAlpha, border: `1px solid ${D.successBorder}`,
                borderRadius: 8, padding: "8px 12px",
              }}>
                <CheckCircle2 size={14} color={D.success} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: D.success }}>
                  {d}
                </span>
              </div>
            ))}
            {docsReaproveitados.length > 8 && (
              <span style={{ fontSize: 10, color: D.inkFaint, padding: "0 4px" }}>
                +{docsReaproveitados.length - 8} outros documentos disponíveis.
              </span>
            )}
          </div>
        )}
      </DarkCard>

      {/* ── 4. Valor do serviço ──────────────────────────────────────── */}
      <DarkCard accent>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: D.brassAlpha, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BadgeDollarSign size={13} color={D.brass} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint }}>
            Valor do serviço
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 4 }}>Total</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: D.ink, lineHeight: 1 }}>
              {valorNumerico > 0
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
                : "—"}
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
            color: D.success, background: D.successAlpha, border: `1px solid ${D.successBorder}`,
            borderRadius: 99, padding: "3px 10px",
          }}>
            Preço oficial
          </span>
        </div>
        <p style={{ fontSize: 11, color: D.inkFaint, marginTop: 10, lineHeight: 1.6 }}>
          Pagamento via PIX, boleto ou cartão na próxima etapa. Processo iniciado após confirmação.
        </p>
      </DarkCard>

      {/* ── 5. Contrato e aceite ─────────────────────────────────────── */}
      <DarkCard>
        <SectionLabel
          n={5} done={aceiteContrato} icon={FileSignature} label="Contrato e aceite"
          statusLabel={aceiteContrato ? "Aceito" : undefined}
          statusType="ok"
        />
        <DataRow>
          <p style={{ margin: 0, lineHeight: 1.7, color: D.inkSoft }}>
            Ao avançar para o pagamento você declara que leu e concorda com os
            {" "}
            <a
              href="/termos-de-servico"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: D.brass, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
            >
              Termos de Serviço
              <ExternalLink size={10} />
            </a>
            {" "}e a{" "}
            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: D.brass, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}
            >
              Política de Privacidade
              <ExternalLink size={10} />
            </a>
            {" "}da Quero Armas. O aceite eletrônico possui validade jurídica conforme a{" "}
            Lei n.º 14.063/2020.
          </p>
        </DataRow>
        <label
          htmlFor="aceite-contrato"
          style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            marginTop: 12, cursor: "pointer",
            background: aceiteContrato ? D.successAlpha : D.brassAlpha,
            border: `1.5px solid ${aceiteContrato ? D.successBorder : D.borderAccent}`,
            borderRadius: 10, padding: "12px 14px",
            transition: "all .2s",
          }}
        >
          <div
            id="aceite-contrato"
            role="checkbox"
            aria-checked={aceiteContrato}
            tabIndex={0}
            onClick={() => setAceiteContrato((v) => !v)}
            onKeyDown={(e) => e.key === " " && setAceiteContrato((v) => !v)}
            style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: aceiteContrato ? D.brass : "transparent",
              border: `2px solid ${aceiteContrato ? D.brass : D.borderAccent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all .15s",
            }}
          >
            {aceiteContrato && <Check size={12} color={D.bg} />}
          </div>
          <span style={{ fontSize: 12, color: aceiteContrato ? D.success : D.inkSoft, lineHeight: 1.6, userSelect: "none" }}>
            <strong style={{ color: aceiteContrato ? D.success : D.ink }}>Li e aceito</strong> os Termos de Serviço e a Política de Privacidade da Quero Armas. Estou ciente de que o processo será iniciado após a confirmação do pagamento.
          </span>
        </label>
      </DarkCard>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <button
        disabled={!podeConfirmar}
        onClick={handleConfirmar}
        style={{
          width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "16px 24px", borderRadius: 14, border: "none", cursor: podeConfirmar ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
          background: podeConfirmar ? D.brass : D.paper2,
          color: podeConfirmar ? D.bg : D.inkFaint,
          boxShadow: podeConfirmar ? `0 6px 24px rgba(214,166,75,0.25)` : "none",
          transition: "all .2s",
        }}
      >
        {submitting
          ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          : <Sparkles size={18} />}
        {submitting ? "Processando…" : "Ir para pagamento"}
        {!submitting && <ChevronRight size={18} />}
      </button>

      {!aceiteContrato && (enderecoOk !== null || dadosOk !== null) && (
        <p style={{ textAlign: "center", fontSize: 10, color: D.inkFaint, marginTop: -4 }}>
          Aceite o contrato acima para continuar
        </p>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </CheckoutShell>
  );
}
