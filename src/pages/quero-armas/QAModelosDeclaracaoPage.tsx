import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileSignature, Plus, Loader2, Upload, Download, RefreshCw, Trash2, AlertTriangle, CheckCircle2,
  Eye, X, FileText,
} from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const BUCKET = "qa-templates";
const PREFIX = "declaracoes";

const PLACEHOLDERS_OFICIAIS = [
  "[NOME COMPLETO]", "[NACIONALIDADE]", "[NATURALIDADE]", "[DATA NASCIMENTO]",
  "[PROFISSÃO]", "[ESTADO CIVIL]", "[CPF]", "[RG]", "[EMISSOR]",
  "[ENDEREÇO 1]", "[ENDEREÇO 2]", "[CIDADE]", "[DIA]", "[MÊS]", "[ANO]",
  "[EXPEDIÇÃO RG]", "[DATA EXPEDIÇÃO RG]", "[UF EMISSOR RG]",
];

function normalizeSlug(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type StorageRow = {
  name: string;
  template_key: string;
  updated_at: string | null;
  size: number | null;
};

type UsoRow = { id: string; servico_id: string | null; tipo_documento: string | null; nome_servico?: string | null };

type ValidacaoResultado = {
  oficiais: string[];
  naoOficiais: string[];
  bloqueio: string | null;
};

async function extrairTextoDocx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("Arquivo .docx inválido (sem word/document.xml).");
  // Strip tags, preservar texto
  return docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function validarConteudoDocx(texto: string): ValidacaoResultado {
  const placeholderRegex = /\[[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ]+?\]/g;
  const encontrados = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = placeholderRegex.exec(texto)) !== null) encontrados.add(m[0]);

  const oficiais: string[] = [];
  const naoOficiais: string[] = [];
  for (const p of encontrados) {
    if (PLACEHOLDERS_OFICIAIS.includes(p)) oficiais.push(p);
    else naoOficiais.push(p);
  }

  let bloqueio: string | null = null;

  // Heurísticas de "ainda preenchido"
  const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/;
  if (cpfRegex.test(texto)) {
    bloqueio = "O documento parece estar preenchido (CPF detectado). Substitua pelos placeholders [CPF] / [NOME COMPLETO] antes de enviar.";
  } else {
    // Nome próprio em CAPS LOCK: 3+ palavras consecutivas com 3+ chars cada, todas maiúsculas
    const capsRegex = /(?:\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\b\s+){2,}\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\b/;
    // Evita falsos positivos: ignora se for um placeholder oficial conhecido
    const textoSemPlaceholders = texto.replace(placeholderRegex, " ");
    if (capsRegex.test(textoSemPlaceholders)) {
      bloqueio = "O documento parece estar preenchido (nome em CAPS LOCK detectado). Substitua pelos placeholders [NOME COMPLETO] antes de enviar.";
    }
  }

  if (!bloqueio && oficiais.length === 0) {
    bloqueio = "Nenhum placeholder oficial detectado. Edite o .docx no Word e coloque os marcadores como [NOME COMPLETO] / [CPF] / [RG] etc.";
  }

  return { oficiais, naoOficiais, bloqueio };
}

