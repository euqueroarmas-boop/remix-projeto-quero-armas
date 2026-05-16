import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  onReset: () => void;
}

export default function Etapa05Conclusao({ state, onReset }: Props) {
  const navigate = useNavigate();
  const r = state.resultado || {};
  const primeiroNome = (state.dadosPessoais.nome_completo || "").split(" ")[0] || "tudo certo";
  const [baixando, setBaixando] = useState(false);
  const [erroBaixar, setErroBaixar] = useState<string | null>(null);

  async function handleBaixarContrato() {
    setErroBaixar(null);
    setBaixando(true);
    try {
      const baseQuery: any = supabase
        .from("qa_contracts")
        .select("conteudo_renderizado, aceite_eletronico_data, aceite_ip, aceite_user_agent, aceite_hash, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const filtered = r.venda_id
        ? baseQuery.eq("venda_id", r.venda_id)
        : r.cliente_id
          ? baseQuery.eq("cliente_id", r.cliente_id)
          : baseQuery;
      const { data, error } = await filtered.maybeSingle();
      if (error) throw error;
      if (!data?.conteudo_renderizado) {
        setErroBaixar("Contrato ainda não disponível para download. Tente novamente em instantes.");
        return;
      }
      const w = window.open("", "_blank", "width=900,height=1100");
      if (!w) return;
      const hoje = new Date().toLocaleString("pt-BR");
      const rodape = `Documento gerado em ${hoje}. Aceite eletrônico registrado em ${data.aceite_eletronico_data || "—"}, IP ${data.aceite_ip || "—"}, dispositivo ${data.aceite_user_agent || "—"}, hash de integridade ${data.aceite_hash || "—"}. Status atual: ${data.status || "—"}.`;
      w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato — Quero Armas</title>
        <style>
          body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;}
          h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;}
          h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
          p{margin:10px 0;text-align:justify;} ul,ol{padding-left:22px;} li{margin:6px 0;}
          .qa-rodape-probatorio{margin-top:36px;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.2);font-size:10.5px;color:#4a4a4a;text-align:left;}
          @media print { body{margin:0;} }
        </style></head><body>${data.conteudo_renderizado}<div class="qa-rodape-probatorio">${rodape}</div></body></html>`);
      w.document.close();
      setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
    } catch (e: any) {
      setErroBaixar(e?.message || "Não foi possível baixar o contrato agora.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <QACadastroRefinadoShell
      step={5}
      eyebrow="ETAPA 05 · CONCLUSÃO"
      title={`Tudo certo, ${primeiroNome}`}
      subtitle="Sua contratação foi registrada. Em instantes você receberá os próximos passos por e-mail e WhatsApp."
      showBack={false}
    >
      <div style={{ textAlign: "center" }}>
        <div className="qa-ref-check"><Check size={28} /></div>
      </div>

      <dl className="qa-ref-ficha">
        <div className="qa-ref-ficha-row">
          <dt>Serviço</dt>
          <dd>{state.servicoSlug || "—"}</dd>
        </div>
        {r.numero_processo && (
          <div className="qa-ref-ficha-row">
            <dt>Processo</dt>
            <dd className="qa-ref-mono">{r.numero_processo}</dd>
          </div>
        )}
        <div className="qa-ref-ficha-row">
          <dt>Pagamento</dt>
          <dd>{state.formaPagamento.toUpperCase()}</dd>
        </div>
        <div className="qa-ref-ficha-row">
          <dt>Status</dt>
          <dd>Aguardando confirmação</dd>
        </div>
      </dl>

      <div className="qa-ref-banner" style={{ marginTop: 20 }}>
        <div>
          <strong>Acesso enviado</strong> — verifique seu e-mail e WhatsApp para entrar no Arsenal Inteligente e acompanhar tudo em tempo real.
        </div>
      </div>

      <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
        <button
          className="qa-ref-btn qa-ref-btn-primary"
          onClick={() => { onReset(); navigate("/area-do-cliente"); }}
        >
          Acessar meu Arsenal
        </button>
        {state.clienteExistente ? (
          <>
            <button className="qa-ref-btn qa-ref-btn-ghost" onClick={() => navigate("/area-do-cliente/login")}>
              Fazer login
            </button>
            <button
              className="qa-ref-btn-link"
              type="button"
              style={{ display: "block", textAlign: "center" }}
              onClick={() => navigate("/redefinir-senha")}
            >
              Esqueci minha senha
            </button>
          </>
        ) : (
          <button
            className="qa-ref-btn qa-ref-btn-ghost"
            type="button"
            disabled={baixando}
            onClick={handleBaixarContrato}
          >
            {baixando ? "Preparando…" : "Baixar contrato assinado"}
          </button>
        )}
        {erroBaixar && <div className="qa-ref-error-text">{erroBaixar}</div>}
      </div>
    </QACadastroRefinadoShell>
  );
}