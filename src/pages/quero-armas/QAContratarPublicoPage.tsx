import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

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
      <div data-tactical-portal className="min-h-screen qa-resumo-light flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div data-tactical-portal className="min-h-screen">
        <div className="qa-resumo-light min-h-screen">
          <div className="max-w-xl mx-auto px-4 py-10">
            <div className="rounded-2xl bg-white border border-emerald-200 p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-slate-900 uppercase">
                {done.jaExistia ? "Contratação já estava em fila" : "Contratação recebida"}
              </h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Sua solicitação para <strong className="uppercase">{servicoNome}</strong> foi
                registrada. A Equipe Operacional da Quero Armas irá <strong>validar o valor</strong>
                {" "}e entrar em contato com você nas próximas horas.
              </p>
              <p className="text-[11px] text-slate-500 mt-3">
                Nenhuma cobrança foi gerada. Nenhum processo foi aberto ainda.
              </p>
              <button
                onClick={() => navigate("/area-do-cliente/contratar")}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-[12px] font-bold uppercase tracking-wider hover:bg-amber-600"
              >
                Voltar ao catálogo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-tactical-portal className="min-h-screen">
      <div className="qa-resumo-light">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 bg-white sticky top-0 z-10">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <button
              onClick={() => navigate(`/area-do-cliente/contratar/${slug}/identificar`)}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-tight">
                Solicitar contratação
              </h1>
              <p className="text-[11px] md:text-xs text-slate-500 mt-0.5 truncate">
                Serviço: <strong className="text-slate-700">{servicoNome}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 py-5 space-y-3">
          <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
            <input
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              className="w-full h-10 px-3 text-sm uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
            />
            <input
              placeholder="CPF"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              inputMode="numeric"
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
            />
            <input
              placeholder="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
            />
            <input
              placeholder="Celular com DDD"
              value={telefone}
              onChange={(e) => setTelefone(maskTel(e.target.value))}
              inputMode="tel"
              className="w-full h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase">Valor combinado</h2>
            </div>
            <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
              Informe o valor combinado com a Quero Armas. Será <strong>validado pela
              Equipe Operacional</strong> antes de virar processo.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-slate-700">R$</span>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^0-9,.]/g, ""))}
                className="flex-1 h-10 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Observações para a equipe (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value.toUpperCase())}
              className="mt-2 w-full px-3 py-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Sem cobrança automática. Sua contratação ficará <strong>aguardando validação</strong>
              {" "}da Equipe Operacional. Após validar o valor, geraremos seu processo.
            </p>
          </div>

          <button
            disabled={!podeEnviar}
            onClick={enviar}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition ${
              podeEnviar
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Enviar contratação
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}