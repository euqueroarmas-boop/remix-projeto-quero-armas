// ============================================================================
// ClubeFiliacaoStep
// ----------------------------------------------------------------------------
// Etapa composta do Wizard KYC dedicada ao bloco "Clube de tiro e filiação".
// Substitui as 7 perguntas isoladas (nome_clube, cnpj_clube, numero_cr_clube,
// data_cr_clube, endereco_clube, numero_filiacao, validade_filiacao) por um
// fluxo único:
//   1. Buscar clube no catálogo qa_clubes (cliente só seleciona)
//   2. Informar filiação (upload de declaração ou manual)
//   3. Revisar antes de confirmar
// Gravação SEMPRE via edge qa-clube-sugerir (service role).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Edit3, Loader2, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ClubeSearchCombobox, { ClubeRow } from "./ClubeSearchCombobox";
import DeclaracaoFiliacaoUploader, { DeclaracaoExtraida } from "./DeclaracaoFiliacaoUploader";
import RevisaoCampos from "./RevisaoCampos";
import { ClubeFiliacaoFormState, EMPTY_FORM } from "./types";
import type { OverridesMap } from "@/lib/quero-armas/templatePlaceholderOverrides";

const MARROM = "#7A1F2B";

/**
 * Normaliza datas em vários formatos aceitos para ISO `YYYY-MM-DD`.
 * Retorna null se inválida.
 */
