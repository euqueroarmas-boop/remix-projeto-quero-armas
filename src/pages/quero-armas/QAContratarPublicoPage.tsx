import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import "@/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css";
import { KanbanPageHeader, KanbanCard, KanbanTag } from "@/components/quero-armas/contratar/KanbanUI";

/**
 * QAContratarPublicoPage — Visitante NÃO logado solicita uma contratação.
 *
 * Fase 16-E:
 *  - NÃO cria processo, NÃO confirma pagamento, NÃO explode checklist.
 *  - Cria venda pendente em qa_vendas via edge function `qa-contratar-publico`.
 *  - Se CPF não existir em qa_clientes, cria cadastro com status
 *    `cadastro_em_preenchimento` (acesso pleno só na Fase 17).
 *  - Se CPF existir e tiver auth, instrui login.
 */

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskTel(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 40, padding: "0 12px", fontSize: 13,
  background: "var(--qa-ref-paper)", border: "1px solid var(--qa-ref-border)",
  borderRadius: 8, color: "var(--qa-ref-ink)", outline: "none", boxSizing: "border-box",
};

export default function QAContratarPublicoPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [servicoNome, setServicoNome] = useState<string>("");
  const [done, setDone] = useState<{ vendaId?: number; jaExistia?: boolean } | null>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        // Se logou no meio do caminho, pula para confirmação
        navigate(`/area-do-cliente/contratar/${slug}/confirmar`, { replace: true });
        return;
      }
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("nome")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      setServicoNome((data as any)?.nome ?? slug);
      setLoading(false);
    })();
  }, [slug, navigate]);

  const valorNumerico = useMemo(() => {
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [valor]);

  const cpfValido = cpf.replace(/\D/g, "").length === 11;
  const telValido = telefone.replace(/\D/g, "").length >= 10;
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const podeEnviar =
    nome.trim().length >= 3 &&
    cpfValido &&
    emailValido &&
    telValido &&
    valorNumerico > 0 &&
    !submitting;

  async function enviar() {
    if (!podeEnviar) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contratar-publico", {
        body: {
          catalogo_slug: slug,
          nome_completo: nome.trim().toUpperCase(),
          cpf: cpf.replace(/\D/g, ""),
          email: email.trim().toLowerCase(),
          telefone: telefone.replace(/\D/g, ""),
          valor_informado: valorNumerico,
          observacoes: obs.trim() || null,
        },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.precisa_login) {
        toast.message("Já existe cadastro com este CPF. Entre para contratar.");
        const next = encodeURIComponent(`/area-do-cliente/contratar/${slug}/confirmar`);
        navigate(`/area-do-cliente/login?next=${next}`);
        return;
      }
      if (res?.requires_recadastramento) {
        toast.error(
          "Seu cadastro precisa ser atualizado antes de contratar novo serviço.",
        );
        const next = encodeURIComponent(`/area-do-cliente/contratar/${slug}/confirmar`);
        navigate(`/area-do-cliente/login?next=${next}&recad=1`);
        return;
      }
      if (res?.needs_manual_review) {
        toast.error(
          "Encontramos mais de um cadastro com seu CPF. Nossa equipe vai resolver e entrar em contato.",
        );
        return;
      }
      if (res?.error) throw new Error(res.error);
      setDone({ vendaId: res?.venda_id, jaExistia: !!res?.ja_existia });
    } catch (e: any) {
      console.error("[contratar-publico]", e);
      toast.error(e?.message || "Não foi possível enviar sua contratação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="qa-refinado" style={{ minHeight: "100vh", background: "var(--qa-ref-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={22} color="var(--qa-ref-accent)" className="animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="qa-refinado" style={{ minHeight: "100vh", background: "var(--qa-ref-bg)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "60px 20px" }}>
          <KanbanCard>
            <div style={{ textAlign: "center", padding: "12px 8px" }}>
              <CheckCircle2 size={44} color="var(--qa-ref-success)" style={{ margin: "0 auto 10px" }} />
              <h1 style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", color: "var(--qa-ref-ink)", margin: 0 }}>
                {done.jaExistia ? "Contratação já estava em fila" : "Contratação recebida"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--qa-ref-ink-soft)", marginTop: 10, lineHeight: 1.6 }}>
                Sua solicitação para <strong style={{ color: "var(--qa-ref-ink)", textTransform: "uppercase" }}>{servicoNome}</strong> foi
                registrada. A Equipe Quero Armas irá <strong>validar o valor</strong> e entrar em contato com você nas próximas horas.
              </p>
              <p style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)", marginTop: 10 }}>
                Nenhuma cobrança foi gerada. Nenhum processo foi aberto ainda.
              </p>
              <button
                onClick={() => navigate("/area-do-cliente/contratar")}
                style={{
                  marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "var(--qa-ref-accent)", color: "#1a1206",
                  fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                }}
              >
                Voltar ao catálogo
              </button>
            </div>
          </KanbanCard>
        </div>
      </div>
    );
  }

  return (
    <div className="qa-refinado" style={{ minHeight: "100vh", background: "var(--qa-ref-bg)" }}>
      <KanbanPageHeader
        crumb="Quero Armas · Contratar"
        title="Seus dados de contato"
        meta={<span>Serviço selecionado: <strong style={{ color: "var(--qa-ref-ink)" }}>{servicoNome}</strong></span>}
        onBack={() => navigate(`/area-do-cliente/contratar/${slug}/identificar`)}
      />

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        <KanbanCard>
          <KanbanTag>Identificação</KanbanTag>
          <p style={{ fontSize: 11.5, color: "var(--qa-ref-ink-soft)", margin: "4px 0 8px" }}>
            Preencha com atenção — usaremos para identificar sua contratação.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              style={{ ...inputStyle, textTransform: "uppercase" }}
            />
            <input
              placeholder="CPF"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              inputMode="numeric"
              style={inputStyle}
            />
            <input
              placeholder="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Celular com DDD"
              value={telefone}
              onChange={(e) => setTelefone(maskTel(e.target.value))}
              inputMode="tel"
              style={inputStyle}
            />
          </div>
        </KanbanCard>

        <KanbanCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DollarSign size={14} color="var(--qa-ref-accent)" />
            <KanbanTag tone="accent">Valor combinado</KanbanTag>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--qa-ref-ink-soft)", margin: "4px 0 8px", lineHeight: 1.5 }}>
            Informe o valor combinado com a Quero Armas. Será <strong style={{ color: "var(--qa-ref-ink)" }}>validado pela
            Equipe Quero Armas</strong> antes de virar processo.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--qa-ref-ink-soft)" }}>R$</span>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^0-9,.]/g, ""))}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <textarea
            rows={2}
            placeholder="Observações para a equipe (opcional)"
            value={obs}
            onChange={(e) => setObs(e.target.value.toUpperCase())}
            style={{
              marginTop: 8, width: "100%", padding: "10px 12px", fontSize: 12, textTransform: "uppercase",
              background: "var(--qa-ref-paper)", border: "1px solid var(--qa-ref-border)",
              borderRadius: 8, color: "var(--qa-ref-ink)", outline: "none", boxSizing: "border-box",
              resize: "vertical", fontFamily: "inherit",
            }}
          />
        </KanbanCard>

        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", borderRadius: 10,
          background: "var(--qa-ref-accent-soft)", border: "1px solid var(--qa-ref-accent-strong)",
          fontSize: 11, color: "var(--qa-ref-accent)", lineHeight: 1.6,
        }}>
          <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0 }}>
            Sem cobrança automática. Sua contratação ficará <strong>aguardando validação</strong> da
            Equipe Quero Armas. Após validar o valor, geraremos seu processo.
          </p>
        </div>

        <p style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)", lineHeight: 1.6 }}>
          Seu processo começa após a confirmação do pagamento. Você receberá acesso ao
          portal para acompanhar documentos, etapas e próximos passos.
        </p>

        <button
          disabled={!podeEnviar}
          onClick={enviar}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 18px", borderRadius: 12, border: "none",
            cursor: podeEnviar ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
            background: podeEnviar ? "var(--qa-ref-accent)" : "var(--qa-ref-paper-2)",
            color: podeEnviar ? "#1a1206" : "var(--qa-ref-ink-soft)",
          }}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Avançar para confirmação
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