export default function QAModelosDeclaracaoPage() {
  const { profile } = useQAAuthContext();
  const isAdmin = profile?.perfil === "administrador";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StorageRow[]>([]);
  const [usoMap, setUsoMap] = useState<Record<string, UsoRow[]>>({});
  const [servicosMap, setServicosMap] = useState<Record<string, string>>({});

  const [showNovo, setShowNovo] = useState(false);
  const [substituirRow, setSubstituirRow] = useState<StorageRow | null>(null);
  const [excluirRow, setExcluirRow] = useState<StorageRow | null>(null);
  const [visualizarRow, setVisualizarRow] = useState<StorageRow | null>(null);

  const loadedRef = useRef(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [{ data: files, error: listErr }, { data: exigencias }, { data: servicos }] = await Promise.all([
        supabase.storage.from(BUCKET).list(PREFIX, { limit: 1000, sortBy: { column: "name", order: "asc" } }),
        supabase.from("qa_servicos_documentos").select("id, servico_id, tipo_documento, regra_validacao, ativo").eq("ativo", true),
        supabase.from("qa_servicos").select("id, nome"),
      ]);
      if (listErr) throw listErr;

      const filtrados = (files || [])
        .filter((f: any) => f.name && !f.name.startsWith(".") && /\.docx$/i.test(f.name))
        .map((f: any) => ({
          name: f.name as string,
          template_key: (f.name as string).replace(/\.docx$/i, ""),
          updated_at: f.updated_at ?? f.created_at ?? null,
          size: f.metadata?.size ?? null,
        } as StorageRow));
      setRows(filtrados);

      const sm: Record<string, string> = {};
      (servicos || []).forEach((s: any) => { sm[s.id] = s.nome; });
      setServicosMap(sm);

      const um: Record<string, UsoRow[]> = {};
      const pushKey = (key: string | null | undefined, row: UsoRow) => {
        if (!key) return;
        if (!um[key]) um[key] = [];
        um[key].push(row);
      };
      (exigencias || []).forEach((e: any) => {
        const row: UsoRow = {
          id: e.id,
          servico_id: e.servico_id,
          tipo_documento: e.tipo_documento,
          nome_servico: sm[e.servico_id] ?? null,
        };
        const rv = e.regra_validacao || {};
        pushKey(rv.template_key, row);
        if (Array.isArray(rv.template_quando)) {
          rv.template_quando.forEach((tq: any) => pushKey(tq?.template_key, row));
        }
      });
      setUsoMap(um);
    } catch (err: any) {
      console.error("[ModelosDeclaracao] carregar erro:", err);
      toast.error(err?.message || "Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    carregar();
  }, []);

  if (!isAdmin) {
    return (
      <div className="qa-card p-6 max-w-2xl mx-auto text-center">
        <p className="text-sm" style={{ color: "hsl(220 10% 45%)" }}>
          ACESSO RESTRITO À EQUIPE QUERO ARMAS.
        </p>
      </div>
    );
  }

  const baixar = async (row: StorageRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${PREFIX}/${row.name}`, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar link de download");
      return;
    }
    // Faz download via fetch/blob para não vazar a URL na barra
    try {
      const resp = await fetch(data.signedUrl);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = row.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      toast.error("Falha ao baixar o arquivo");
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
            <FileSignature className="h-5 w-5" style={{ color: "hsl(352 60% 30%)" }} />
            MODELOS DE DECLARAÇÃO
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Templates .docx usados pelo assistente guiado e pelo painel para gerar declarações preenchidas com os dados do cliente.
          </p>
        </div>
        <button onClick={() => setShowNovo(true)} className="qa-btn-primary flex items-center gap-1.5 no-glow">
          <Plus className="h-3.5 w-3.5" /> NOVO TEMPLATE
        </button>
      </div>

      {/* Placeholders oficiais */}
      <div className="qa-card p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(220 10% 45%)" }}>
          Placeholders oficiais ({PLACEHOLDERS_OFICIAIS.length})
        </h3>
        <p className="text-xs mb-3" style={{ color: "hsl(220 10% 55%)" }}>
          Coloque esses marcadores literais dentro do .docx no lugar dos dados. Só esses são reconhecidos.
        </p>
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDERS_OFICIAIS.map(p => (
            <code key={p} className="text-[10px] px-2 py-1 rounded-lg font-mono"
              style={{ background: "hsl(220 20% 97%)", color: "hsl(352 60% 30%)", border: "1px solid hsl(220 13% 91%)" }}>
              {p}
            </code>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-[#7A1F2B] rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 qa-card">
          <FileSignature className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm uppercase" style={{ color: "hsl(220 10% 55%)" }}>NENHUM TEMPLATE CADASTRADO</p>
          <p className="text-xs mt-1" style={{ color: "hsl(220 10% 70%)" }}>Use “+ NOVO TEMPLATE” para subir o primeiro .docx.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const uso = usoMap[row.template_key] || [];
            return (
              <div key={row.name} className="qa-card p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold uppercase font-mono" style={{ color: "hsl(220 20% 18%)" }}>
                    {row.template_key}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {uso.length > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold"
                        style={{ background: "hsl(352 60% 30% / 0.08)", color: "hsl(352 60% 30%)", border: "1px solid hsl(352 40% 83%)" }}>
                        EM USO POR {uso.length} EXIGÊNCIA{uso.length > 1 ? "S" : ""}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold"
                        style={{ background: "hsl(220 20% 95%)", color: "hsl(220 10% 45%)", border: "1px solid hsl(220 13% 88%)" }}>
                        NÃO USADO
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>{formatBytes(row.size)}</span>
                    {row.updated_at && (
                      <span className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>
                        {new Date(row.updated_at).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setVisualizarRow(row)} className="qa-btn-outline h-8 px-3 text-[11px] flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> VISUALIZAR
                  </button>
                  <button onClick={() => baixar(row)} className="qa-btn-outline h-8 px-3 text-[11px] flex items-center gap-1.5">
                    <Download className="h-3 w-3" /> BAIXAR
                  </button>
                  <button onClick={() => setSubstituirRow(row)} className="qa-btn-outline h-8 px-3 text-[11px] flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3" /> SUBSTITUIR
                  </button>
                  <button onClick={() => setExcluirRow(row)} className="qa-btn-outline h-8 px-3 text-[11px] flex items-center gap-1.5"
                    style={{ color: "hsl(0 65% 45%)", borderColor: "hsl(0 65% 80%)" }}>
                    <Trash2 className="h-3 w-3" /> EXCLUIR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNovo && (
        <NovoTemplateModal
          chavesExistentes={new Set(rows.map(r => r.template_key))}
          onClose={() => setShowNovo(false)}
          onSuccess={() => { setShowNovo(false); carregar(); }}
        />
      )}
      {substituirRow && (
        <SubstituirTemplateModal
          row={substituirRow}
          onClose={() => setSubstituirRow(null)}
          onSuccess={() => { setSubstituirRow(null); carregar(); }}
        />
      )}
      {excluirRow && (
        <ExcluirTemplateModal
          row={excluirRow}
          uso={usoMap[excluirRow.template_key] || []}
          onClose={() => setExcluirRow(null)}
          onSuccess={() => { setExcluirRow(null); carregar(); }}
        />
      )}
      {visualizarRow && (
        <VisualizarTemplateModal
          row={visualizarRow}
          uso={usoMap[visualizarRow.template_key] || []}
          onClose={() => setVisualizarRow(null)}
          onBaixar={() => baixar(visualizarRow)}
          onSubstituir={() => { setSubstituirRow(visualizarRow); setVisualizarRow(null); }}
        />
      )}
    </div>
  );
}

/* --------------------------- Validação inline UI --------------------------- */

function BlocoValidacao({ resultado }: { resultado: ValidacaoResultado | null }) {
  if (!resultado) return null;
  return (
    <div className="space-y-2 text-[11px]">
      {resultado.oficiais.length > 0 && (
        <div className="p-2 rounded border" style={{ background: "hsl(142 60% 96%)", borderColor: "hsl(142 40% 80%)" }}>
          <div className="flex items-center gap-1.5 font-semibold uppercase mb-1" style={{ color: "hsl(142 60% 30%)" }}>
            <CheckCircle2 className="h-3 w-3" /> PLACEHOLDERS OFICIAIS DETECTADOS ({resultado.oficiais.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {resultado.oficiais.map(p => (
              <code key={p} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white" style={{ color: "hsl(142 60% 30%)" }}>{p}</code>
            ))}
          </div>
        </div>
      )}
      {resultado.naoOficiais.length > 0 && (
        <div className="p-2 rounded border" style={{ background: "hsl(38 80% 96%)", borderColor: "hsl(38 60% 80%)" }}>
          <div className="flex items-center gap-1.5 font-semibold uppercase mb-1" style={{ color: "hsl(28 70% 38%)" }}>
            <AlertTriangle className="h-3 w-3" /> PLACEHOLDERS NÃO OFICIAIS ({resultado.naoOficiais.length})
          </div>
          <p className="mb-1" style={{ color: "hsl(28 70% 38%)" }}>SAIRÃO CRUS NO DOCUMENTO FINAL.</p>
          <div className="flex flex-wrap gap-1">
            {resultado.naoOficiais.map(p => (
              <code key={p} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white" style={{ color: "hsl(28 70% 38%)" }}>{p}</code>
            ))}
          </div>
        </div>
      )}
      {resultado.bloqueio && (
        <div className="p-2 rounded border" style={{ background: "hsl(0 70% 96%)", borderColor: "hsl(0 60% 80%)" }}>
          <div className="flex items-center gap-1.5 font-semibold uppercase mb-1" style={{ color: "hsl(0 65% 40%)" }}>
            <AlertTriangle className="h-3 w-3" /> ENVIO BLOQUEADO
          </div>
          <p style={{ color: "hsl(0 65% 40%)" }}>{resultado.bloqueio}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Modal NOVO --------------------------------- */

function NovoTemplateModal({
  chavesExistentes, onClose, onSuccess,
}: { chavesExistentes: Set<string>; onClose: () => void; onSuccess: () => void }) {
  const [chave, setChave] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [validacao, setValidacao] = useState<ValidacaoResultado | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const chaveSlug = normalizeSlug(chave);
  const jaExiste = !!chaveSlug && chavesExistentes.has(chaveSlug);

  const handleFile = async (f: File | null) => {
    setFile(f);
    setValidacao(null);
    if (!f) return;
    setAnalisando(true);
    try {
      const texto = await extrairTextoDocx(f);
      setValidacao(validarConteudoDocx(texto));
    } catch (err: any) {
      setValidacao({ oficiais: [], naoOficiais: [], bloqueio: err?.message || "Arquivo .docx inválido." });
    } finally {
      setAnalisando(false);
    }
  };

  const podeEnviar = !!file && !!chaveSlug && !jaExiste && !!validacao && !validacao.bloqueio && !analisando;

  const enviar = async () => {
    if (!file || !chaveSlug) return;
    setEnviando(true);
    try {
      const path = `${PREFIX}/${chaveSlug}.docx`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (error) throw error;
      toast.success("TEMPLATE CRIADO COM SUCESSO");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar template");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="qa-scope max-w-md bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="uppercase">Novo template</DialogTitle>
          <DialogDescription className="text-xs">
            A chave é o identificador técnico usado pelas exigências (regra_validacao.template_key).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase">Chave do template</Label>
            <Input value={chave} onChange={e => setChave(e.target.value)} className="h-9 uppercase font-mono" placeholder="EX.: SEM_INQUERITO_PROCESSO_CRIMINAL" />
            {chave && (
              <p className="text-[10px] font-mono" style={{ color: jaExiste ? "hsl(0 65% 40%)" : "hsl(220 10% 55%)" }}>
                Arquivo: declaracoes/{chaveSlug || "—"}.docx
                {jaExiste && " — JÁ EXISTE. USE SUBSTITUIR NA LINHA EXISTENTE."}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase">Arquivo .docx</Label>
            <Input type="file" accept=".docx" onChange={e => handleFile(e.target.files?.[0] || null)} className="h-9" />
          </div>
          {analisando && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando conteúdo...
            </div>
          )}
          <BlocoValidacao resultado={validacao} />
        </div>
        <DialogFooter>
          <button onClick={onClose} className="qa-btn-outline h-9 px-4 text-xs">CANCELAR</button>
          <button onClick={enviar} disabled={!podeEnviar || enviando} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow disabled:opacity-50">
            {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} ENVIAR
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Modal SUBSTITUIR ------------------------------ */

function SubstituirTemplateModal({
  row, onClose, onSuccess,
}: { row: StorageRow; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [validacao, setValidacao] = useState<ValidacaoResultado | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleFile = async (f: File | null) => {
    setFile(f);
    setValidacao(null);
    if (!f) return;
    setAnalisando(true);
    try {
      const texto = await extrairTextoDocx(f);
      setValidacao(validarConteudoDocx(texto));
    } catch (err: any) {
      setValidacao({ oficiais: [], naoOficiais: [], bloqueio: err?.message || "Arquivo .docx inválido." });
    } finally {
      setAnalisando(false);
    }
  };

  const podeEnviar = !!file && !!validacao && !validacao.bloqueio && !analisando;

  const enviar = async () => {
    if (!file) return;
    setEnviando(true);
    try {
      const path = `${PREFIX}/${row.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (error) throw error;
      toast.success(`TEMPLATE ATUALIZADO. AS EXIGÊNCIAS APONTANDO PARA ${row.template_key} PASSAM A USAR A NOVA VERSÃO.`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao substituir template");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="qa-scope max-w-md bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="uppercase">Substituir template</DialogTitle>
          <DialogDescription className="text-xs font-mono">{row.template_key}.docx</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase">Novo arquivo .docx</Label>
            <Input type="file" accept=".docx" onChange={e => handleFile(e.target.files?.[0] || null)} className="h-9" />
          </div>
          {analisando && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando conteúdo...
            </div>
          )}
          <BlocoValidacao resultado={validacao} />
        </div>
        <DialogFooter>
          <button onClick={onClose} className="qa-btn-outline h-9 px-4 text-xs">CANCELAR</button>
          <button onClick={enviar} disabled={!podeEnviar || enviando} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow disabled:opacity-50">
            {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} SUBSTITUIR
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Modal EXCLUIR ------------------------------- */

function ExcluirTemplateModal({
  row, uso, onClose, onSuccess,
}: { row: StorageRow; uso: UsoRow[]; onClose: () => void; onSuccess: () => void }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const exigeConfirmacao = uso.length > 0;
  const podeExcluir = !exigeConfirmacao || confirmacao.trim() === row.template_key;

  const excluir = async () => {
    setExcluindo(true);
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([`${PREFIX}/${row.name}`]);
      if (error) throw error;
      if (uso.length > 0) {
        toast.warning(`TEMPLATE EXCLUÍDO. ${uso.length} EXIGÊNCIA(S) FICAM SEM MODELO PREENCHÍVEL ATÉ REATRIBUIÇÃO.`);
      } else {
        toast.success("TEMPLATE EXCLUÍDO");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir template");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="qa-scope max-w-md bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="uppercase">Excluir template</DialogTitle>
          <DialogDescription className="text-xs font-mono">{row.template_key}.docx</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          {exigeConfirmacao ? (
            <>
              <div className="p-2 rounded border" style={{ background: "hsl(0 70% 96%)", borderColor: "hsl(0 60% 80%)" }}>
                <div className="flex items-center gap-1.5 font-semibold uppercase mb-1" style={{ color: "hsl(0 65% 40%)" }}>
                  <AlertTriangle className="h-3 w-3" /> EM USO POR {uso.length} EXIGÊNCIA(S)
                </div>
                <p style={{ color: "hsl(0 65% 40%)" }}>
                  As exigências abaixo continuarão referenciando esse template, mas ficarão sem modelo preenchível até reatribuição manual.
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
                {uso.map(u => (
                  <div key={u.id} className="text-[11px] uppercase" style={{ color: "hsl(220 20% 25%)" }}>
                    <span className="font-mono">{u.tipo_documento}</span>
                    {u.nome_servico ? <> — {u.nome_servico}</> : null}
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium uppercase">
                  Digite a chave <span className="font-mono">{row.template_key}</span> para confirmar
                </Label>
                <Input value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className="h-9 font-mono" />
              </div>
            </>
          ) : (
            <p style={{ color: "hsl(220 10% 45%)" }}>NENHUMA EXIGÊNCIA USA ESTE TEMPLATE. CONFIRME PARA EXCLUIR.</p>
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="qa-btn-outline h-9 px-4 text-xs">CANCELAR</button>
          <button onClick={excluir} disabled={!podeExcluir || excluindo}
            className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow disabled:opacity-50"
            style={{ background: "hsl(0 65% 45%)" }}>
            {excluindo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} EXCLUIR
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Modal VISUALIZAR ----------------------------- */

type PreviewData = {
  template_key: string;
  filename: string;
  size: number | null;
  updated_at: string | null;
  text: string;
  paragraphs: string[];
  official_placeholders: string[];
  placeholders_found: string[];
  unknown_placeholders: string[];
  missing_placeholders: string[];
  usage_count: number;
  usage: Array<{ id: string; servico_id: string | null; tipo_documento: string | null; nome_servico: string | null }>;
};

function renderParagraphWithPlaceholders(p: string, key: number) {
  // Destaca qualquer [TEXTO] como placeholder; usuário diferencia oficiais/não
  // oficiais pela aba "Placeholders". Aqui só queremos chamar atenção visual.
  const parts: Array<{ kind: "txt" | "ph"; v: string }> = [];
  const re = /\[[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ]+?\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) !== null) {
    if (m.index > last) parts.push({ kind: "txt", v: p.slice(last, m.index) });
    parts.push({ kind: "ph", v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < p.length) parts.push({ kind: "txt", v: p.slice(last) });
  if (parts.length === 0) parts.push({ kind: "txt", v: p });
  return (
    <p key={key} className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "hsl(220 20% 22%)" }}>
      {parts.map((part, i) =>
        part.kind === "ph" ? (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded font-mono text-[11px] font-semibold"
            style={{ background: "hsl(352 60% 30% / 0.10)", color: "hsl(352 60% 30%)", border: "1px solid hsl(352 40% 80%)" }}
          >
            {part.v}
          </code>
        ) : (
          <span key={i}>{part.v}</span>
        ),
      )}
    </p>
  );
}

function VisualizarTemplateModal({
  row, uso, onClose, onBaixar, onSubstituir,
}: {
  row: StorageRow;
  uso: UsoRow[];
  onClose: () => void;
  onBaixar: () => void;
  onSubstituir: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [data, setData] = useState<PreviewData | null>(null);
  const [aba, setAba] = useState<"preview" | "placeholders" | "uso">("preview");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error("Sessão expirada. Entre novamente.");
        const base = import.meta.env.VITE_SUPABASE_URL as string;
        const resp = await fetch(`${base}/functions/v1/qa-template-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ template_key: row.template_key }),
        });
        const json = await resp.json().catch(() => null);
        if (!resp.ok) {
          throw new Error(json?.error || "Não foi possível visualizar este template.");
        }
        if (cancel) return;
        setData(json as PreviewData);
      } catch (e: any) {
        if (cancel) return;
        setErro(e?.message || "Não foi possível visualizar este template.");
      } finally {
        if (!cancel) setCarregando(false);
      }
    })();
    return () => { cancel = true; };
  }, [row.template_key]);

  const semTexto = !!data && data.paragraphs.length === 0;
  const temDesconhecido = (data?.unknown_placeholders?.length ?? 0) > 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="qa-scope max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-white text-slate-900 border-slate-200">
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: "hsl(220 13% 91%)" }}>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 55%)" }}>
              Visualizar template
            </div>
            <div className="text-base font-bold font-mono uppercase truncate" style={{ color: "hsl(220 20% 18%)" }}>
              {row.template_key}
            </div>
            <div className="text-[11px] mt-1 flex flex-wrap items-center gap-2" style={{ color: "hsl(220 10% 55%)" }}>
              <span>{formatBytes(data?.size ?? row.size)}</span>
              {(data?.updated_at ?? row.updated_at) && (
                <span>· Atualizado em {new Date((data?.updated_at ?? row.updated_at)!).toLocaleDateString("pt-BR")}</span>
              )}
              <span>· {uso.length} exigência{uso.length === 1 ? "" : "s"} em uso</span>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg border" style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 10% 45%)" }} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b" style={{ borderColor: "hsl(220 13% 91%)" }}>
          {(["preview", "placeholders", "uso"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider border-b-2 -mb-px"
              style={{
                color: aba === a ? "hsl(352 60% 30%)" : "hsl(220 10% 55%)",
                borderColor: aba === a ? "hsl(352 60% 30%)" : "transparent",
              }}
            >
              {a === "preview" ? "Preview" : a === "placeholders" ? "Placeholders" : "Uso"}
            </button>
          ))}
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {carregando && (
            <div className="flex items-center gap-2 text-sm py-12 justify-center" style={{ color: "hsl(220 10% 55%)" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Lendo template...
            </div>
          )}

          {!carregando && erro && (
            <div className="p-3 rounded border text-[12px]" style={{ background: "hsl(0 70% 96%)", borderColor: "hsl(0 60% 80%)", color: "hsl(0 65% 40%)" }}>
              <div className="flex items-center gap-1.5 font-semibold uppercase mb-1">
                <AlertTriangle className="h-3 w-3" /> Erro
              </div>
              {erro}
            </div>
          )}

          {!carregando && !erro && data && (
            <>
              {temDesconhecido && (
                <div className="mb-3 p-2 rounded border text-[11px]" style={{ background: "hsl(38 80% 96%)", borderColor: "hsl(38 60% 80%)", color: "hsl(28 70% 38%)" }}>
                  <div className="flex items-center gap-1.5 font-semibold uppercase mb-0.5">
                    <AlertTriangle className="h-3 w-3" /> Marcadores não reconhecidos
                  </div>
                  Este template contém marcadores que não serão preenchidos automaticamente.
                </div>
              )}

              {aba === "preview" && (
                <div className="space-y-2">
                  {semTexto ? (
                    <div className="p-3 rounded border text-[12px]" style={{ background: "hsl(38 80% 96%)", borderColor: "hsl(38 60% 80%)", color: "hsl(28 70% 38%)" }}>
                      O DOCX não contém texto legível extraível. Verifique se o arquivo foi gerado a partir de texto e não de imagem.
                    </div>
                  ) : (
                    data.paragraphs.map((p, i) => renderParagraphWithPlaceholders(p, i))
                  )}
                </div>
              )}

              {aba === "placeholders" && (
                <div className="space-y-3 text-[11px]">
                  <PHBlock
                    titulo={`OFICIAIS ENCONTRADOS (${data.placeholders_found.length})`}
                    items={data.placeholders_found}
                    tone="ok"
                    vazio="Nenhum placeholder oficial detectado."
                  />
                  <PHBlock
                    titulo={`OFICIAIS NÃO USADOS (${data.missing_placeholders.length})`}
                    items={data.missing_placeholders}
                    tone="muted"
                    vazio="Todos os placeholders oficiais foram usados."
                  />
                  <PHBlock
                    titulo={`DESCONHECIDOS (${data.unknown_placeholders.length})`}
                    items={data.unknown_placeholders}
                    tone="warn"
                    vazio="Nenhum marcador fora da lista oficial."
                  />
                </div>
              )}

              {aba === "uso" && (
                <div className="space-y-2 text-[12px]">
                  {data.usage.length === 0 ? (
                    <p style={{ color: "hsl(220 10% 55%)" }}>Nenhuma exigência usa este template hoje.</p>
                  ) : (
                    data.usage.map((u) => (
                      <div key={u.id} className="p-2 rounded border flex items-start gap-2" style={{ borderColor: "hsl(220 13% 91%)" }}>
                        <FileText className="h-3.5 w-3.5 mt-0.5" style={{ color: "hsl(352 60% 30%)" }} />
                        <div className="min-w-0">
                          <div className="font-mono text-[12px] uppercase" style={{ color: "hsl(220 20% 22%)" }}>{u.tipo_documento || "—"}</div>
                          {u.nome_servico && (
                            <div className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>{u.nome_servico}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "hsl(220 13% 91%)" }}>
          <button onClick={onClose} className="qa-btn-outline h-9 px-4 text-xs">FECHAR</button>
          <button onClick={onSubstituir} className="qa-btn-outline h-9 px-4 text-xs flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" /> SUBSTITUIR
          </button>
          <button onClick={onBaixar} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow">
            <Download className="h-3 w-3" /> BAIXAR
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PHBlock({ titulo, items, tone, vazio }: { titulo: string; items: string[]; tone: "ok" | "warn" | "muted"; vazio: string }) {
  const styles =
    tone === "ok"
      ? { bg: "hsl(142 60% 96%)", bd: "hsl(142 40% 80%)", fg: "hsl(142 60% 30%)" }
      : tone === "warn"
      ? { bg: "hsl(38 80% 96%)", bd: "hsl(38 60% 80%)", fg: "hsl(28 70% 38%)" }
      : { bg: "hsl(220 20% 97%)", bd: "hsl(220 13% 88%)", fg: "hsl(220 10% 45%)" };
  return (
    <div className="p-2 rounded border" style={{ background: styles.bg, borderColor: styles.bd }}>
      <div className="font-semibold uppercase mb-1.5" style={{ color: styles.fg }}>{titulo}</div>
      {items.length === 0 ? (
        <p style={{ color: styles.fg }}>{vazio}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((p) => (
            <code key={p} className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-white" style={{ color: styles.fg }}>{p}</code>
          ))}
        </div>
      )}
    </div>
  );
}