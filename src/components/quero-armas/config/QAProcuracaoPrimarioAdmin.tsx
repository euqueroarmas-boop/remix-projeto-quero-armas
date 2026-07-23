import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { baixarHtmlProcuracao } from "@/lib/quero-armas/procuracaoHtml";
import {
  FileSignature, Upload, Loader2, CheckCircle2, RefreshCw,
  Wand2, Download, Code2, Copy, Check, ChevronDown, ChevronUp, Save,
} from "lucide-react";
import { QAEditorModelo, QAEditorModeloRef, QAEditorInsert } from "./QAEditorModelo";

type TemplateVigente = {
  id: string; versao: number; titulo: string;
  corpo_html: string; data_publicacao: string | null; updated_at: string | null;
};

const CODIGO = "PROCURACAO_PADRAO_QUERO_ARMAS";
const RASCUNHO_KEY = "qa_rascunho_procuracao";
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
    label: "Data",
    title: "Inserir: Linha de cidade/estado e data de assinatura — {{data_hoje_extenso}} é substituído automaticamente",
    html: `<p class="qa-doc__date">{{cliente_cidade}}/{{cliente_estado}}, {{data_hoje_extenso}}.</p>`,
  },
  {
    label: "Assn.",
    title: "Inserir: Bloco de assinatura do cliente (linha + nome + CPF)",
    html: `<div class="qa-doc__signature"><span>{{cliente_nome_completo}}</span><small>CPF nº {{cliente_cpf}}</small></div>`,
  },
];

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

function temPlaceholdersObrigatorios(html: string) {
  const lower = html.toLowerCase();
  return PLACEHOLDERS_OBRIGATORIOS.every((p) => lower.includes(p.toLowerCase()));
}

