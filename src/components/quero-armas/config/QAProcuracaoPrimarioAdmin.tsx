import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FileSignature, Upload, Loader2, CheckCircle2, RefreshCw, Plus, Trash2, Wand2, Eye,
} from "lucide-react";

type TemplateVigente = {
  id: string;
  versao: number;
  titulo: string;
  data_publicacao: string | null;
  updated_at: string | null;
};

type Substituicao = {
  id: string;
  texto_original: string;
  placeholder: string;
  descricao: string | null;
  ativo: boolean;
};

const CODIGO = "PROCURACAO_PADRAO_QUERO_ARMAS";

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Aplica todas as substituições ativas ao texto. Retorna também os hits. */
function stringar(texto: string, subs: Substituicao[]): { saida: string; hits: Array<{ de: string; para: string; count: number }> } {
  let saida = texto;
  const hits: Array<{ de: string; para: string; count: number }> = [];
  for (const s of subs) {
    if (!s.ativo || !s.texto_original.trim()) continue;
    const re = new RegExp(escapeRegex(s.texto_original), "gi");
    const matches = saida.match(re);
    if (matches && matches.length) {
      saida = saida.replace(re, s.placeholder);
      hits.push({ de: s.texto_original, para: s.placeholder, count: matches.length });
    }
  }
  return { saida, hits };
}

