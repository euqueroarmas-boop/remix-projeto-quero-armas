import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FileSignature, Upload, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Save, FileText, RefreshCw,
} from "lucide-react";

type TemplateVigente = {
  id: string;
  versao: number;
  titulo: string;
  data_publicacao: string | null;
  updated_at: string | null;
};

type ServicoAnexo = {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
  anexo_titulo: string | null;
  anexo_versao: number;
  anexo_corpo_html: string | null;
  anexo_atualizado_em: string | null;
};

type ResultadoPublicacao = {
  versao: number;
  anexos_atualizados: Array<{ slug: string; nome: string; versao: number }>;
  anexos_sem_servico: string[];
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export default function QAContratoPrimarioAdmin() {
  const [vigente, setVigente] = useState<TemplateVigente | null>(null);
  const [servicos, setServicos] = useState<ServicoAnexo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [corpo, setCorpo] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPublicacao | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);
  const [anexoForm, setAnexoForm] = useState<{ titulo: string; corpo: string }>({ titulo: "", corpo: "" });
  const [salvandoAnexo, setSalvandoAnexo] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: tpl }, { data: cat }] = await Promise.all([
        supabase
          .from("qa_contract_templates" as any)
          .select("id, versao, titulo, data_publicacao, updated_at")
          .eq("codigo", "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS")
          .eq("vigente", true)
          .maybeSingle(),
        supabase
          .from("qa_servicos_catalogo" as any)
          .select("id, slug, nome, ativo, anexo_titulo, anexo_versao, anexo_corpo_html, anexo_atualizado_em")
          .order("nome"),
      ]);
      setVigente((tpl as any) ?? null);
      setServicos(((cat as any[]) ?? []) as ServicoAnexo[]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function onArquivoSelecionado(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["html", "htm", "md", "txt"].includes(ext || "")) {
      toast.error("Envie o contrato em .html, .md ou .txt (não PDF/Word — cole o texto se necessário)");
      return;
    }
    const texto = await file.text();
    setCorpo(texto);
    setNomeArquivo(file.name);
    toast.success(`Arquivo "${file.name}" carregado (${Math.round(texto.length / 1024)} KB)`);
  }

  async function publicar() {
    if (!corpo.trim()) { toast.error("Cole ou envie o corpo do contrato"); return; }
    if (!confirm(
      "Publicar este conteúdo como CONTRATO PRIMÁRIO vigente?\n\n" +
      "Todos os novos contratos gerados passarão a usar esta versão. " +
      "Os anexos por serviço detectados serão atualizados no catálogo.",
    )) return;
    setPublicando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-template-publicar", {
        body: { corpo },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error || error?.message || "Falha ao publicar");
      }
      const r = data as any as ResultadoPublicacao & { ok: boolean };
      setResultado(r);
      setCorpo("");
      setNomeArquivo(null);
      toast.success(`Contrato primário publicado — versão ${r.versao}`);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao publicar contrato");
    } finally {
      setPublicando(false);
    }
  }

  function abrirAnexo(s: ServicoAnexo) {
    if (anexoAberto === s.id) { setAnexoAberto(null); return; }
    setAnexoAberto(s.id);
    setAnexoForm({ titulo: s.anexo_titulo ?? "", corpo: s.anexo_corpo_html ?? "" });
  }

  async function salvarAnexo(s: ServicoAnexo) {
    setSalvandoAnexo(true);
    try {
      const { error } = await supabase
        .from("qa_servicos_catalogo" as any)
        .update({
          anexo_titulo: anexoForm.titulo.trim() || null,
          anexo_corpo_html: anexoForm.corpo.trim() || null,
          anexo_versao: (s.anexo_versao || 0) + 1,
          anexo_atualizado_em: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (error) throw error;
      toast.success(`Anexo de "${s.nome}" salvo — os próximos contratos já o incluem automaticamente`);
      setAnexoAberto(null);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar anexo");
    } finally {
      setSalvandoAnexo(false);
    }
  }

  const semAnexo = servicos.filter((s) => s.ativo && !(s.anexo_corpo_html || "").trim());

  return (
    <div className="bg-white rounded-2xl border p-4 md:p-5" style={{ borderColor: "hsl(220 15% 90%)" }}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
          <FileSignature className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} /> Contrato Primário
        </h2>
        <Button variant="ghost" size="sm" onClick={carregar} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>
      <p className="text-xs mb-4" style={{ color: "hsl(220 10% 62%)" }}>
        Publique aqui a nova versão do contrato de adesão. O sistema extrai automaticamente os anexos
        por serviço (blocos com <code className="font-mono text-[10px]">data-anexo-slug</code>) e monta o
        Anexo I dinamicamente a cada contrato gerado — serviços novos entram sozinhos, sem ajuste manual.
      </p>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Versão vigente */}
          <div className="rounded-lg border bg-slate-50/60 px-3 py-2.5 mb-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "hsl(220 20% 25%)" }}>
                {vigente ? vigente.titulo : "Nenhum template vigente"}
              </p>
              <p className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                {vigente
                  ? `Versão ${vigente.versao} · publicada em ${fmtData(vigente.data_publicacao ?? vigente.updated_at)}`
                  : "Publique um contrato para ativar"}
              </p>
            </div>
            {vigente && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-green-700 bg-green-50 border-green-200 shrink-0">
                Vigente
              </span>
            )}
          </div>

          {/* Publicar nova versão */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => inputFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                {nomeArquivo ? nomeArquivo.slice(0, 30) + (nomeArquivo.length > 30 ? "…" : "") : "Enviar arquivo (.html / .md / .txt)"}
              </Button>
              <input
                ref={inputFileRef}
                type="file"
                accept=".html,.htm,.md,.txt"
                className="hidden"
                onChange={(e) => onArquivoSelecionado(e.target.files?.[0] ?? null)}
              />
            </div>
            <textarea
              value={corpo}
              onChange={(e) => { setCorpo(e.target.value); setNomeArquivo(null); }}
              placeholder="…ou cole aqui o corpo completo do contrato (HTML ou texto). Use {{anexos_i_dinamicos}} no local do Anexo I, ou marque cada anexo com <section data-anexo-slug=&quot;slug-do-servico&quot;>…</section>."
              rows={8}
              className="w-full rounded-lg border px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2"
              style={{ borderColor: "hsl(220 15% 88%)" }}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
                {corpo.trim() ? `${Math.round(corpo.length / 1024)} KB carregados` : ""}
              </p>
              <Button
                size="sm"
                onClick={publicar}
                disabled={!corpo.trim() || publicando}
                className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-8"
              >
                {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {publicando ? "Publicando…" : "Publicar como contrato primário"}
              </Button>
            </div>

            {resultado && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs space-y-1">
                <p className="font-medium text-green-800">
                  Versão {resultado.versao} publicada com sucesso.
                </p>
                {resultado.anexos_atualizados.length > 0 && (
                  <p className="text-green-700">
                    Anexos atualizados: {resultado.anexos_atualizados.map((a) => `${a.nome} (v${a.versao})`).join(", ")}
                  </p>
                )}
                {resultado.anexos_sem_servico.length > 0 && (
                  <p className="text-amber-700 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Slugs sem serviço no catálogo (anexo ignorado): {resultado.anexos_sem_servico.join(", ")} —
                    crie o serviço em Preços &amp; Serviços e republique ou edite o anexo abaixo.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Anexos por serviço */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold" style={{ color: "hsl(220 20% 25%)" }}>
                Anexos por serviço ({servicos.length})
              </h3>
              {semAnexo.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-amber-700 bg-amber-50 border-amber-200">
                  {semAnexo.length} serviço(s) ativo(s) sem anexo
                </span>
              )}
            </div>
            <p className="text-[11px] mb-3" style={{ color: "hsl(220 10% 62%)" }}>
              Cada serviço do catálogo tem seu bloco de Anexo I. Ao criar um serviço novo em Preços &amp; Serviços,
              o slug é gerado automaticamente — basta preencher o anexo aqui (ou publicá-lo junto do contrato) e ele
              entra nos próximos contratos sem mais nenhum passo.
            </p>
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {servicos.map((s) => {
                const temAnexo = !!(s.anexo_corpo_html || "").trim();
                const aberto = anexoAberto === s.id;
                return (
                  <div key={s.id} className="border rounded-lg overflow-hidden" style={{ borderColor: "hsl(220 15% 90%)" }}>
                    <button
                      onClick={() => abrirAnexo(s)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-left gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: temAnexo ? "hsl(145 55% 35%)" : "hsl(38 90% 45%)" }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: "hsl(220 20% 25%)" }}>
                            {s.nome} {!s.ativo && <span className="text-slate-400 font-normal">(inativo)</span>}
                          </p>
                          <p className="text-[10px] font-mono truncate" style={{ color: "hsl(220 10% 60%)" }}>{s.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                            temAnexo
                              ? "text-green-700 bg-green-50 border-green-200"
                              : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}
                        >
                          {temAnexo ? `Anexo v${s.anexo_versao}` : "Sem anexo"}
                        </span>
                        {aberto ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </button>
                    {aberto && (
                      <div className="border-t bg-slate-50/50 px-3 py-3 space-y-2">
                        <Input
                          value={anexoForm.titulo}
                          onChange={(e) => setAnexoForm((f) => ({ ...f, titulo: e.target.value }))}
                          placeholder="Título do anexo (ex.: ANEXO I — Autorização de Compra / Posse)"
                          className="text-xs h-8"
                        />
                        <textarea
                          value={anexoForm.corpo}
                          onChange={(e) => setAnexoForm((f) => ({ ...f, corpo: e.target.value }))}
                          placeholder={`HTML do anexo. Recomendado envolver em:\n<section data-anexo-slug="${s.slug}"> … </section>`}
                          rows={8}
                          className="w-full rounded-lg border px-3 py-2 text-xs font-mono resize-y focus:outline-none"
                          style={{ borderColor: "hsl(220 15% 88%)" }}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAnexoAberto(null)}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => salvarAnexo(s)}
                            disabled={salvandoAnexo}
                            className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-7"
                          >
                            {salvandoAnexo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Salvar anexo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {servicos.length === 0 && (
                <p className="text-center py-4 text-xs text-muted-foreground italic">Nenhum serviço no catálogo.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
