import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileSignature, Upload, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Code2, Copy, Check,
} from "lucide-react";
import { QAEditorModelo, QAEditorModeloRef, QAEditorInsert } from "./QAEditorModelo";

type TemplateVigente = {
  id: string; versao: number; titulo: string;
  corpo_html?: string; data_publicacao: string | null; updated_at: string | null;
};
type ServicoAnexo = {
  id: string; slug: string; nome: string; ativo: boolean;
  anexo_titulo: string | null; anexo_versao: number;
  anexo_corpo_html: string | null; anexo_atualizado_em: string | null;
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

// ── Trechos de inserção rápida para contrato ──────────────────────────────

const INSERTS_CONTRATO: QAEditorInsert[] = [
  {
    label: "Títl.",
    title: "Inserir: Título principal do contrato (H1 centralizado, maiúsculas)",
    html: "<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>",
  },
  {
    label: "Cláus.",
    title: "Inserir: Nova Cláusula (H2 numerada — edite o número e o título)",
    html: "<h2>CLÁUSULA 1ª – OBJETO</h2><p></p>",
  },
  {
    label: "CONT.",
    title: "Inserir: Qualificação completa do CONTRATANTE (cliente) com todos os placeholders de dados pessoais e endereço",
    html: `<p><strong>CONTRATANTE:</strong> {{cliente_nome_completo}}, {{cliente_estado_civil}}, {{cliente_profissao}}, portador(a) do CPF nº {{cliente_cpf}}, RG nº {{cliente_rg}}, expedido pela {{cliente_rg_orgao_emissor}} /{{cliente_rg_uf_emissor}}, residente e domiciliado(a) à {{cliente_logradouro}}, {{cliente_numero}}, {{cliente_complemento}}, Bairro {{cliente_bairro}}, {{cliente_cep}}, {{cliente_cidade}}, {{cliente_estado}}, {{cliente_pais}}, com e-mail: {{cliente_email}}, telefone {{cliente_telefone}}.</p>`,
  },
  {
    label: "CTDA.",
    title: "Inserir: Qualificação completa da CONTRATADA (Senhor das Armas / Quero Armas) com CNPJ e endereço da empresa",
    html: `<p><strong>CONTRATADA:</strong> {{empresa_razao_social}}, CNPJ: {{empresa_cnpj_completo}}, com endereço comercial à Rua José Benedito Duarte, 140, Parque Itamarati, 12.307-200, Jacareí, São Paulo, com e-mail: eu@queroarmas.com.br, telefone comercial (11) 9.7848-1919, neste ato representada por {{empresa_representante}}, CPF nº {{empresa_representante_cpf}}.</p>`,
  },
  {
    label: "Anx.I",
    title: "Inserir: Placeholder do Anexo I dinâmico — o motor monta os serviços contratados em runtime",
    html: "{{anexos_i_dinamicos}}",
  },
  {
    label: "Data",
    title: "Inserir: Linha de data e local de assinatura",
    html: `<p class="qa-doc__date">Jacareí, {{data_hoje_extenso}}.</p>`,
  },
  {
    label: "Assn.",
    title: "Inserir: Bloco de assinatura do cliente (linha + nome + CPF)",
    html: `<div class="qa-doc__signature"><span>{{cliente_nome_completo}}</span><small>CPF nº {{cliente_cpf}}</small></div>`,
  },
];

// ── Componente ────────────────────────────────────────────────────────────

export default function QAContratoPrimarioAdmin() {
  const [vigente, setVigente] = useState<TemplateVigente | null>(null);
  const [servicos, setServicos] = useState<ServicoAnexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editorHtml, setEditorHtml] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPublicacao | null>(null);
  const [verCodigoVigente, setVerCodigoVigente] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const editorRef = useRef<QAEditorModeloRef>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);
  const [anexoForm, setAnexoForm] = useState<{ titulo: string; corpo: string }>({ titulo: "", corpo: "" });
  const [salvandoAnexo, setSalvandoAnexo] = useState(false);
  const [anexoEditorRef] = useState<Record<string, QAEditorModeloRef | null>>({});

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: tpl }, { data: cat }] = await Promise.all([
        supabase.from("qa_contract_templates" as any)
          .select("id, versao, titulo, corpo_html, data_publicacao, updated_at")
          .eq("codigo", "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS")
          .eq("vigente", true).maybeSingle(),
        supabase.from("qa_servicos_catalogo" as any)
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
      toast.error("Envie o contrato em .html, .md ou .txt");
      return;
    }
    const texto = await file.text();
    editorRef.current?.setHtml(texto);
    setEditorHtml(texto);
    setNomeArquivo(file.name);
    toast.success(`Arquivo "${file.name}" carregado (${Math.round(texto.length / 1024)} KB)`);
  }

  async function copiarHtmlVigente() {
    const html = (vigente as any)?.corpo_html ?? "";
    if (!html) return;
    await navigator.clipboard.writeText(html);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function publicar() {
    const html = (editorRef.current?.getHtml() ?? "").trim();
    if (!html) { toast.error("Cole ou envie o corpo do contrato"); return; }
    if (!confirm(
      "Publicar este conteúdo como CONTRATO PRIMÁRIO vigente?\n\n" +
      "Todos os novos contratos gerados passarão a usar esta versão.",
    )) return;
    setPublicando(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-template-publicar", {
        body: { corpo: html },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error || error?.message || "Falha ao publicar");
      }
      const r = data as any as ResultadoPublicacao & { ok: boolean };
      setResultado(r);
      editorRef.current?.setHtml("");
      setEditorHtml("");
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
    const corpoFinal = (anexoEditorRef[s.id]?.getHtml() ?? anexoForm.corpo).trim();
    setSalvandoAnexo(true);
    try {
      const { error } = await supabase.from("qa_servicos_catalogo" as any).update({
        anexo_titulo: anexoForm.titulo.trim() || null,
        anexo_corpo_html: corpoFinal || null,
        anexo_versao: (s.anexo_versao || 0) + 1,
        anexo_atualizado_em: new Date().toISOString(),
      }).eq("id", s.id);
      if (error) throw error;
      toast.success(`Anexo de "${s.nome}" salvo`);
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
        Publique aqui a nova versão do contrato de adesão usando o <b>QAEditorModelo</b>. O sistema extrai
        automaticamente os anexos por serviço e monta o Anexo I dinamicamente a cada contrato gerado.
      </p>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Versão vigente */}
          <div className="rounded-lg border bg-slate-50/60 px-3 py-2.5 mb-4">
            <div className="flex items-center justify-between gap-2">
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
              <div className="flex items-center gap-1.5 shrink-0">
                {vigente && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                      onClick={() => setVerCodigoVigente((v) => !v)}>
                      <Code2 className="w-3 h-3" />
                      {verCodigoVigente ? "Fechar" : "Ver código"}
                      {verCodigoVigente ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                      onClick={copiarHtmlVigente}>
                      {copiado ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      {copiado ? "Copiado!" : "Copiar HTML"}
                    </Button>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-green-700 bg-green-50 border-green-200">
                      Vigente
                    </span>
                  </>
                )}
              </div>
            </div>
            {verCodigoVigente && vigente && (
              <div className="mt-2">
                <textarea readOnly value={(vigente as any).corpo_html ?? ""} rows={10}
                  className="w-full rounded border px-2 py-1.5 text-[11px] font-mono resize-y bg-slate-900 text-green-300 focus:outline-none"
                  style={{ borderColor: "hsl(220 15% 80%)" }} />
                <p className="text-[10px] mt-1" style={{ color: "hsl(220 10% 60%)" }}>
                  Somente leitura. Use "Copiar HTML" para copiar e cole no editor → modo HTML.
                </p>
              </div>
            )}
          </div>

          {/* Publicar nova versão */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => inputFileRef.current?.click()}>
                <Upload className="w-3 h-3" />
                {nomeArquivo ? nomeArquivo.slice(0, 28) + (nomeArquivo.length > 28 ? "…" : "") : "Importar arquivo (.html / .md / .txt)"}
              </Button>
              <input ref={inputFileRef} type="file" accept=".html,.htm,.md,.txt" className="hidden"
                onChange={(e) => onArquivoSelecionado(e.target.files?.[0] ?? null)} />
              {editorHtml.trim() && (
                <span className="text-[11px] ml-auto" style={{ color: "hsl(220 10% 62%)" }}>
                  {Math.round(editorHtml.length / 1024)} KB
                </span>
              )}
            </div>

            {/* QAEditorModelo */}
            <QAEditorModelo
              ref={editorRef}
              onChange={setEditorHtml}
              inserts={INSERTS_CONTRATO}
              minHeight={320}
              placeholder="Cole ou importe o corpo completo do contrato. Use {{anexos_i_dinamicos}} no local do Anexo I."
            />

            <div className="flex items-center justify-end">
              <Button size="sm" onClick={publicar} disabled={!editorHtml.trim() || publicando}
                className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-8">
                {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {publicando ? "Publicando…" : "Publicar como contrato primário"}
              </Button>
            </div>

            {resultado && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs space-y-1">
                <p className="font-medium text-green-800">Versão {resultado.versao} publicada com sucesso.</p>
                {resultado.anexos_atualizados.length > 0 && (
                  <p className="text-green-700">
                    Anexos atualizados: {resultado.anexos_atualizados.map((a) => `${a.nome} (v${a.versao})`).join(", ")}
                  </p>
                )}
                {resultado.anexos_sem_servico.length > 0 && (
                  <p className="text-amber-700 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Slugs sem serviço no catálogo: {resultado.anexos_sem_servico.join(", ")}
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
              Cada serviço tem seu bloco de Anexo I. Crie o serviço em Preços &amp; Serviços, preencha o
              anexo aqui e ele entra nos próximos contratos automaticamente.
            </p>
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {servicos.map((s) => {
                const temAnexo = !!(s.anexo_corpo_html || "").trim();
                const aberto = anexoAberto === s.id;
                return (
                  <div key={s.id} className="border rounded-lg overflow-hidden" style={{ borderColor: "hsl(220 15% 90%)" }}>
                    <button onClick={() => abrirAnexo(s)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors text-left gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.ativo ? "bg-green-500" : "bg-slate-300"}`} />
                        <span className="text-xs font-medium truncate" style={{ color: "hsl(220 20% 25%)" }}>{s.nome}</span>
                        <code className="text-[10px] text-slate-400 font-mono">{s.slug}</code>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {temAnexo ? (
                          <span className="text-[10px] text-green-700 font-medium">v{s.anexo_versao}</span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium">sem anexo</span>
                        )}
                        {aberto ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </button>

                    {aberto && (
                      <div className="border-t px-3 py-2.5 space-y-2" style={{ borderColor: "hsl(220 15% 90%)" }}>
                        <input
                          type="text"
                          value={anexoForm.titulo}
                          onChange={(e) => setAnexoForm((f) => ({ ...f, titulo: e.target.value }))}
                          placeholder={`Título do Anexo — ${s.nome}`}
                          className="w-full h-7 rounded border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#7B1C2E]/40"
                          style={{ borderColor: "hsl(220 15% 85%)" }}
                        />
                        <QAEditorModelo
                          ref={(r) => { anexoEditorRef[s.id] = r; }}
                          initialHtml={s.anexo_corpo_html ?? ""}
                          onChange={(h) => setAnexoForm((f) => ({ ...f, corpo: h }))}
                          inserts={INSERTS_CONTRATO}
                          minHeight={160}
                          placeholder={`Conteúdo do Anexo I — ${s.nome}`}
                        />
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => salvarAnexo(s)} disabled={salvandoAnexo}
                            className="h-7 text-xs gap-1 bg-[#7B1C2E] hover:bg-[#6a1827] text-white">
                            {salvandoAnexo ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Salvar anexo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