export default function QAProcuracaoPrimarioAdmin() {
  const [vigente, setVigente] = useState<TemplateVigente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [subs, setSubs] = useState<Substituicao[]>([]);

  const [corpoOriginal, setCorpoOriginal] = useState("");
  const [corpoStringado, setCorpoStringado] = useState("");
  const [hits, setHits] = useState<Array<{ de: string; para: string; count: number }>>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [modoPreview, setModoPreview] = useState<"original" | "stringado">("stringado");
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [novaSub, setNovaSub] = useState<{ texto: string; placeholder: string; descricao: string }>({
    texto: "", placeholder: "", descricao: "",
  });

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: tpl }, { data: sb }] = await Promise.all([
        supabase.from("qa_contract_templates" as any)
          .select("id, versao, titulo, data_publicacao, updated_at")
          .eq("codigo", CODIGO).eq("vigente", true).maybeSingle(),
        supabase.from("qa_config_substituicoes_pessoais" as any)
          .select("id, texto_original, placeholder, descricao, ativo")
          .order("created_at", { ascending: true }),
      ]);
      setVigente((tpl as any) ?? null);
      setSubs(((sb as any[]) ?? []) as Substituicao[]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function adicionarSub() {
    if (!novaSub.texto.trim() || !novaSub.placeholder.trim()) {
      toast.error("Preencha texto e placeholder");
      return;
    }
    const { error } = await supabase.from("qa_config_substituicoes_pessoais" as any).insert({
      texto_original: novaSub.texto.trim(),
      placeholder: novaSub.placeholder.trim(),
      descricao: novaSub.descricao.trim() || null,
      ativo: true,
    });
    if (error) { toast.error(error.message); return; }
    setNovaSub({ texto: "", placeholder: "", descricao: "" });
    toast.success("Substituição adicionada");
    await carregar();
    if (corpoOriginal) recalcularPreview(corpoOriginal);
  }

  async function removerSub(id: string) {
    if (!confirm("Remover esta substituição?")) return;
    await supabase.from("qa_config_substituicoes_pessoais" as any).delete().eq("id", id);
    await carregar();
    if (corpoOriginal) recalcularPreview(corpoOriginal);
  }

  async function toggleSub(s: Substituicao) {
    await supabase.from("qa_config_substituicoes_pessoais" as any).update({ ativo: !s.ativo }).eq("id", s.id);
    await carregar();
    if (corpoOriginal) recalcularPreview(corpoOriginal);
  }

  function recalcularPreview(texto: string) {
    const { saida, hits } = stringar(texto, subs);
    setCorpoStringado(saida);
    setHits(hits);
  }

  async function onArquivoSelecionado(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["html", "htm", "md", "txt"].includes(ext || "")) {
      toast.error("Envie em .html, .md ou .txt");
      return;
    }
    const texto = await file.text();
    setCorpoOriginal(texto);
    setNomeArquivo(file.name);
    recalcularPreview(texto);
    toast.success(`Arquivo "${file.name}" carregado (${Math.round(texto.length / 1024)} KB) — revise a stringagem`);
  }

  async function publicar() {
    if (!corpoStringado.trim()) { toast.error("Cole ou envie a procuração"); return; }
    const restantes: string[] = [];
    for (const s of subs.filter((x) => x.ativo)) {
      const re = new RegExp(escapeRegex(s.texto_original), "i");
      if (re.test(corpoStringado)) restantes.push(s.texto_original);
    }
    if (restantes.length > 0) {
      if (!confirm(`Ainda há ocorrências de dados pessoais não substituídas:\n\n${restantes.join("\n")}\n\nPublicar mesmo assim?`)) return;
    }
    if (!confirm(`Publicar esta procuração como VIGENTE (versão nova)?`)) return;
    setPublicando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-template-publicar", {
        body: { corpo: corpoStringado, codigo: CODIGO },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Falha ao publicar");
      toast.success(`Procuração publicada — versão ${(data as any).versao}`);
      setCorpoOriginal(""); setCorpoStringado(""); setHits([]); setNomeArquivo(null);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao publicar");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border p-4 md:p-5" style={{ borderColor: "hsl(220 15% 90%)" }}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
          <FileSignature className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} /> Procuração — Modelo vigente
        </h2>
        <Button variant="ghost" size="sm" onClick={carregar} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>
      <p className="text-xs mb-4" style={{ color: "hsl(220 10% 62%)" }}>
        Suba a procuração <b>normal</b> (com o seu nome/CPF pessoais). O sistema substitui automaticamente
        pelos placeholders da empresa e mostra o resultado antes de publicar. A cada novo serviço contratado,
        o motor consulta o hub documental e reaproveita a procuração validada do cliente — se não houver,
        gera uma nova a partir desta versão.
      </p>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Vigente */}
          <div className="rounded-lg border bg-slate-50/60 px-3 py-2.5 mb-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "hsl(220 20% 25%)" }}>
                {vigente ? vigente.titulo : "Nenhuma procuração vigente"}
              </p>
              <p className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                {vigente
                  ? `Versão ${vigente.versao} · publicada em ${fmtData(vigente.data_publicacao ?? vigente.updated_at)}`
                  : "Publique uma procuração para ativar"}
              </p>
            </div>
            {vigente && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-green-700 bg-green-50 border-green-200 shrink-0">
                Vigente
              </span>
            )}
          </div>

          {/* Substituições pessoais */}
          <div className="border rounded-lg p-3 mb-5" style={{ borderColor: "hsl(220 15% 90%)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="w-3.5 h-3.5" style={{ color: "hsl(352 60% 30%)" }} />
              <h3 className="text-xs font-semibold" style={{ color: "hsl(220 20% 25%)" }}>
                Dados pessoais → placeholders da empresa ({subs.length})
              </h3>
            </div>
            <p className="text-[11px] mb-2" style={{ color: "hsl(220 10% 62%)" }}>
              Cada linha define uma substituição case-insensitive. Use placeholders como
              <code className="mx-1 font-mono">{`{{empresa_razao_social}}`}</code>,
              <code className="mx-1 font-mono">{`{{empresa_representante}}`}</code>.
            </p>
            <div className="space-y-1 mb-2 max-h-52 overflow-y-auto pr-1">
              {subs.map((s) => (
                <div key={s.id} className={`grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center rounded border px-2 py-1 ${s.ativo ? "" : "opacity-50"}`} style={{ borderColor: "hsl(220 15% 92%)" }}>
                  <span className="text-[11px] font-mono truncate" title={s.texto_original}>{s.texto_original}</span>
                  <span className="text-[11px] font-mono truncate text-slate-600" title={s.placeholder}>{s.placeholder}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => toggleSub(s)}>
                      {s.ativo ? "Ativa" : "Inativa"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removerSub(s.id)}>
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {subs.length === 0 && <p className="text-[11px] italic text-slate-400 py-2 text-center">Nenhuma substituição cadastrada.</p>}
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
              <Input placeholder='texto pessoal (ex: "Willian Massaroto")' className="h-7 text-xs"
                value={novaSub.texto} onChange={(e) => setNovaSub((s) => ({ ...s, texto: e.target.value }))} />
              <Input placeholder="{{empresa_representante}}" className="h-7 text-xs font-mono"
                value={novaSub.placeholder} onChange={(e) => setNovaSub((s) => ({ ...s, placeholder: e.target.value }))} />
              <Button size="sm" className="h-7 gap-1 text-xs bg-[#7B1C2E] hover:bg-[#6a1827] text-white" onClick={adicionarSub}>
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Upload + preview */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => inputFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                {nomeArquivo ? nomeArquivo.slice(0, 30) + (nomeArquivo.length > 30 ? "…" : "") : "Enviar procuração (.html / .md / .txt)"}
              </Button>
              <input ref={inputFileRef} type="file" accept=".html,.htm,.md,.txt" className="hidden"
                onChange={(e) => onArquivoSelecionado(e.target.files?.[0] ?? null)} />
              {corpoOriginal && (
                <div className="ml-auto flex items-center gap-1 text-[11px]">
                  <Button size="sm" variant={modoPreview === "original" ? "default" : "outline"} className="h-7 text-[11px] px-2"
                    onClick={() => setModoPreview("original")}>Original</Button>
                  <Button size="sm" variant={modoPreview === "stringado" ? "default" : "outline"} className="h-7 text-[11px] px-2 gap-1"
                    onClick={() => setModoPreview("stringado")}><Eye className="w-3 h-3" /> Stringado</Button>
                </div>
              )}
            </div>
            {hits.length > 0 && (
              <div className="rounded border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] text-green-800">
                <b>{hits.reduce((a, h) => a + h.count, 0)} substituição(ões) aplicada(s):</b>{" "}
                {hits.map((h) => `${h.de} → ${h.para} (${h.count}x)`).join(" · ")}
              </div>
            )}
            <textarea
              value={modoPreview === "original" ? corpoOriginal : corpoStringado}
              onChange={(e) => {
                if (modoPreview === "original") {
                  setCorpoOriginal(e.target.value); setNomeArquivo(null); recalcularPreview(e.target.value);
                } else {
                  setCorpoStringado(e.target.value);
                }
              }}
              placeholder="Cole aqui a procuração (HTML ou texto)."
              rows={12}
              className="w-full rounded-lg border px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2"
              style={{ borderColor: modoPreview === "stringado" ? "hsl(145 55% 55%)" : "hsl(220 15% 88%)" }}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
                {corpoStringado.trim() ? `${Math.round(corpoStringado.length / 1024)} KB — versão stringada` : ""}
              </p>
              <Button size="sm" onClick={publicar} disabled={!corpoStringado.trim() || publicando}
                className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-8">
                {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {publicando ? "Publicando…" : "Publicar procuração"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
