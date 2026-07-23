import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { baixarHtmlProcuracao } from "@/lib/quero-armas/procuracaoHtml";
import {
  FileSignature, Upload, Loader2, CheckCircle2, RefreshCw, Plus, Trash2, Wand2, Download,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Heading1, Heading2, Type, Code2, Copy, Check, ChevronDown, ChevronUp,
} from "lucide-react";

type TemplateVigente = {
  id: string;
  versao: number;
  titulo: string;
  corpo_html: string;
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
const PLACEHOLDERS_OBRIGATORIOS = ["{{cliente_nome_completo}}", "{{cliente_cpf}}"];
const MODELO_HTML_PADRAO = `<article class="qa-doc qa-procuracao-template">
  <header class="qa-procuracao__letterhead">
    <strong>{{empresa_razao_social}}</strong><br />
    CNPJ: {{empresa_cnpj_completo}}<br />
    {{empresa_endereco}}
  </header>

  <h1>PROCURAÇÃO DESTINADA À POLÍCIA FEDERAL, FORÇAS ARMADAS E DELEGACIAS DE POLÍCIA</h1>

  <h2>OUTORGANTE</h2>
  <p><strong>OUTORGANTE:</strong> {{cliente_nome_completo}}, {{cliente_estado_civil}}, {{cliente_profissao}}, portador(a) do CPF nº {{cliente_cpf}}, RG/CIN nº {{cliente_rg}}, expedido por {{cliente_emissor_rg}}/{{cliente_uf_emissor_rg}}, residente e domiciliado(a) em {{cliente_endereco}}, e-mail {{cliente_email}}, telefone {{cliente_telefone}}.</p>

  <h2>OUTORGADO(S)</h2>
  <p><strong>OUTORGADO:</strong> {{empresa_razao_social}}, pessoa jurídica inscrita no CNPJ sob nº {{empresa_cnpj_completo}}, com sede em {{empresa_endereco}}, neste ato representada por {{empresa_representante}}, CPF nº {{empresa_representante_cpf}}.</p>

  <h2>PODERES</h2>
  <p><strong>PODERES:</strong> Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui como seu bastante procurador o OUTORGADO, a quem confere amplos, gerais e ilimitados poderes para, em seu nome, praticar os seguintes atos:</p>

  <ol class="qa-procuracao__powers">
    <li><strong>PERANTE AS DELEGACIAS DE POLÍCIA NO BRASIL:</strong> Requerer, junto a qualquer delegacia de polícia do Brasil, cópias de boletins de ocorrência e/ou quaisquer outros documentos relacionados, podendo, para tanto, assinar documentos, formular requerimentos e praticar todos os atos necessários para o fiel cumprimento deste mandato. Incluem-se, mas não se limitam a, as seguintes delegacias:
      <ul>
        <li>Delegacia de Polícia Civil</li><li>Delegacia de Polícia Federal</li><li>Delegacia de Polícia Rodoviária Federal</li><li>Delegacia de Polícia Militar</li><li>Delegacia de Crimes Cibernéticos</li><li>Delegacia de Crimes contra o Patrimônio</li><li>Delegacia de Crimes Ambientais</li><li>Delegacia de Narcóticos</li><li>Delegacia de Homicídios</li><li>Delegacia de Repressão ao Tráfico de Entorpecentes</li>
      </ul>
    </li>
    <li><strong>PERANTE O EXÉRCITO BRASILEIRO:</strong> Requerer ou responder ao Serviço de Fiscalização de Produtos Controlados do Comando de todas as Regiões Militares do Brasil (SFPCs), assinar requerimentos, termos e declarações, protocolar e retirar processos para:
      <ul>
        <li>Concessão de Certificado de Registro Pessoa Física</li><li>Primeira via de CRAF</li><li>Segunda via de CRAF</li><li>Exclusão de arma do SIGMA por distrato com fornecedor</li><li>Transferência de arma de CAC para um acervo SINARM - mesmo proprietário</li><li>Transferência de arma de militar das Forças Armadas para CAC - mesmo proprietário</li><li>Transferência de arma de militar das Forças Armadas para CAC - mudança de proprietário</li><li>Transferência de arma de militar da PM/CBM para CAC - mesmo proprietário</li><li>Transferência de arma em acervo SINARM para CAC - mudança de proprietário</li><li>Transferência de arma em acervo SINARM para CAC - mesmo proprietário</li><li>Transferência de arma de entidade de tiro para CAC</li><li>Exclusão de arma do SIGMA por entrega para destruição na campanha do desarmamento</li><li>Exclusão de arma do SIGMA por duplicidade de registro em acervo SIGMA</li><li>Exclusão de arma do SIGMA por já constar em acervo SINARM ou SIGMA</li><li>Emissão de mapa de armas em acervo SIGMA</li><li>Mudança de acervo de arma para um mesmo CAC</li><li>Transferência de arma de CAC para CAC</li><li>Correção de dados da arma de fogo</li><li>Emissão de 2ª via do CRAF</li><li>Renovação do CRAF</li><li>Inclusão de registro de arma por migração do banco antigo</li><li>Inclusão de registro de arma por autorização de anistia</li><li>Transferência de arma de CAC para um acervo SINARM - mudança de proprietário</li><li>Exclusão de arma do SIGMA por transferência para outro acervo SIGMA de militar da PM/CBM</li>
      </ul>
    </li>
    <li><strong>PERANTE A POLÍCIA FEDERAL:</strong> Requerer ao Núcleo de Controle de Armas - NUARM e Sistema Nacional de Armas para Caçadores, Atiradores Desportivos e Colecionares - SINARM CAC, em todo território nacional, requerimentos, termos e declarações, protocolar e retirar processos para autorização de compra de arma de fogo, registro e apostilamento de arma de fogo, guia de trânsito e tráfego especial, posse, porte e renovação de armas de fogo, entre outros serviços relacionados e correlacionados a arma de fogo de pessoa física ou jurídica, respondendo solidariamente pelos documentos apresentados.</li>
  </ol>

  <p>Este mandato é válido por prazo indeterminado, ou até que seja expressamente revogado pelo(a) OUTORGANTE.</p>

  <p class="qa-doc__date">Jacareí, {{data_hoje_extenso}}.</p>

  <div class="qa-doc__signature">
    <span>{{cliente_nome_completo}}</span>
    <small>CPF nº {{cliente_cpf}}</small>
  </div>
</article>`;

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
    if (matches && matches.length) {
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

// ── Toolbar ─────────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, title, active, children,
}: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`h-7 w-7 flex items-center justify-center rounded transition-colors text-[13px]
        ${active ? "bg-[#7B1C2E] text-white" : "hover:bg-slate-100 text-slate-700"}`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 self-center" />;
}

