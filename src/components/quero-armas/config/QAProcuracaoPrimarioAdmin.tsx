import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { baixarHtmlProcuracao } from "@/lib/quero-armas/procuracaoHtml";
import {
  FileSignature, Upload, Loader2, CheckCircle2, RefreshCw,
  Plus, Trash2, Wand2, Download, Code2, Copy, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import { QAEditorModelo, QAEditorModeloRef, QAEditorInsert } from "./QAEditorModelo";

type TemplateVigente = {
  id: string; versao: number; titulo: string;
  corpo_html: string; data_publicacao: string | null; updated_at: string | null;
};
type Substituicao = {
  id: string; texto_original: string; placeholder: string;
  descricao: string | null; ativo: boolean;
};

const CODIGO = "PROCURACAO_PADRAO_QUERO_ARMAS";
const PLACEHOLDERS_OBRIGATORIOS = ["{{cliente_nome_completo}}", "{{cliente_cpf}}"];

const MODELO_HTML_PADRAO = `<article class="qa-doc qa-procuracao-template">
  <header class="qa-procuracao__letterhead">
    <strong>{{empresa_razao_social}}</strong><br />
    CNPJ: {{empresa_cnpj_completo}}<br />
    {{empresa_endereco}}
  </header>

  <h1>PROCURAÇÃO DESTINADA À POLÍCIA FEDERAL, FORÇAS ARMADAS E DELEGACIAS DE POLÍCIA</h1>

  <h2>OUTORGANTE</h2>
  <p><strong>OUTORGANTE:</strong> {{cliente_nome_completo}}, {{cliente_estado_civil}}, {{cliente_profissao}}, portador(a) do CPF nº {{cliente_cpf}}, RG nº {{cliente_rg}}, expedido pela {{cliente_rg_orgao_emissor}} /{{cliente_rg_uf_emissor}}, residente e domiciliado(a) à {{cliente_logradouro}}, {{cliente_numero}}, {{cliente_complemento}}, Bairro {{cliente_bairro}}, {{cliente_cep}}, {{cliente_cidade}}, {{cliente_estado}}, {{cliente_pais}}, com e-mail: {{cliente_email}}, telefone {{cliente_telefone}}.</p>

  <h2>OUTORGADO(S)</h2>
  <p><strong>OUTORGADO:</strong> {{empresa_razao_social}}, CNPJ: {{empresa_cnpj_completo}}, com endereço comercial à Rua José Benedito Duarte, 140, Parque Itamarati, 12.307-200, Jacareí, São Paulo, com e-mail: eu@queroarmas.com.br, telefone comercial (11) 9.7848-1919.</p>

  <h2>PODERES</h2>
  <p><strong>PODERES:</strong> Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui como seu bastante procurador o OUTORGADO, a quem confere amplos, gerais e ilimitados poderes para, em seu nome, praticar os seguintes atos:</p>

  <ol class="qa-procuracao__powers">
    <li><strong>PERANTE AS DELEGACIAS DE POLÍCIA NO BRASIL:</strong> Requerer, junto a qualquer delegacia de polícia do Brasil, cópias de boletins de ocorrência e/ou quaisquer outros documentos relacionados, podendo, para tanto, assinar documentos, formular requerimentos e praticar todos os atos necessários para o fiel cumprimento deste mandato.</li>
    <li><strong>PERANTE O EXÉRCITO BRASILEIRO:</strong> Requerer ou responder ao Serviço de Fiscalização de Produtos Controlados do Comando de todas as Regiões Militares do Brasil (SFPCs), assinar requerimentos, termos e declarações, protocolar e retirar processos para: concessão de CRAF, emissão de 2ª via, renovação, transferências e exclusões de arma do SIGMA.</li>
    <li><strong>PERANTE A POLÍCIA FEDERAL:</strong> Requerer ao NUARM e SINARM CAC, em todo território nacional, requerimentos, termos e declarações, protocolar e retirar processos para autorização de compra, registro, apostilamento, guia de trânsito, posse, porte e renovação de armas de fogo.</li>
  </ol>

  <p>Este mandato é válido por prazo indeterminado, ou até que seja expressamente revogado pelo(a) OUTORGANTE.</p>

  <p class="qa-doc__date">Jacareí, {{data_hoje_extenso}}.</p>

  <div class="qa-doc__signature">
    <span>{{cliente_nome_completo}}</span>
    <small>CPF nº {{cliente_cpf}}</small>
  </div>
</article>`;

// ── Trechos de inserção rápida para procuração ────────────────────────────

const INSERTS_PROCURACAO: QAEditorInsert[] = [
  {
    label: "Títl.",
    title: "Inserir: Título principal da procuração (H1 centralizado, maiúsculas)",
    html: "<h1>PROCURAÇÃO</h1>",
  },
  {
    label: "Seç.",
    title: "Inserir: Nova seção / subtítulo (H2 centralizado, maiúsculas)",
    html: "<h2>NOVA SEÇÃO</h2>",
  },
  {
    label: "OUTG.",
    title: "Inserir: Qualificação completa do OUTORGANTE (cliente) com todos os placeholders de dados pessoais e endereço",
    html: `<h2>OUTORGANTE</h2><p><strong>OUTORGANTE:</strong> {{cliente_nome_completo}}, {{cliente_estado_civil}}, {{cliente_profissao}}, portador(a) do CPF nº {{cliente_cpf}}, RG nº {{cliente_rg}}, expedido pela {{cliente_rg_orgao_emissor}} /{{cliente_rg_uf_emissor}}, residente e domiciliado(a) à {{cliente_logradouro}}, {{cliente_numero}}, {{cliente_complemento}}, Bairro {{cliente_bairro}}, {{cliente_cep}}, {{cliente_cidade}}, {{cliente_estado}}, {{cliente_pais}}, com e-mail: {{cliente_email}}, telefone {{cliente_telefone}}.</p>`,
  },
  {
    label: "OUTD.",
    title: "Inserir: Qualificação completa do OUTORGADO (Senhor das Armas / Quero Armas) com CNPJ e endereço da empresa",
    html: `<h2>OUTORGADO(S)</h2><p><strong>OUTORGADO:</strong> {{empresa_razao_social}}, CNPJ: {{empresa_cnpj_completo}}, com endereço comercial à Rua José Benedito Duarte, 140, Parque Itamarati, 12.307-200, Jacareí, São Paulo, com e-mail: eu@queroarmas.com.br, telefone comercial (11) 9.7848-1919.</p>`,
  },
  {
    label: "Assn.",
    title: "Inserir: Bloco de assinatura do cliente (linha + nome + CPF)",
    html: `<div class="qa-doc__signature"><span>{{cliente_nome_completo}}</span><small>CPF nº {{cliente_cpf}}</small></div>`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stringar(texto: string, subs: Substituicao[]): { saida: string; hits: Array<{ de: string; para: string; count: number }> } {
  let saida = texto;
  const hits: Array<{ de: string; para: string; count: number }> = [];
  for (const s of subs) {
    if (!s.ativo || !s.texto_original.trim()) continue;
    const re = new RegExp(escapeRegex(s.texto_original), "gi");
    const matches = saida.match(re);
    if (matches?.length) {
      saida = saida.replace(re, s.placeholder);
      hits.push({ de: s.texto_original, para: s.placeholder, count: matches.length });
    }
  }
  return { saida, hits };
}

function temPlaceholdersObrigatorios(html: string) {
  const lower = html.toLowerCase();
  return PLACEHOLDERS_OBRIGATORIOS.every((p) => lower.includes(p.toLowerCase()));
}

// ── Componente ────────────────────────────────────────────────────────────

export default function QAProcuracaoPrimarioAdmin() {
  const [vigente, setVigente] = useState<TemplateVigente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [subs, setSubs] = useState<Substituicao[]>([]);
  const [hits, setHits] = useState<Array<{ de: string; para: string; count: number }>>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [verCodigoVigente, setVerCodigoVigente] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [editorHtml, setEditorHtml] = useState("");

  const editorRef = useRef<QAEditorModeloRef>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [novaSub, setNovaSub] = useState({ texto: "", placeholder: "", descricao: "" });

  const carregarNoEditor = useCallback((html: string, sbs: Substituicao[]) => {
    const { saida, hits: h } = stringar(html, sbs);
    editorRef.current?.setHtml(saida);
    setEditorHtml(saida);
    setHits(h);
  }, []);

  async function carregar() {
    setCarregando(true);
    try {
      const [{ data: tpl }, { data: sb }] = await Promise.all([
        supabase.from("qa_contract_templates" as any)
          .select("id, versao, titulo, corpo_html, data_publicacao, updated_at")
          .eq("codigo", CODIGO).eq("vigente", true).maybeSingle(),
        supabase.from("qa_config_substituicoes_pessoais" as any)
          .select("id, texto_original, placeholder, descricao, ativo")
          .order("created_at", { ascending: true }),
      ]);
      const template = (tpl as any) ?? null;
      const sbList = ((sb as any[]) ?? []) as Substituicao[];
      setVigente(template);
      setSubs(sbList);
      if (template?.corpo_html && !editorHtml.trim()) {
        carregarNoEditor(template.corpo_html, sbList);
        setNomeArquivo(`procuracao-modelo-v${template.versao}.html`);
      }
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
  }

  async function removerSub(id: string) {
    if (!confirm("Remover esta substituição?")) return;
    await supabase.from("qa_config_substituicoes_pessoais" as any).delete().eq("id", id);
    await carregar();
  }

  async function toggleSub(s: Substituicao) {
    await supabase.from("qa_config_substituicoes_pessoais" as any).update({ ativo: !s.ativo }).eq("id", s.id);
    await carregar();
  }

  async function onArquivoSelecionado(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["html", "htm", "md", "txt"].includes(ext || "")) {
      toast.error("Envie em .html, .md ou .txt");
      return;
    }
    const texto = await file.text();
    setNomeArquivo(file.name);
    carregarNoEditor(texto, subs);
    toast.success(`Arquivo "${file.name}" carregado (${Math.round(texto.length / 1024)} KB)`);
  }

  function inserirModeloPadrao() {
    const atual = editorRef.current?.getHtml() ?? "";
    if (atual.trim() && !confirm("Substituir o conteúdo atual pelo modelo padrão?")) return;
    carregarNoEditor(MODELO_HTML_PADRAO, subs);
    setNomeArquivo("modelo-padrao.html");
    toast.success("Modelo padrão carregado");
  }

  async function copiarHtmlVigente() {
    if (!vigente?.corpo_html) return;
    await navigator.clipboard.writeText(vigente.corpo_html);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function publicar() {
    const html = (editorRef.current?.getHtml() ?? "").trim();
    if (!html) { toast.error("Digite ou envie a procuração"); return; }
    if (!temPlaceholdersObrigatorios(html)) {
      toast.error("A procuração precisa conter {{cliente_nome_completo}} e {{cliente_cpf}}.");
      return;
    }
    const restantes = subs.filter((x) => x.ativo).filter((s) =>
      new RegExp(escapeRegex(s.texto_original), "i").test(html)
    ).map((s) => s.texto_original);
    if (restantes.length > 0) {
      if (!confirm(`Ainda há dados pessoais não substituídos:\n\n${restantes.join("\n")}\n\nPublicar mesmo assim?`)) return;
    }
    if (!confirm("Publicar esta procuração como VIGENTE (versão nova)?")) return;
    setPublicando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-template-publicar", {
        body: { corpo: html, codigo: CODIGO },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Falha ao publicar");
      toast.success(`Procuração publicada — versão ${(data as any).versao}.`);
      setHits([]);
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
        Edite a procuração no <b>QAEditorModelo</b> abaixo. Os campos do cliente entram automaticamente
        pelos marcadores <code className="font-mono">{'{{cliente_nome_completo}}'}</code> etc.
        O sistema substitui dados pessoais pelos placeholders da empresa antes de publicar.
      </p>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Vigente */}
          <div className="rounded-lg border bg-slate-50/60 px-3 py-2.5 mb-4">
            <div className="flex items-center justify-between gap-2">
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
                <textarea readOnly value={vigente.corpo_html} rows={10}
                  className="w-full rounded border px-2 py-1.5 text-[11px] font-mono resize-y bg-slate-900 text-green-300 focus:outline-none"
                  style={{ borderColor: "hsl(220 15% 80%)" }} />
                <p className="text-[10px] mt-1" style={{ color: "hsl(220 10% 60%)" }}>
                  Somente leitura. Use "Copiar HTML" para copiar e depois cole no editor → modo HTML.
                </p>
              </div>
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
              Cada linha define uma substituição case-insensitive.
              Use placeholders como <code className="mx-1 font-mono">{`{{empresa_razao_social}}`}</code>.
            </p>
            <div className="space-y-1 mb-2 max-h-52 overflow-y-auto pr-1">
              {subs.map((s) => (
                <div key={s.id}
                  className={`grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center rounded border px-2 py-1 ${s.ativo ? "" : "opacity-50"}`}
                  style={{ borderColor: "hsl(220 15% 92%)" }}>
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
              {subs.length === 0 && (
                <p className="text-[11px] italic text-slate-400 py-2 text-center">Nenhuma substituição cadastrada.</p>
              )}
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

          {/* Editor */}
          <div className="space-y-2 mb-3">
            {/* Ações acima do editor */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => inputFileRef.current?.click()}>
                  <Upload className="w-3 h-3" />
                  {nomeArquivo ? nomeArquivo.slice(0, 22) + (nomeArquivo.length > 22 ? "…" : "") : "Importar arquivo"}
                </Button>
                <input ref={inputFileRef} type="file" accept=".html,.htm,.md,.txt" className="hidden"
                  onChange={(e) => onArquivoSelecionado(e.target.files?.[0] ?? null)} />
                <Button size="sm" type="button" onClick={inserirModeloPadrao}
                  className="h-7 text-xs bg-[#7B1C2E] hover:bg-[#6a1827] text-white gap-1">
                  <Wand2 className="w-3 h-3" /> Modelo padrão
                </Button>
              </div>
              <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
                {editorHtml.trim() ? `${Math.round(editorHtml.length / 1024)} KB` : ""}
              </p>
            </div>

            {/* Alerta placeholders obrigatórios */}
            <div className={`rounded border px-2 py-1.5 text-[11px] ${temPlaceholdersObrigatorios(editorHtml) ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {temPlaceholdersObrigatorios(editorHtml)
                ? "OK: O modelo contém os marcadores obrigatórios do cliente."
                : "Obrigatório: inclua {{cliente_nome_completo}} e {{cliente_cpf}} antes de publicar."}
            </div>

            {/* Alerta substituições */}
            {hits.length > 0 && (
              <div className="rounded border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] text-green-800">
                <b>{hits.reduce((a, h) => a + h.count, 0)} substituição(ões) aplicada(s):</b>{" "}
                {hits.map((h) => `${h.de} → ${h.para} (${h.count}x)`).join(" · ")}
              </div>
            )}

            {/* QAEditorModelo */}
            <QAEditorModelo
              ref={editorRef}
              onChange={setEditorHtml}
              inserts={INSERTS_PROCURACAO}
              minHeight={380}
              placeholder="Digite ou importe a procuração. Use os botões de inserção rápida na toolbar."
            />

            {/* Rodapé */}
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" disabled={!editorHtml.trim()}
                onClick={() => {
                  const html = editorRef.current?.getHtml() ?? "";
                  baixarHtmlProcuracao(html, "Procuracao Quero Armas - Modelo", "Procuração Quero Armas - Modelo");
                  toast.success("HTML da procuração baixado");
                }}
                className="text-xs gap-1 h-8">
                <Download className="w-3.5 h-3.5" /> Baixar HTML
              </Button>
              <Button size="sm" onClick={publicar} disabled={!editorHtml.trim() || publicando}
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
