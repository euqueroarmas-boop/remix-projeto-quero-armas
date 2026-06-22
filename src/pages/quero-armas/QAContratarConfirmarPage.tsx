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
import "@/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css";
import { KanbanPageHeader, KanbanTag, KanbanCardFooter } from "@/components/quero-armas/contratar/KanbanUI";
import { fetchChecklistEtapa02 } from "@/lib/quero-armas/etapa02Checklist";
import { useCart } from "@/shared/cart/CartProvider";

/* =============================================================================
 * Visual dark premium (.qa-refinado) — mesma paleta do checkout guiado em
 * /cadastro, com a linguagem de cards de ResumoClienteKanbanMockPage
 * (tag, rodapé com status/avatar). Lógica de negócio (recadastramento,
 * confirmação de dados/endereço, registro de aceite) inalterada.
 * ============================================================================= */

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

/* ── Primitivos de UI (dark premium qa-refinado) ─────────────────────────── */

function SectionCard({ children, accentLine = false, glowWhenIncomplete = false, complete = true }: {
  children: React.ReactNode; accentLine?: boolean; glowWhenIncomplete?: boolean; complete?: boolean;
}) {
  const glow = glowWhenIncomplete && !complete;
  return (
    <div style={{
      background: "var(--qa-ref-paper)",
      border: `0.5px solid ${glow ? "var(--qa-ref-accent-strong)" : "var(--qa-ref-border)"}`,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: glow ? "0 0 20px var(--qa-ref-accent-soft)" : "none",
    }}>
      {accentLine && <div style={{ height: 3, background: "var(--qa-ref-accent)" }} />}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function SectionLabel({ n, done, icon: Icon, label, statusLabel, statusTone }: {
  n: number; done: boolean; icon: any; label: string;
  statusLabel?: string; statusTone?: "ok" | "accent";
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800,
        background: done ? "var(--qa-ref-accent)" : "var(--qa-ref-accent-soft)",
        border: `2px solid ${done ? "var(--qa-ref-accent)" : "var(--qa-ref-accent-strong)"}`,
        color: done ? "#1a1206" : "var(--qa-ref-accent)",
      }}>
        {done ? <Check size={13} /> : n}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: "var(--qa-ref-accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} color="var(--qa-ref-accent)" />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.07em", color: "var(--qa-ref-ink)",
        }}>
          {label}
        </span>
      </div>
      {statusLabel && <KanbanTag tone={statusTone === "ok" ? "ok" : "accent"}>{statusLabel}</KanbanTag>}
    </div>
  );
}

function DataRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--qa-ref-paper-2)", border: "0.5px solid var(--qa-ref-border-soft)",
      borderRadius: 8, padding: "10px 14px",
      fontSize: 13, color: "var(--qa-ref-ink-soft)", lineHeight: 1.7,
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
            background: isSelected ? (isOk ? "var(--qa-ref-success-soft)" : "var(--qa-ref-accent-soft)") : "var(--qa-ref-paper-2)",
            border: `2px solid ${isSelected ? (isOk ? "var(--qa-ref-success)" : "var(--qa-ref-accent-strong)") : "var(--qa-ref-border-soft)"}`,
            color: isSelected ? (isOk ? "var(--qa-ref-success)" : "var(--qa-ref-accent)") : "var(--qa-ref-ink-soft)",
          }}>
            {isSelected && (
              <CheckCircle2 size={14} color={isOk ? "var(--qa-ref-success)" : "var(--qa-ref-accent)"}
                style={{ position: "absolute", top: 8, right: 8 }} />
            )}
            {isOk
              ? <Check size={16} color={isSelected ? "var(--qa-ref-success)" : "var(--qa-ref-ink-soft)"} />
              : <Pencil size={16} color={isSelected ? "var(--qa-ref-accent)" : "var(--qa-ref-ink-soft)"} />
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
        background: "var(--qa-ref-paper-2)",
        border: `1.5px solid ${focused ? "var(--qa-ref-accent)" : "var(--qa-ref-border)"}`,
        borderRadius: 8, color: "var(--qa-ref-ink)", outline: "none", width: "100%", boxSizing: "border-box",
        boxShadow: focused ? "0 0 0 3px var(--qa-ref-accent-soft)" : "none",
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
      <div className="qa-refinado" style={{ background: "var(--qa-ref-bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} color="var(--qa-ref-accent)" className="animate-spin" />
      </div>
    );
  }

  if (!catalogo || !cliente) return null;

  /* ── Bloqueio legacy ───────────────────────────────────────────────────── */
  if (legadoBlock) {
    const waLink = "https://wa.me/5562994040220?text=" +
      encodeURIComponent(`Olá! Sou cliente antigo da Quero Armas (CPF ${cliente.cpf || "—"}) e quero atualizar meu cadastro para contratar o serviço ${catalogo.nome}.`);
    return (
      <div className="qa-refinado" style={{ background: "var(--qa-ref-bg)", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ background: "var(--qa-ref-paper)", border: "0.5px solid var(--qa-ref-error)", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(185,74,72,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={20} color="var(--qa-ref-error)" />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--qa-ref-ink)", marginBottom: 8 }}>
                  Recadastramento obrigatório
                </h1>
                <p style={{ fontSize: 13, color: "var(--qa-ref-ink-soft)", lineHeight: 1.7, margin: 0 }}>
                  Seu cadastro veio do sistema antigo da Quero Armas. Para comprar um novo serviço, precisamos atualizar seus documentos no sistema novo.
                </p>
                <p style={{ fontSize: 10, color: "var(--qa-ref-ink-soft)", marginTop: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Status: {legadoBlock.homologacao_status || "pendente"} · Recadastramento: {legadoBlock.recadastramento_status || "—"}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => navigate("/area-do-cliente?secao=arsenal")}
                style={{ padding: "12px 16px", borderRadius: 10, background: "var(--qa-ref-accent)", color: "#1a1206", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: "none", cursor: "pointer", width: "100%" }}>
                Enviar documentos agora
              </button>
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", padding: "12px 16px", borderRadius: 10, background: "#22a559", color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textDecoration: "none" }}>
                Falar com a Equipe Quero Armas
              </a>
              <button type="button" onClick={() => navigate("/area-do-cliente")}
                style={{ padding: "12px 16px", borderRadius: 10, background: "var(--qa-ref-paper-2)", color: "var(--qa-ref-ink-soft)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: "0.5px solid var(--qa-ref-border)", cursor: "pointer", width: "100%" }}>
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
    <div className="qa-refinado" style={{ background: "var(--qa-ref-bg)", minHeight: "100vh" }}>
      <style>{`
        .qa-addr-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 12px; }
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

      <KanbanPageHeader
        crumb="Quero Armas · Contratar"
        title="Confirmar contratação"
        meta={
          <>
            <span><strong style={{ color: "var(--qa-ref-ink)" }}>{catalogo.nome}</strong></span>
            {catalogo.preco != null && (
              <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(catalogo.preco)}</span>
            )}
          </>
        }
        onBack={() => navigate("/area-do-cliente/contratar")}
      />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Titular ─────────────────────────────────────────────────── */}
        <SectionCard accentLine>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: "var(--qa-ref-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em",
              color: "#1a1206", userSelect: "none",
            }}>
              {iniciaisNome}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--qa-ref-ink-soft)", marginBottom: 3 }}>
                Titular
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--qa-ref-ink)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cliente.nome_completo}
              </div>
              <div style={{ fontSize: 12, color: "var(--qa-ref-ink-soft)", marginTop: 3 }}>
                CPF {cliente.cpf || "—"} · {cliente.email || "sem e-mail"}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── 1. Endereço ─────────────────────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            n={1} done={enderecoOk !== null} icon={MapPin} label="Endereço"
            statusLabel={enderecoOk === "sim" ? "Confirmado" : enderecoOk === "nao" ? "Atualizar" : undefined}
            statusTone={enderecoOk === "sim" ? "ok" : "accent"}
          />
          <DataRow>
            {enderecoAtualLinha || <span style={{ fontStyle: "italic" }}>Sem endereço cadastrado.</span>}
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
        </SectionCard>

        {/* ── 2. Estado civil e profissão ─────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            n={2} done={dadosOk !== null} icon={User} label="Estado civil e profissão"
            statusLabel={dadosOk === "sim" ? "Confirmado" : dadosOk === "nao" ? "Atualizar" : undefined}
            statusTone={dadosOk === "sim" ? "ok" : "accent"}
          />
          <DataRow>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--qa-ref-ink-soft)", marginBottom: 2 }}>Estado civil</div>
                <span style={{ color: "var(--qa-ref-ink)" }}>{cliente.estado_civil || "—"}</span>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--qa-ref-ink-soft)", marginBottom: 2 }}>Profissão</div>
                <span style={{ color: "var(--qa-ref-ink)" }}>{cliente.profissao || "—"}</span>
              </div>
            </div>
          </DataRow>
          <DarkConfirmButtons value={dadosOk} onChange={setDadosOk} labelSim="Não mudou" labelNao="Mudou algo" />
          {dadosOk === "nao" && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <select value={novoEstadoCivil} onChange={(e) => setNovoEstadoCivil(e.target.value)}
                style={{ height: 40, padding: "0 14px", fontSize: 12, textTransform: "uppercase", background: "var(--qa-ref-paper-2)", border: "1.5px solid var(--qa-ref-border)", borderRadius: 8, color: "var(--qa-ref-ink-soft)", outline: "none", width: "100%" }}>
                <option value="">Estado civil (manter o atual se vazio)</option>
                {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
              </select>
              <DarkInput placeholder="Profissão (manter atual se vazio)" value={novaProfissao} onChange={(v) => setNovaProfissao(v.toUpperCase())} wide />
            </div>
          )}
        </SectionCard>

        {/* ── 3. Documentos reaproveitados ────────────────────────────── */}
        <SectionCard>
          <SectionLabel
            n={3} done icon={FileCheck2} label="Documentos reaproveitados"
            statusLabel={docsReaproveitados.length > 0 ? `${docsReaproveitados.length} doc${docsReaproveitados.length > 1 ? "s" : ""}` : undefined}
            statusTone="ok"
          />
          {docsReaproveitados.length === 0 ? (
            <DataRow>
              <span style={{ fontStyle: "italic" }}>
                Nenhum documento prévio validado — você enviará todos no processo novo.
              </span>
            </DataRow>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docsReaproveitados.slice(0, 8).map((d) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--qa-ref-success-soft)", border: "1px solid var(--qa-ref-success)", borderRadius: 8, padding: "9px 14px" }}>
                  <CheckCircle2 size={15} color="var(--qa-ref-success)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--qa-ref-success)" }}>{d}</span>
                </div>
              ))}
              {docsReaproveitados.length > 8 && (
                <span style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)", padding: "0 4px" }}>
                  +{docsReaproveitados.length - 8} outros documentos disponíveis.
                </span>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── 4. Valor do serviço ──────────────────────────────────────── */}
        <SectionCard accentLine>
          <SectionLabel n={4} done={valorNumerico > 0} icon={BadgeDollarSign} label="Valor do serviço" />
          <KanbanCardFooter
            left={
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--qa-ref-ink-soft)", marginBottom: 6 }}>Total</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--qa-ref-ink)", lineHeight: 1, fontFamily: "var(--font-serif, Georgia, serif)" }}>
                  {valorNumerico > 0
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
                    : "—"}
                </div>
              </div>
            }
            right={<KanbanTag tone="ok">Preço oficial</KanbanTag>}
          />
          <p style={{ fontSize: 12, color: "var(--qa-ref-ink-soft)", marginTop: 12, lineHeight: 1.6 }}>
            Pagamento via PIX, boleto ou cartão na próxima etapa. Processo iniciado após confirmação.
          </p>
        </SectionCard>

        {/* ── 5. Contrato e aceite ─────────────────────────────────────── */}
        <SectionCard glowWhenIncomplete complete={aceiteContrato}>
          <SectionLabel
            n={5} done={aceiteContrato} icon={FileSignature} label="Contrato e aceite"
            statusLabel={aceiteContrato ? "Aceito ✓" : "Obrigatório"}
            statusTone={aceiteContrato ? "ok" : "accent"}
          />

          {/* A leitura e o aceite do contrato completo (acordeão por cláusula
              + resumo) acontecem na etapa de Contrato e Pagamento, em
              /checkout/finalizar, igual ao fluxo de quem não está logado.
              Não duplicamos a exibição aqui. */}
          <p style={{ fontSize: 12, color: "var(--qa-ref-ink-soft)", lineHeight: 1.7, marginBottom: 14 }}>
            Você vai revisar e aceitar o contrato de adesão de serviços completo na etapa de pagamento. Ao confirmar aqui, você concorda com os{" "}
            <a href="/termos" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--qa-ref-accent)", textDecoration: "none", borderBottom: "1px solid var(--qa-ref-accent-strong)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              Termos de Serviço <ExternalLink size={10} />
            </a>
            {" "}e a{" "}
            <a href="/privacidade" target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--qa-ref-accent)", textDecoration: "none", borderBottom: "1px solid var(--qa-ref-accent-strong)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              Política de Privacidade <ExternalLink size={10} />
            </a>
            {" "}da Quero Armas. O aceite eletrônico possui validade jurídica conforme a Lei n.º 14.063/2020.
          </p>

          <button
            type="button"
            onClick={() => setAceiteContrato((v) => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "flex-start", gap: 14,
              cursor: "pointer", textAlign: "left",
              background: aceiteContrato ? "var(--qa-ref-success-soft)" : "var(--qa-ref-accent-soft)",
              border: `2px solid ${aceiteContrato ? "var(--qa-ref-success)" : "var(--qa-ref-accent-strong)"}`,
              borderRadius: 12, padding: "14px 16px",
              transition: "all .25s",
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: aceiteContrato ? "var(--qa-ref-success)" : "transparent",
              border: `2px solid ${aceiteContrato ? "var(--qa-ref-success)" : "var(--qa-ref-accent)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .2s",
            }}>
              {aceiteContrato && <Check size={13} color="#fff" />}
            </div>
            <span style={{ fontSize: 13, color: aceiteContrato ? "var(--qa-ref-success)" : "var(--qa-ref-ink-soft)", lineHeight: 1.65, flex: 1 }}>
              <strong style={{ color: aceiteContrato ? "var(--qa-ref-success)" : "var(--qa-ref-ink)" }}>Li e aceito</strong>{" "}
              os Termos de Serviço e a Política de Privacidade da Quero Armas.
              Estou ciente de que o processo será iniciado após a confirmação do pagamento.
            </span>
          </button>
        </SectionCard>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <button
          type="button"
          disabled={!podeConfirmar}
          onClick={handleConfirmar}
          style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 24px", borderRadius: 14, border: "none",
            cursor: podeConfirmar ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
            background: podeConfirmar ? "var(--qa-ref-accent)" : "var(--qa-ref-paper-2)",
            color: podeConfirmar ? "#1a1206" : "var(--qa-ref-ink-soft)",
            transition: "all .25s",
          }}
        >
          {submitting
            ? <Loader2 size={20} className="animate-spin" />
            : <Sparkles size={20} />}
          {submitting ? "Processando…" : "Ir para pagamento"}
          {!submitting && <ChevronRight size={20} />}
        </button>

        {!aceiteContrato && (enderecoOk !== null || dadosOk !== null) && (
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--qa-ref-accent)", marginTop: -6, opacity: 0.9 }}>
            Aceite o contrato acima para liberar o pagamento
          </p>
        )}
      </div>
    </div>
  );
}