export default function QAProcuracaoPrimarioAdmin() {
  const [vigente, setVigente] = useState<TemplateVigente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [subs, setSubs] = useState<Substituicao[]>([]);

  // Editor state — innerHTML kept in ref to avoid React fighting contentEditable
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorHtml, setEditorHtml] = useState(""); // synced from editor on input
  const [hits, setHits] = useState<Array<{ de: string; para: string; count: number }>>([]);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [novaSub, setNovaSub] = useState<{ texto: string; placeholder: string; descricao: string }>({
    texto: "", placeholder: "", descricao: "",
  });
  const [verCodigoVigente, setVerCodigoVigente] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [modoEditor, setModoEditor] = useState<"visual" | "html">("visual");
  const [htmlBruto, setHtmlBruto] = useState("");

  // Populates editor imperatively (never during editing — cursor-safe)
  const setEditorContent = useCallback((html: string, sbs?: Substituicao[]) => {
    const subsToUse = sbs ?? subs;
    const { saida, hits: h } = stringar(html, subsToUse);
    if (editorRef.current) editorRef.current.innerHTML = saida;
    setEditorHtml(saida);
    setHits(h);
  }, [subs]);

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
      // Only populate editor on first load (when editor is empty)
      if (template?.corpo_html && !editorRef.current?.innerHTML.trim()) {
        const { saida, hits: h } = stringar(template.corpo_html, sbList);
        if (editorRef.current) editorRef.current.innerHTML = saida;
        setEditorHtml(saida);
        setHits(h);
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
    setEditorContent(texto);
    toast.success(`Arquivo "${file.name}" carregado (${Math.round(texto.length / 1024)} KB)`);
  }

  async function publicar() {
    const html = (modoEditor === "html" ? htmlBruto : editorRef.current?.innerHTML ?? "").trim();
    if (!html) { toast.error("Digite ou envie a procuração"); return; }
    if (!temPlaceholdersObrigatorios(html)) {
      toast.error("A procuração precisa conter {{cliente_nome_completo}} e {{cliente_cpf}}.");
      return;
    }
    const restantes: string[] = [];
    for (const s of subs.filter((x) => x.ativo)) {
      const re = new RegExp(escapeRegex(s.texto_original), "i");
      if (re.test(html)) restantes.push(s.texto_original);
    }
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

  function inserirModeloPadrao() {
    if (editorRef.current?.innerHTML.trim() && !confirm("Substituir o conteúdo atual pelo modelo padrão?")) return;
    setEditorContent(MODELO_HTML_PADRAO);
    setNomeArquivo("modelo-html-padrao.html");
    toast.success("Modelo padrão carregado");
  }

  async function copiarHtmlVigente() {
    if (!vigente?.corpo_html) return;
    await navigator.clipboard.writeText(vigente.corpo_html);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function alternarModo(novoModo: "visual" | "html") {
    if (novoModo === modoEditor) return;
    if (novoModo === "html") {
      // Visual → HTML: captura innerHTML atual
      const html = editorRef.current?.innerHTML ?? "";
      setHtmlBruto(html);
    } else {
      // HTML → Visual: aplica o código editado no editor
      const { saida, hits: h } = stringar(htmlBruto, subs);
      if (editorRef.current) editorRef.current.innerHTML = saida;
      setEditorHtml(saida);
      setHits(h);
    }
    setModoEditor(novoModo);
  }

  function onHtmlBrutoChange(valor: string) {
    setHtmlBruto(valor);
    setEditorHtml(valor); // mantém o estado sincronizado para validações
  }

  // ── Editor helpers ────────────────────────────────────────────────────────

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    syncHtml();
  }

  function syncHtml() {
    const html = editorRef.current?.innerHTML ?? "";
    setEditorHtml(html);
  }

  function inserirHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncHtml();
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
        Edite a procuração diretamente no editor abaixo. Os campos do cliente entram automaticamente pelos
        marcadores <code className="font-mono">{'{{cliente_nome_completo}}'}</code> etc. O sistema substitui
        dados pessoais pelos placeholders da empresa antes de publicar.
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
                <textarea
                  readOnly
                  value={vigente.corpo_html}
                  rows={10}
                  className="w-full rounded border px-2 py-1.5 text-[11px] font-mono resize-y bg-slate-900 text-green-300 focus:outline-none"
                  style={{ borderColor: "hsl(220 15% 80%)" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "hsl(220 10% 60%)" }}>
                  Código HTML somente leitura. Use "Copiar HTML" para copiar tudo de uma vez.
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

          {/* Editor WYSIWYG */}
          <div className="space-y-2 mb-3">
            {/* Header do editor */}
            <div className="rounded-lg border bg-slate-50/70 p-3" style={{ borderColor: "hsl(220 15% 90%)" }}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-semibold" style={{ color: "hsl(220 20% 25%)" }}>Editor de texto</h3>
                  <p className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                    Digite normalmente. Use a barra de formatação ou insira trechos prontos abaixo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => inputFileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    {nomeArquivo ? nomeArquivo.slice(0, 22) + (nomeArquivo.length > 22 ? "…" : "") : "Importar arquivo"}
                  </Button>
                  <input ref={inputFileRef} type="file" accept=".html,.htm,.md,.txt" className="hidden"
                    onChange={(e) => onArquivoSelecionado(e.target.files?.[0] ?? null)} />
                  <Button size="sm" type="button" onClick={inserirModeloPadrao}
                    className="h-8 text-xs bg-[#7B1C2E] hover:bg-[#6a1827] text-white gap-1">
                    <Wand2 className="w-3.5 h-3.5" /> Modelo padrão
                  </Button>
                </div>
              </div>

              {/* Toggle Visual / HTML */}
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase mr-1">Modo:</span>
                <button
                  type="button"
                  onClick={() => alternarModo("visual")}
                  className={`h-6 px-3 text-[11px] rounded-l border transition-colors font-medium
                    ${modoEditor === "visual"
                      ? "bg-[#7B1C2E] text-white border-[#7B1C2E]"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                >
                  Visual
                </button>
                <button
                  type="button"
                  onClick={() => alternarModo("html")}
                  className={`h-6 px-3 text-[11px] rounded-r border-t border-r border-b transition-colors font-medium flex items-center gap-1
                    ${modoEditor === "html"
                      ? "bg-[#7B1C2E] text-white border-[#7B1C2E]"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
                >
                  <Code2 className="w-3 h-3" /> HTML
                </button>
              </div>

              {modoEditor === "visual" && (
                <>
                  <div className="flex flex-wrap items-center gap-0.5 rounded border bg-white px-1.5 py-1 mb-2" style={{ borderColor: "hsl(220 15% 88%)" }}>
                    <ToolbarBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)"><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarSep />
                    <ToolbarBtn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda"><AlignLeft className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("justifyCenter")} title="Centralizar"><AlignCenter className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("justifyRight")} title="Alinhar à direita"><AlignRight className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("justifyFull")} title="Justificar"><AlignJustify className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarSep />
                    <ToolbarBtn onClick={() => exec("formatBlock", "h1")} title="Título principal (H1)"><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("formatBlock", "h2")} title="Subtítulo (H2)"><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("formatBlock", "p")} title="Parágrafo normal"><Type className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarSep />
                    <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores"><List className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 self-center">Inserir:</span>
                    <Button size="sm" variant="outline" type="button" className="h-6 text-[10px]"
                      onClick={() => inserirHtml("<h1>TÍTULO DA PROCURAÇÃO</h1>")}>Título</Button>
                    <Button size="sm" variant="outline" type="button" className="h-6 text-[10px]"
                      onClick={() => inserirHtml("<h2>SEÇÃO</h2>")}>Seção</Button>
                    <Button size="sm" variant="outline" type="button" className="h-6 text-[10px]"
                      onClick={() => inserirHtml("<p><strong>OUTORGANTE:</strong> {{cliente_nome_completo}}, CPF nº {{cliente_cpf}}.</p>")}>Outorgante</Button>
                    <Button size="sm" variant="outline" type="button" className="h-6 text-[10px]"
                      onClick={() => inserirHtml("<p><strong>OUTORGADO:</strong> {{empresa_razao_social}}, CNPJ nº {{empresa_cnpj_completo}}.</p>")}>Outorgado</Button>
                    <Button size="sm" variant="outline" type="button" className="h-6 text-[10px]"
                      onClick={() => inserirHtml('<div class="qa-doc__signature"><span>{{cliente_nome_completo}}</span><small>CPF nº {{cliente_cpf}}</small></div>')}>Assinatura</Button>
                  </div>
                </>
              )}

              {modoEditor === "html" && (
                <p className="text-[11px] text-slate-500">
                  Cole ou edite o código HTML diretamente. Mude para <b>Visual</b> para ver e editar como texto formatado.
                </p>
              )}
            </div>

            {/* Alerta de placeholders obrigatórios */}
            <div className={`rounded border px-2 py-1.5 text-[11px] ${temPlaceholdersObrigatorios(editorHtml) ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {temPlaceholdersObrigatorios(editorHtml)
                ? "OK: O modelo contém os marcadores obrigatórios do cliente."
                : "Obrigatório: inclua {{cliente_nome_completo}} e {{cliente_cpf}} antes de publicar."}
            </div>

            {/* Alerta de substituições aplicadas */}
            {hits.length > 0 && (
              <div className="rounded border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] text-green-800">
                <b>{hits.reduce((a, h) => a + h.count, 0)} substituição(ões) aplicada(s):</b>{" "}
                {hits.map((h) => `${h.de} → ${h.para} (${h.count}x)`).join(" · ")}
              </div>
            )}

            {/* Editor visual (contentEditable) — oculto no modo HTML mas mantido no DOM para preservar conteúdo */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncHtml}
              className="w-full min-h-[360px] rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#7B1C2E]/30 bg-white"
              style={{
                display: modoEditor === "visual" ? "block" : "none",
                borderColor: "hsl(220 15% 82%)",
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: "#1a1a1a",
                fontSize: "14px",
                lineHeight: "1.8",
                padding: "24px 28px",
                textAlign: "justify",
              }}
            />

            {/* Editor HTML bruto */}
            {modoEditor === "html" && (
              <textarea
                value={htmlBruto}
                onChange={(e) => onHtmlBrutoChange(e.target.value)}
                placeholder="Cole ou edite o código HTML aqui. Use o toggle 'Visual' para renderizar como texto formatado."
                rows={18}
                className="w-full rounded-lg border px-3 py-2.5 text-[12px] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#7B1C2E]/30 bg-slate-950 text-green-300"
                style={{ borderColor: "hsl(220 15% 80%)" }}
                spellCheck={false}
              />
            )}
            <style>{`
              [contenteditable] h1 {
                text-align: center;
                font-size: 15px;
                line-height: 1.35;
                margin: 0 0 18px;
                text-transform: uppercase;
                font-weight: bold;
              }
              [contenteditable] h2 {
                font-size: 13px;
                margin: 18px 0 8px;
                text-align: center;
                text-transform: uppercase;
                font-weight: bold;
              }
              [contenteditable] .qa-procuracao__letterhead {
                margin: 0 0 24px;
                font-family: Arial, sans-serif;
                font-size: 11px;
                line-height: 1.45;
                text-align: right;
              }
              [contenteditable] p {
                margin: 0 0 12px;
              }
              [contenteditable] ol {
                margin: 10px 0 14px 22px;
              }
              [contenteditable] ul {
                margin: 8px 0 10px 18px;
              }
              [contenteditable] .qa-procuracao__powers li {
                margin-bottom: 12px;
              }
              [contenteditable] .qa-doc__signature {
                margin-top: 36px;
                text-align: center;
              }
              [contenteditable] .qa-doc__signature:before {
                content: "";
                display: block;
                width: 280px;
                max-width: 80%;
                border-top: 1px solid #111;
                margin: 0 auto 8px;
              }
              [contenteditable] .qa-doc__signature span,
              [contenteditable] .qa-doc__signature small {
                display: block;
              }
              [contenteditable]:focus {
                border-color: hsl(352 60% 35%);
              }
            `}</style>

            {/* Rodapé */}
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
                {editorHtml.trim() ? `${Math.round(editorHtml.length / 1024)} KB` : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!editorHtml.trim()}
                  onClick={() => {
                    const html = modoEditor === "html" ? htmlBruto : editorRef.current?.innerHTML ?? "";
                    baixarHtmlProcuracao(html, "Procuracao Quero Armas - Modelo", "Procuração Quero Armas - Modelo");
                    toast.success("HTML da procuração baixado");
                  }}
                  className="text-xs gap-1 h-8"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar HTML
                </Button>
                <Button size="sm" onClick={publicar} disabled={!editorHtml.trim() || publicando}
                  className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-8">
                  {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {publicando ? "Publicando…" : "Publicar procuração"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