export default function QAProcuracaoPrimarioAdmin() {
  const [vigente, setVigente] = useState<TemplateVigente | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editorHtml, setEditorHtml] = useState("");
  const [initialHtml, setInitialHtml] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [verCodigoVigente, setVerCodigoVigente] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [temRascunho, setTemRascunho] = useState(() => !!localStorage.getItem(RASCUNHO_KEY));

  const [clienteIdRegen, setClienteIdRegen] = useState("");
  const [regenerando, setRegenerando] = useState(false);

  const editorRef = useRef<QAEditorModeloRef>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  function salvarRascunho() {
    const html = editorRef.current?.getHtml() ?? "";
    if (!html.trim()) { toast.error("Editor vazio — nada para salvar"); return; }
    localStorage.setItem(RASCUNHO_KEY, html);
    setTemRascunho(true);
    toast.success("Rascunho salvo localmente (não publicado)");
  }

  function restaurarRascunho() {
    const rascunho = localStorage.getItem(RASCUNHO_KEY);
    if (!rascunho) return;
    if (editorHtml.trim() && !confirm("Substituir o conteúdo atual pelo rascunho salvo?")) return;
    setInitialHtml(rascunho);
    setEditorHtml(rascunho);
    setNomeArquivo("rascunho.html");
    toast.success("Rascunho restaurado");
  }

  function descartarRascunho() {
    if (!confirm("Descartar o rascunho salvo?")) return;
    localStorage.removeItem(RASCUNHO_KEY);
    setTemRascunho(false);
    toast.success("Rascunho descartado");
  }

  // aposPublicacao=true: sempre recarrega o editor com o que foi salvo (ignora edições pendentes)
  async function carregar(aposPublicacao = false) {
    setCarregando(true);
    try {
      const { data: tpl } = await supabase
        .from("qa_contract_templates" as any)
        .select("id, versao, titulo, corpo_html, data_publicacao, updated_at")
        .eq("codigo", CODIGO).eq("vigente", true).maybeSingle();
      const template = (tpl as any) ?? null;
      setVigente(template);
      if (template?.corpo_html) {
        if (aposPublicacao) {
          // Após publicar: mostra exatamente o que foi persistido no banco
          setInitialHtml(template.corpo_html);
          setEditorHtml(template.corpo_html);
          setNomeArquivo(`procuracao-modelo-v${template.versao}.html`);
        } else if (!editorHtml.trim()) {
          // Carga inicial: prefere rascunho local se existir
          const rascunho = localStorage.getItem(RASCUNHO_KEY);
          const htmlParaCarregar = rascunho ?? template.corpo_html;
          setInitialHtml(htmlParaCarregar);
          setEditorHtml(htmlParaCarregar);
          setNomeArquivo(rascunho ? "rascunho.html" : `procuracao-modelo-v${template.versao}.html`);
        }
      }
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function onArquivoSelecionado(file: File | null) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["html", "htm", "md", "txt"].includes(ext || "")) {
      toast.error("Envie em .html, .md ou .txt");
      return;
    }
    const texto = await file.text();
    setNomeArquivo(file.name);
    editorRef.current?.setHtml(texto);
    setEditorHtml(texto);
    toast.success(`Arquivo "${file.name}" carregado (${Math.round(texto.length / 1024)} KB)`);
  }

  function inserirModeloPadrao() {
    const atual = editorRef.current?.getHtml() ?? "";
    if (atual.trim() && !confirm("Substituir o conteúdo atual pelo modelo padrão?")) return;
    editorRef.current?.setHtml(MODELO_HTML_PADRAO);
    setEditorHtml(MODELO_HTML_PADRAO);
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
    if (!confirm("Publicar esta procuração como VIGENTE (versão nova)?")) return;
    setPublicando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-template-publicar", {
        body: { corpo: html, codigo: CODIGO },
      });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Falha ao publicar");
      toast.success(`Procuração publicada — versão ${(data as any).versao}.`);
      localStorage.removeItem(RASCUNHO_KEY);
      setTemRascunho(false);
      await carregar(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao publicar");
    } finally {
      setPublicando(false);
    }
  }

  async function regenerarProcuracao() {
    const id = clienteIdRegen.trim();
    if (!id) { toast.error("Informe o ID do cliente"); return; }
    setRegenerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-gerar-procuracao", {
        body: { cliente_id: Number(id), force_regenerate: true },
      });
      if (error || !(data as any)?.ok) {
        toast.error((data as any)?.error || error?.message || "Erro ao regenerar");
      } else {
        toast.success(`Procuração regenerada com sucesso (ID procuração: ${(data as any)?.id ?? "?"})`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao regenerar");
    } finally {
      setRegenerando(false);
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
        Edite a procuração no editor abaixo. Os campos do cliente entram automaticamente pelos marcadores
        como <code className="font-mono">{'{{cliente_nome_completo}}'}</code>. Use os botões de inserção
        rápida na toolbar para adicionar seções prontas.
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
                  Somente leitura. Use "Copiar HTML" e cole no editor → modo HTML.
                </p>
              </div>
            )}
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
              {editorHtml.trim() && (
                <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
                  {Math.round(editorHtml.length / 1024)} KB
                </p>
              )}
            </div>

            {/* Alerta placeholders obrigatórios */}
            <div className={`rounded border px-2 py-1.5 text-[11px] ${temPlaceholdersObrigatorios(editorHtml) ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {temPlaceholdersObrigatorios(editorHtml)
                ? "OK: O modelo contém os marcadores obrigatórios do cliente."
                : "Obrigatório: inclua {{cliente_nome_completo}} e {{cliente_cpf}} antes de publicar."}
            </div>

            {/* QAEditorModelo */}
            <QAEditorModelo
              ref={editorRef}
              initialHtml={initialHtml}
              onChange={setEditorHtml}
              inserts={INSERTS_PROCURACAO}
              minHeight={380}
              placeholder="Digite ou importe a procuração. Use os botões de inserção rápida na toolbar."
            />

            {/* Aviso de rascunho */}
            {temRascunho && (
              <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
                <Save className="w-3 h-3 shrink-0" />
                <span>Há um <strong>rascunho salvo localmente</strong> carregado no editor.</span>
                <button type="button" onClick={descartarRascunho}
                  className="ml-auto text-amber-600 hover:text-amber-800 underline whitespace-nowrap">
                  Descartar rascunho
                </button>
              </div>
            )}

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
              <Button size="sm" variant="outline" disabled={!editorHtml.trim()}
                onClick={salvarRascunho}
                className="text-xs gap-1 h-8 border-amber-300 text-amber-700 hover:bg-amber-50">
                <Save className="w-3.5 h-3.5" /> Salvar rascunho
              </Button>
              <Button size="sm" onClick={publicar} disabled={!editorHtml.trim() || publicando}
                className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-8">
                {publicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {publicando ? "Publicando…" : "Publicar procuração"}
              </Button>
            </div>
          </div>
          {/* ── Regenerar procuração por cliente ── */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3">
            <p className="text-[11px] font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Regenerar procuração de um cliente
            </p>
            <p className="text-[11px] text-slate-500 mb-2">
              Força a regeneração da procuração com o modelo e formatação atuais, mesmo que já exista uma versão anterior.
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="ID do cliente (numérico)"
                value={clienteIdRegen}
                onChange={(e) => setClienteIdRegen(e.target.value)}
                className="h-8 flex-1 rounded border border-slate-300 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7B1C2E]/40"
              />
              <Button
                size="sm"
                onClick={regenerarProcuracao}
                disabled={regenerando || !clienteIdRegen.trim()}
                className="h-8 text-xs gap-1 bg-[#7B1C2E] hover:bg-[#6a1827] text-white whitespace-nowrap"
              >
                {regenerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {regenerando ? "Regenerando…" : "Regenerar"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
