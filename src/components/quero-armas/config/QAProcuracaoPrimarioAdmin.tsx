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

function temPlaceholdersObrigatorios(html: string) {
  const lower = html.toLowerCase();
  return PLACEHOLDERS_OBRIGATORIOS.every((p) => lower.includes(p.toLowerCase()));
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
    if (!temPlaceholdersObrigatorios(corpoStringado)) {
      toast.error("A procuração precisa conter {{cliente_nome_completo}} e {{cliente_cpf}}. Assim ela nunca sai com dados fixos de outro cliente.");
      return;
    }
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

  function inserirModeloPadrao() {
    if (corpoStringado.trim() && !confirm("Substituir o conteúdo atual pelo modelo HTML padrão da procuração?")) return;
    setCorpoOriginal(MODELO_HTML_PADRAO);
    setCorpoStringado(MODELO_HTML_PADRAO);
    setHits([]);
    setNomeArquivo("modelo-html-padrao.html");
    setModoPreview("stringado");
    toast.success("Modelo HTML padrão carregado");
  }

  function inserirTrecho(trecho: string) {
    const atual = modoPreview === "original" ? corpoOriginal : corpoStringado;
    const proximo = atual ? `${atual}\n${trecho}` : trecho;
    if (modoPreview === "original") {
      setCorpoOriginal(proximo);
      recalcularPreview(proximo);
    } else {
      setCorpoStringado(proximo);
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
            <div className="rounded-lg border bg-slate-50/70 p-3" style={{ borderColor: "hsl(220 15% 90%)" }}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold" style={{ color: "hsl(220 20% 25%)" }}>Editor HTML do modelo</h3>
                  <p className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                    Use o modelo abaixo ou monte com trechos. Os campos do cliente entram automaticamente pelos marcadores.
                  </p>
                </div>
                <Button size="sm" type="button" onClick={inserirModeloPadrao}
                  className="h-8 text-xs bg-[#7B1C2E] hover:bg-[#6a1827] text-white gap-1">
                  <Wand2 className="w-3.5 h-3.5" /> Usar modelo formatado
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Button size="sm" variant="outline" type="button" className="h-7 text-[11px]" onClick={() => inserirTrecho("<h1>TÍTULO DA PROCURAÇÃO</h1>")}>Título</Button>
                <Button size="sm" variant="outline" type="button" className="h-7 text-[11px]" onClick={() => inserirTrecho("<h2>SEÇÃO</h2>")}>Seção</Button>
                <Button size="sm" variant="outline" type="button" className="h-7 text-[11px]" onClick={() => inserirTrecho("<p><strong>OUTORGANTE:</strong> {{cliente_nome_completo}}, CPF nº {{cliente_cpf}}.</p>")}>Outorgante</Button>
                <Button size="sm" variant="outline" type="button" className="h-7 text-[11px]" onClick={() => inserirTrecho("<p><strong>OUTORGADO:</strong> {{empresa_razao_social}}, CNPJ nº {{empresa_cnpj_completo}}.</p>")}>Outorgado</Button>
                <Button size="sm" variant="outline" type="button" className="h-7 text-[11px]" onClick={() => inserirTrecho('<div class="qa-doc__signature"><span>{{cliente_nome_completo}}</span><small>CPF nº {{cliente_cpf}}</small></div>')}>Assinatura</Button>
              </div>
              <div className={`mt-3 rounded border px-2 py-1.5 text-[11px] ${temPlaceholdersObrigatorios(corpoStringado) ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                {temPlaceholdersObrigatorios(corpoStringado)
                  ? "OK: O modelo contém os marcadores obrigatórios do cliente."
                  : "Obrigatório: inclua {{cliente_nome_completo}} e {{cliente_cpf}} antes de publicar."}
              </div>
            </div>

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
            {corpoStringado.trim() && (
              <div className="rounded-lg border bg-[#f6f5f1] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: "hsl(220 10% 48%)" }}>
                  Prévia formatada do cliente
                </p>
                <div
                  className="bg-white rounded border p-5 text-sm leading-7 qa-procuracao-admin-preview"
                  dangerouslySetInnerHTML={{ __html: corpoStringado }}
                />
                <style>{`
                  .qa-procuracao-admin-preview {
                    font-family: Georgia, 'Times New Roman', serif;
                    color: #1a1a1a;
                    text-align: justify;
                  }
                  .qa-procuracao-admin-preview h1 {
                    text-align: center;
                    font-size: 16px;
                    line-height: 1.35;
                    margin: 0 0 18px;
                    text-transform: uppercase;
                  }
                  .qa-procuracao-admin-preview h2 {
                    font-size: 13px;
                    margin: 18px 0 8px;
                    text-align: center;
                    text-transform: uppercase;
                  }
                  .qa-procuracao-admin-preview .qa-procuracao__letterhead {
                    margin: 0 0 24px;
                    font-family: Arial, sans-serif;
                    font-size: 11px;
                    line-height: 1.45;
                    text-align: right;
                  }
                  .qa-procuracao-admin-preview p {
                    margin: 0 0 12px;
                  }
                  .qa-procuracao-admin-preview ol {
                    margin: 10px 0 14px 22px;
                  }
                  .qa-procuracao-admin-preview ul {
                    margin: 8px 0 10px 18px;
                  }
                  .qa-procuracao-admin-preview .qa-procuracao__powers li {
                    margin-bottom: 12px;
                  }
                  .qa-procuracao-admin-preview .qa-doc__signature {
                    margin-top: 36px;
                    text-align: center;
                  }
                  .qa-procuracao-admin-preview .qa-doc__signature:before {
                    content: "";
                    display: block;
                    width: 280px;
                    max-width: 80%;
                    border-top: 1px solid #111;
                    margin: 0 auto 8px;
                  }
                  .qa-procuracao-admin-preview .qa-doc__signature span,
                  .qa-procuracao-admin-preview .qa-doc__signature small {
                    display: block;
                  }
                `}</style>
              </div>
            )}
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