function normalizeDateInput(v: string): string | null {
  const t = (v || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d8 = t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (d8) return `${d8[3]}-${d8[2]}-${d8[1]}`;
  const y8 = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (y8) return `${y8[1]}-${y8[2]}-${y8[3]}`;
  return null;
}

function mensagemAmigavelErro(status: number | null, msg: string): string {
  if (status === 401 || status === 403) return "Não foi possível confirmar sua sessão. Entre novamente.";
  if (status === 400) return "Revise os dados preenchidos.";
  if (status === 404) return "Processo ou clube não encontrado.";
  if (status === 500) return "Não conseguimos salvar agora. A equipe já pode revisar o erro.";
  if (/failed to (send|fetch)|networkerror|load failed/i.test(msg)) {
    return "Não conseguimos conectar ao servidor. Tente novamente.";
  }
  return msg || "Não foi possível salvar agora.";
}

interface Props {
  processoId: string;
  clienteId: number;
  overrides?: OverridesMap;
  onConfirmed: () => void;
  onBack: () => void;
}

type SubPhase = "reuso" | "search" | "filiacao_mode" | "upload" | "manual" | "review";
type Origem = "catalogo" | "declaracao" | "manual";

interface ReuseSuggestion {
  processoId: string;
  templateData: Record<string, any>;
  criadoEm: string | null;
}

export default function ClubeFiliacaoStep({ processoId, clienteId, overrides, onConfirmed, onBack }: Props) {
  const [phase, setPhase] = useState<SubPhase>("search");

  // Texto editável pelo admin via qa_template_placeholder_config.
  const txt = (placeholder: string, field: "pergunta_cliente" | "label_cliente" | "texto_ajuda" | "exemplo_placeholder", fallback: string): string => {
    const ov = overrides?.[placeholder];
    const v = ov?.[field];
    return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
  };
  const [origem, setOrigem] = useState<Origem>("catalogo");
  const [clubeSelecionado, setClubeSelecionado] = useState<ClubeRow | null>(null);
  const [form, setForm] = useState<ClubeFiliacaoFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [reuse, setReuse] = useState<ReuseSuggestion | null>(null);
  const [divergencia, setDivergencia] = useState<{ campos: string[]; declaracao: ClubeFiliacaoFormState } | null>(null);
  const carregouRef = useRef(false);

  // -----------------------------------------------------------------
  // Reaproveitamento: dados de clube já usados em outro processo
  // -----------------------------------------------------------------
  useEffect(() => {
    if (carregouRef.current) return;
    carregouRef.current = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("qa_processos")
          .select("id, created_at, respostas_questionario_json")
          .eq("cliente_id", clienteId)
          .neq("id", processoId)
          .order("created_at", { ascending: false })
          .limit(10);
        const found = (data ?? []).find((r: any) => {
          const td = r?.respostas_questionario_json?.template_data;
          return td && typeof td === "object" && (td.nome_clube || td.numero_filiacao);
        });
        if (found) {
          const td = (found as any).respostas_questionario_json.template_data;
          if (td?.nome_clube || td?.numero_filiacao) {
            setReuse({
              processoId: (found as any).id,
              templateData: td,
              criadoEm: (found as any).created_at ?? null,
            });
            setPhase("reuso");
          }
        }
      } catch {
        /* opcional */
      }
    })();
  }, [clienteId, processoId]);

  // -----------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------
  const aceitarReuso = () => {
    if (!reuse) return;
    const td = reuse.templateData;
    setForm({
      nome_clube: (td.nome_clube || "").toString(),
      cnpj: (td.cnpj_clube || "").toString(),
      numero_cr: (td.numero_cr_clube || "").toString(),
      data_cr: (td.data_cr_clube || "").toString(),
      endereco: (td.endereco_clube || "").toString(),
      cidade: (td.cidade_clube || "").toString(),
      uf: (td.uf_clube || "").toString(),
      numero_filiacao: (td.numero_filiacao || "").toString(),
      validade_filiacao: (td.validade_filiacao || "").toString(),
    });
    setOrigem("manual");
    setPhase("review");
  };

  const selecionarClube = (c: ClubeRow) => {
    setClubeSelecionado(c);
    setForm((prev) => ({
      ...prev,
      nome_clube: c.nome_clube || "",
      cnpj: c.cnpj || "",
      numero_cr: c.numero_cr || "",
      data_cr: c.data_validade ? toBR(c.data_validade) : "",
      endereco: c.endereco || "",
      cidade: c.cidade || "",
      uf: c.estado || "",
    }));
    setOrigem("catalogo");
    setPhase("filiacao_mode");
  };

  const clubeNaoEncontrado = () => {
    setClubeSelecionado(null);
    setPhase("filiacao_mode");
    setOrigem("manual");
  };

  const aplicarDeclaracao = (dados: DeclaracaoExtraida) => {
    const c = dados.clube ?? {};
    const f = dados.filiacao ?? {};
    const declaracaoForm: ClubeFiliacaoFormState = {
      nome_clube: (c.nome || form.nome_clube || "").toUpperCase(),
      cnpj: c.cnpj || form.cnpj || "",
      numero_cr: c.numero_cr || form.numero_cr || "",
      data_cr: c.data_cr || form.data_cr || "",
      endereco: (c.endereco || form.endereco || "").toUpperCase(),
      cidade: (c.cidade || form.cidade || "").toUpperCase(),
      uf: (c.uf || form.uf || "").toUpperCase().slice(0, 2),
      numero_filiacao: f.numero || form.numero_filiacao || "",
      validade_filiacao: f.validade || form.validade_filiacao || "",
    };

    // Divergência com clube selecionado do catálogo verificado?
    if (clubeSelecionado) {
      const diffs: string[] = [];
      const norm = (v: string) => v.replace(/\D/g, "");
      if (clubeSelecionado.cnpj && declaracaoForm.cnpj && norm(clubeSelecionado.cnpj) !== norm(declaracaoForm.cnpj)) diffs.push("CNPJ");
      if (clubeSelecionado.numero_cr && declaracaoForm.numero_cr && clubeSelecionado.numero_cr !== declaracaoForm.numero_cr) diffs.push("Número CR");
      if (clubeSelecionado.nome_clube && declaracaoForm.nome_clube && clubeSelecionado.nome_clube.toUpperCase() !== declaracaoForm.nome_clube.toUpperCase()) diffs.push("Nome do clube");
      if (diffs.length > 0) {
        setDivergencia({ campos: diffs, declaracao: declaracaoForm });
        setOrigem("declaracao");
        setPhase("review");
        return;
      }
    }

    setForm(declaracaoForm);
    setOrigem("declaracao");
    setPhase("review");
  };

  // Resolução de divergência: A) catálogo, B) declaração, C) revisão equipe
  const resolverDivergencia = (escolha: "catalogo" | "declaracao" | "revisao") => {
    if (!divergencia) return;
    if (escolha === "declaracao") {
      setForm(divergencia.declaracao);
      setOrigem("declaracao");
      setClubeSelecionado(null); // descarta clube selecionado
    } else if (escolha === "catalogo") {
      setOrigem("catalogo");
      // mantém form atual (vindo do clube selecionado)
    } else {
      // revisao da equipe: mantém clube selecionado e marca divergência no save
      setOrigem("catalogo");
    }
    setDivergencia(null);
  };

  const confirmar = async () => {
    if (!form.nome_clube.trim()) {
      toast.error("Informe o nome do clube.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-clube-sugerir", {
        body: {
          processo_id: processoId,
          clube_id_selecionado: clubeSelecionado?.id ?? null,
          origem:
            origem === "declaracao"
              ? "declaracao_filiacao_cliente"
              : origem === "catalogo"
                ? "catalogo_interno"
                : "manual",
          clube: {
            nome: form.nome_clube,
            cnpj: form.cnpj,
            numero_cr: form.numero_cr,
            data_cr: form.data_cr,
            endereco: form.endereco,
            cidade: form.cidade,
            uf: form.uf,
          },
          filiacao: {
            numero: form.numero_filiacao,
            validade: form.validade_filiacao,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Clube e filiação confirmados ✓");
      onConfirmed();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  const headerTitle = useMemo(() => {
    switch (phase) {
      case "reuso": return "Já temos seu clube?";
      case "search": return txt("[NOME CLUBE]", "pergunta_cliente", "Escolha seu clube");
      case "filiacao_mode": return txt("[NUMERO FILIACAO]", "label_cliente", "Sua filiação");
      case "upload": return txt("[NUMERO FILIACAO]", "texto_ajuda", "Envie sua declaração de filiação");
      case "manual": return txt("[NUMERO FILIACAO]", "pergunta_cliente", "Preencha sua filiação");
      case "review": return "Revise antes de confirmar";
    }
  }, [phase, overrides]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Clube de tiro e filiação</div>
          <h3 className="text-base font-extrabold text-slate-900">{headerTitle}</h3>
        </div>
      </div>

      {phase === "reuso" && reuse && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div className="min-w-0">
                <div className="text-[12px] font-bold uppercase text-emerald-800">Encontramos dados de clube usados em outro processo</div>
                <div className="mt-1 text-[13px] font-semibold text-slate-800 truncate">
                  {reuse.templateData.nome_clube || "Clube anterior"}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600 uppercase flex flex-wrap gap-2">
                  {reuse.templateData.cnpj_clube && <span>CNPJ {reuse.templateData.cnpj_clube}</span>}
                  {reuse.templateData.numero_filiacao && <span>Filiação {reuse.templateData.numero_filiacao}</span>}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={aceitarReuso}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white"
            style={{ background: MARROM }}
          >
            <RefreshCw className="h-4 w-4" /> Reutilizar esses dados
          </button>
          <button
            type="button"
            onClick={() => setPhase("search")}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Não, quero informar agora
          </button>
        </div>
      )}

      {phase === "search" && (
        <ClubeSearchCombobox onSelect={selecionarClube} onNotFound={clubeNaoEncontrado} />
      )}

      {phase === "filiacao_mode" && (
        <div className="space-y-3">
          {clubeSelecionado && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
              <div className="font-bold uppercase text-slate-800 truncate">{clubeSelecionado.nome_clube}</div>
              <div className="text-slate-500 uppercase">{[clubeSelecionado.cidade, clubeSelecionado.estado].filter(Boolean).join("/")}</div>
            </div>
          )}
          <p className="text-[12px] text-slate-500">Como você prefere informar sua filiação?</p>
          <button
            type="button"
            onClick={() => setPhase("upload")}
            className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-4 text-left hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBF3F4] text-[#7A1F2B]">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-900">Enviar declaração de filiação</div>
                <div className="text-[11px] text-slate-500">A IA lê e preenche os campos para você revisar.</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={() => { setPhase("manual"); setOrigem(clubeSelecionado ? "catalogo" : "manual"); }}
            className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-4 text-left hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Edit3 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-900">Preencher manualmente</div>
                <div className="text-[11px] text-slate-500">Informe o número e a validade da filiação.</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      )}

      {phase === "upload" && (
        <DeclaracaoFiliacaoUploader
          onExtracted={(d) => aplicarDeclaracao(d)}
          onCancel={() => setPhase("filiacao_mode")}
        />
      )}

      {phase === "manual" && (
        <div className="space-y-3">
          <RevisaoCampos
            state={form}
            onChange={setForm}
            origem={origem}
            overrides={overrides}
            readonlyNome={!!clubeSelecionado && clubeSelecionado.status_verificacao === "verificado"}
          />
          <button
            type="button"
            onClick={() => setPhase("review")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white"
            style={{ background: MARROM }}
          >
            Continuar para revisão <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-3">
          {divergencia && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-[12px] text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-bold uppercase">Dados divergentes</div>
                  <p className="mt-1">
                    Os dados da declaração não batem com o clube selecionado em: {divergencia.campos.join(", ")}.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button onClick={() => resolverDivergencia("catalogo")} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold uppercase text-amber-900 hover:bg-amber-100">Manter clube selecionado</button>
                <button onClick={() => resolverDivergencia("declaracao")} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold uppercase text-amber-900 hover:bg-amber-100">Usar dados da declaração</button>
                <button onClick={() => resolverDivergencia("revisao")} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold uppercase text-amber-900 hover:bg-amber-100">Enviar para revisão da equipe</button>
              </div>
            </div>
          )}

          {clubeSelecionado && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" /> Clube selecionado do catálogo Quero Armas
            </div>
          )}

          <RevisaoCampos
            state={form}
            onChange={setForm}
            origem={origem}
            overrides={overrides}
            readonlyNome={!!clubeSelecionado && clubeSelecionado.status_verificacao === "verificado"}
          />
        </div>
      )}

      {/* Rodapé navegação */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between pt-2">
        <button
          type="button"
          onClick={() => {
            if (phase === "search") return onBack();
            if (phase === "filiacao_mode") return setPhase("search");
            if (phase === "upload" || phase === "manual") return setPhase("filiacao_mode");
            if (phase === "review") return setPhase(clubeSelecionado ? "filiacao_mode" : "manual");
            if (phase === "reuso") return onBack();
          }}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {phase === "review" && !divergencia && (
          <button
            type="button"
            onClick={confirmar}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: MARROM }}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : <>Confirmar clube e filiação <ArrowRight className="h-4 w-4" /></>}
          </button>
        )}
      </div>
    </div>
  );
}

function toBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}