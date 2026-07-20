// ============================================================================
// MotorPendenciaFichaModal — Fachada visual "Ficha Clara v2"
// ----------------------------------------------------------------------------
// Camada NOVA e ADITIVA. Aberta quando o cliente clica em uma pendência no
// portal (payload com focusDocId). Reúne em um layout tipo ficha (Oswald +
// Arial Narrow, papel #F4F1EA, vinho #7A1F2B):
//   • Dados do requerente e da exigência (busca em qa_clientes + qa_processo_documentos)
//   • Card Documento (dropzone) + Card Análise (Hub Documental), equalizados
//   • Busca de profissionais credenciados pela PF (useCredenciadosPsico / IAT)
//     com link direto para WhatsApp
//
// IMPORTANTE — regra do produto:
// Esta ficha é APENAS a fachada. Ao clicar em "Selecionar arquivo" ou "Tirar
// foto", chamamos onContinuar() — o pai (ChecklistGuiado) fecha a ficha e
// abre o ChecklistGuiadoModal legado com o mesmo focusDocId. Assim toda a
// engine de upload/validação/IA existente continua sendo a única fonte da
// verdade (zero regressão).
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  enviarDocumentoGuia,
  aguardarValidacaoIAGuia,
  type GuiaProcesso,
  type GuiaDoc,
} from "@/lib/quero-armas/checklistGuiadoEngine";
import {
  useCredenciadosPsico,
  type BuscarParams as BuscarPsicoParams,
} from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosPsico";
import { useCredenciadosIAT } from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosIAT";

// ---------------------------------------------------------------------------
// Config por tipo de documento (espelha o mock aprovado motor-pendencias-17)
// ---------------------------------------------------------------------------

type Profissional = "psicologo" | "instrutor_tiro" | null;

type RequirementConfig = {
  titulo: string;
  subtitulo: string;
  categoria: string;
  profissional: Profissional;
  baseLegal: string;
  validade?: string;
};

const CONFIGS: Record<string, RequirementConfig> = {
  laudo_psicologico: {
    titulo: "Laudo Psicológico",
    subtitulo: "Psicólogo credenciado pela Polícia Federal",
    categoria: "Exames Técnicos",
    profissional: "psicologo",
    baseLegal: "LEI 10.826/03 · DEC. 11.615/23 · IN DG/PF 201",
    validade: "12 meses",
  },
  atestado_capacidade_tecnica: {
    titulo: "Atestado de Capacidade Técnica",
    subtitulo: "Instrutor de tiro credenciado pela Polícia Federal",
    categoria: "Exames Técnicos",
    profissional: "instrutor_tiro",
    baseLegal: "LEI 10.826/03 · DEC. 11.615/23 · DEC. 12.345/24 · IN DG/PF 201 · IN DG/PF 311",
    validade: "12 meses",
  },
};

function getConfig(tipo: string | null | undefined, fallbackNome?: string | null): RequirementConfig {
  const k = String(tipo || "").toLowerCase();
  if (CONFIGS[k]) return CONFIGS[k];
  return {
    titulo: (fallbackNome || tipo || "Documento").toString(),
    subtitulo: "Exigência do processo",
    categoria: "Documentos",
    profissional: null,
    baseLegal: "LEI 10.826/03",
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  clienteId: number;
  focusDocId: string;
  processoId?: string | null;
  open: boolean;
  onClose: () => void;
  /**
   * Legado — mantido para compatibilidade. Se informado, é chamado como
   * fallback (ex.: pendência sem processo). O fluxo padrão faz upload aqui
   * mesmo, reutilizando enviarDocumentoGuia + aguardarValidacaoIAGuia.
   */
  onContinuar?: () => void;
  /** Chamado após upload+validação para o pai recarregar dados. */
  onUpdated?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function MotorPendenciaFichaModal({
  clienteId,
  focusDocId,
  processoId,
  open,
  onClose,
  onContinuar,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [processo, setProcesso] = useState<any>(null);
  const [fase, setFase] = useState<"aguardando" | "enviando" | "validando" | "ok" | "erro">("aguardando");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !focusDocId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [docRes, cliRes] = await Promise.all([
          supabase.from("qa_processo_documentos" as any)
            .select("id, processo_id, tipo_documento, nome_documento, instrucoes, status, arquivo_url, updated_at, formato_aceito")
            .eq("id", focusDocId)
            .maybeSingle(),
          supabase.from("qa_clientes" as any)
            .select("id, nome_completo, cep, cidade, estado, bairro, endereco, cpf")
            .eq("id", clienteId)
            .maybeSingle(),
        ]);
        if (cancel) return;
        const d = (docRes as any).data;
        setDoc(d);
        const cli = (cliRes as any).data;
        // Complementa com número de CR (não existe em qa_clientes) buscando no
        // cadastro oficial ou nos itens de venda mais recentes.
        if (cli) {
          try {
            const { data: cr } = await supabase
              .from("qa_cadastro_cr" as any)
              .select("numero_cr")
              .eq("cliente_id", clienteId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if ((cr as any)?.numero_cr) (cli as any).cr_numero = (cr as any).numero_cr;
          } catch { /* opcional */ }
        }
        setCliente(cli);
        if (d?.processo_id) {
          const { data: p } = await supabase.from("qa_processos" as any)
            .select("id, tipo, protocolo, etapa_atual, cliente_id")
            .eq("id", d.processo_id).maybeSingle();
          if (!cancel) setProcesso(p);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, focusDocId, clienteId]);

  // Reset transient state on open/change
  useEffect(() => {
    if (open) {
      setFase("aguardando");
      setErro(null);
      setResultado(null);
    }
  }, [open, focusDocId]);

  const cfg = useMemo(
    () => getConfig(doc?.tipo_documento, doc?.nome_documento),
    [doc?.tipo_documento, doc?.nome_documento],
  );

  // -------- Upload direto (reusa engine do Hub Documental) --------
  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!doc || !processo) {
      // fallback: sem processo, delega ao legado
      onContinuar?.();
      return;
    }
    setErro(null);
    setFase("enviando");
    const proc: GuiaProcesso = {
      id: processo.id,
      cliente_id: processo.cliente_id ?? clienteId,
    } as any;
    const dGuia: GuiaDoc = {
      id: doc.id,
      tipo_documento: doc.tipo_documento,
      formato_aceito: doc.formato_aceito ?? [],
    } as any;
    const env = await enviarDocumentoGuia(proc, dGuia, file);
    if (!env.ok) {
      setErro(env.error ?? "Erro no envio.");
      setFase("erro");
      toast.error(env.error ?? "Erro no envio.");
      return;
    }
    setFase("validando");
    const alvoId = env.documentoId || doc.id;
    const final = await aguardarValidacaoIAGuia(alvoId);
    setResultado(final);
    const st = (final as any)?.status;
    if (st === "aprovado" || st === "dispensado_grupo") {
      setFase("ok");
      toast.success("Documento aprovado pela IA.");
    } else if (st === "em_revisao_humana" || st === "revisao_humana") {
      setFase("ok");
      toast.message("Encaminhado para revisão humana.");
    } else if (st === "invalido" || st === "divergente") {
      setFase("erro");
      setErro((final as any)?.motivo_rejeicao || "Documento não passou na análise.");
      toast.error("Documento não aprovado. Verifique e reenvie.");
    } else {
      setFase("ok");
      toast.message("Análise em andamento.");
    }
    onUpdated?.();
    // Recarrega o slot do doc para refletir status/arquivo_url
    const { data: novo } = await supabase.from("qa_processo_documentos" as any)
      .select("id, processo_id, tipo_documento, nome_documento, instrucoes, status, arquivo_url, updated_at, formato_aceito")
      .eq("id", alvoId).maybeSingle();
    if (novo) setDoc(novo);
  };

  const fmts: string[] = Array.isArray(doc?.formato_aceito) ? doc.formato_aceito : [];
  const acceptAttr = fmts.length
    ? fmts.map((f: string) => (String(f).startsWith(".") || String(f).includes("/") ? f : "." + String(f).toLowerCase())).join(",")
    : ".pdf,.jpg,.jpeg,.png";
  const uploading = fase === "enviando" || fase === "validando";

  const cep = String(cliente?.cep || "").replace(/\D/g, "");
  const uf = String(cliente?.estado || "").toUpperCase();
  const cidade = String(cliente?.cidade || "");

  // Busca de credenciados: só ativa se este tipo exige profissional
  const psicoParams: BuscarPsicoParams | null =
    cfg.profissional === "psicologo" && (cep.length === 8 || uf)
      ? { tipo: "psicologo", cep: cep.length === 8 ? cep : undefined, uf: cep.length === 8 ? undefined : uf, cidade, raio_km: 25, limit: 5 }
      : null;
  const psico = useCredenciadosPsico(psicoParams);

  const iatParams = cfg.profissional === "instrutor_tiro" && (cep.length === 8 || uf)
    ? { cep: cep.length === 8 ? cep : undefined, uf: cep.length === 8 ? undefined : uf, cidade, raio_km: 25, limit: 5 }
    : null;
  const iat = useCredenciadosIAT(iatParams);

  const buscaLoading = cfg.profissional === "psicologo" ? psico.loading : cfg.profissional === "instrutor_tiro" ? iat.loading : false;
  const buscaResultados = cfg.profissional === "psicologo"
    ? (psico.results || []).map((r) => ({
        id: r.id, nome: r.nome, endereco: r.endereco || `${r.cidade || ""}/${r.uf}`,
        contato: r.telefones?.[0] || r.emails?.[0] || "—",
        telefone: r.telefones?.[0] || null,
        distancia_km: r.distancia_km ?? null,
        credencial: r.registro ? `CREDENCIADO PF · ${r.registro}` : "CREDENCIADO PF",
      }))
    : cfg.profissional === "instrutor_tiro"
    ? (iat.data?.results || []).map((r) => ({
        id: r.id, nome: r.nome, endereco: r.endereco || `${uf}`,
        contato: r.telefone || r.email || "—",
        telefone: r.telefone || null,
        distancia_km: r.distancia_km ?? null,
        credencial: r.portaria ? `CREDENCIADO PF · ${r.portaria}` : "CREDENCIADO PF",
      }))
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden bg-transparent border-0 shadow-none sm:max-w-none w-[calc(100vw-8rem)] max-h-[calc(100vh-8rem)]"
        style={{ fontFamily: '"Arial Narrow", Arial, sans-serif' }}
      >
        <div style={ficha.wrap}>
          {loading ? (
            <div style={{ padding: 60, display: "flex", justifyContent: "center", color: "#6B6B6B" }}>
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ ...ficha.pad, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div>
                  <div style={ficha.eyebrow}>Ficha de Pendência</div>
                  <h1 style={ficha.title}>{cfg.titulo}</h1>
                  <div style={ficha.sub}>{cfg.subtitulo} · {cfg.categoria}</div>
                </div>
                <span style={{ ...ficha.chip, ...ficha.chipAmber }}>Aguardando você</span>
              </div>
              <div style={ficha.divider} />

              {/* Requerente + Exigência */}
              <div style={{ ...ficha.pad, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={ficha.sectionTitle}>Requerente</div>
                  <KV k="Nome" v={String(cliente?.nome_completo || "—").toUpperCase()} />
                  {cliente?.cr_numero && <KV k="CR" v={cliente.cr_numero} />}
                  <KV k="Endereço" v={`${cidade || "—"}/${uf || "—"} · ${cliente?.cep || ""}`} />
                  {processo && <KV k="Serviço" v={String(processo.tipo || "—").toUpperCase()} />}
                  {processo?.etapa_atual && <KV k="Etapa" v={String(processo.etapa_atual).toUpperCase()} />}
                </div>
                <div>
                  <div style={ficha.sectionTitle}>Exigência</div>
                  <KV k="Documento" v={String(doc?.nome_documento || cfg.titulo).toUpperCase()} />
                  {cfg.validade && <KV k="Validade" v={cfg.validade} />}
                  <KV k="Status atual" v={String(doc?.status || "pendente").toUpperCase()} />
                  <KV k="Base legal" v={cfg.baseLegal} />
                </div>
              </div>

              {/* Documento + Análise */}
              <div style={{ ...ficha.pad, paddingTop: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Documento */}
                <div style={{ ...ficha.card, ...ficha.equal }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={ficha.sectionTitle}>Documento</div>
                    <span style={{ ...ficha.chip, ...ficha.chipGhost }}>
                      {doc?.arquivo_url ? "Arquivo enviado" : "Aguardando anexo"}
                    </span>
                  </div>
                  <div style={ficha.dropzone}>
                    <div style={ficha.up}>↑</div>
                    <div style={ficha.dzTitle}>Envie o documento em PDF, JPG ou PNG</div>
                    <div style={ficha.dzText}>
                      A mesma IA do Hub Documental faz a leitura, valida os dados e{" "}
                      {cfg.profissional ? "confirma se o profissional é credenciado pela PF." : "verifica o conteúdo."}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        style={{ ...ficha.btn, ...ficha.btnPrimary, opacity: uploading ? 0.6 : 1, cursor: uploading ? "wait" : "pointer" }}
                      >
                        {fase === "enviando" ? "Enviando..." : fase === "validando" ? "Analisando..." : "Selecionar arquivo"}
                      </button>
                      <button
                        onClick={() => camRef.current?.click()}
                        disabled={uploading}
                        style={{ ...ficha.btn, ...ficha.btnGhost, opacity: uploading ? 0.6 : 1, cursor: uploading ? "wait" : "pointer" }}
                      >
                        Tirar foto (mobile)
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept={acceptAttr}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          void handleFile(f);
                        }}
                      />
                      <input
                        ref={camRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          void handleFile(f);
                        }}
                      />
                    </div>
                    {erro && (
                      <div style={{ marginTop: 12, fontSize: 12.5, color: "#7A1F2B", fontWeight: 600 }}>{erro}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#6B6B6B", fontSize: 12, marginTop: 12 }}>
                    <span>Tamanho máximo 20 MB</span>
                    <span>{doc?.updated_at ? `Última análise: ${new Date(doc.updated_at).toLocaleDateString("pt-BR")}` : "Sem análise anterior"}</span>
                  </div>
                </div>

                {/* Análise */}
                <div style={{ ...ficha.card, ...ficha.equal }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={ficha.sectionTitle}>Análise · Hub Documental</div>
                    <span style={{ ...ficha.chip, ...ficha.chipAmber }}>
                      {fase === "enviando" ? "Enviando" : fase === "validando" ? "Em análise" : fase === "ok" ? "Analisado" : fase === "erro" ? "Rejeitado" : (doc?.arquivo_url ? "Em análise" : "Aguardando arquivo")}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                    <Mini label="Confiança IA" value={resultado?.confianca_ia != null ? `${Math.round(Number(resultado.confianca_ia) * 100)}%` : "—"} />
                    <Mini label="Status" value={(resultado?.status || doc?.status || "—").toString().toUpperCase()} />
                    <Mini label={cfg.profissional ? "Credencial PF" : "IA"} value={fase === "ok" ? "OK" : fase === "erro" ? "ERRO" : uploading ? "..." : "—"} />
                  </div>
                  <div style={ficha.log}>
                    <div><span style={ficha.logT}>agora</span>Pendência aberta · tipo <b>{doc?.tipo_documento || "—"}</b></div>
                    <div><span style={ficha.logT}>agora</span>Motor pronto · usará a mesma IA do Hub Documental</div>
                    {fase === "enviando" && <div><span style={ficha.logT}>agora</span>Enviando arquivo para o cofre seguro...</div>}
                    {fase === "validando" && <div><span style={ficha.logT}>agora</span>IA analisando o conteúdo do documento...</div>}
                    {fase === "ok" && <div><span style={ficha.logT}>agora</span>Análise concluída · status <b>{(resultado?.status || doc?.status || "—").toString().toUpperCase()}</b></div>}
                    {fase === "erro" && erro && <div><span style={ficha.logT}>agora</span>{erro}</div>}
                  </div>
                </div>
              </div>

              {/* Busca de credenciados */}
              {cfg.profissional && (
                <>
                  <div style={ficha.divider} />
                  <div style={ficha.pad}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={ficha.sectionTitle}>
                        {cfg.profissional === "psicologo" ? "Psicólogos" : "Instrutores"} credenciados pela PF próximos de {cidade || "—"}/{uf || "—"}
                      </div>
                      <span style={ficha.chip}>Raio 25 km</span>
                    </div>
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                      {buscaLoading && (
                        <div style={{ color: "#6B6B6B", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                          <Loader2 className="h-4 w-4 animate-spin" /> Buscando credenciados...
                        </div>
                      )}
                      {!buscaLoading && buscaResultados.length === 0 && (
                        <div style={{ color: "#6B6B6B", fontSize: 13 }}>
                          Nenhum credenciado encontrado para este raio.
                        </div>
                      )}
                      {buscaResultados.map((p) => (
                        <ProCard key={p.id} pro={p} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Footer */}
              <div style={ficha.footer}>
                <span>Base legal · {cfg.baseLegal}</span>
                <span>Quero Armas · Área do cliente</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px dashed #EDE7D9", fontSize: 14 }}>
      <span style={{ color: "#6B6B6B" }}>{k}</span>
      <span style={{ color: "#0A0A0A", fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #D9D3C6", borderRadius: 2, padding: 12 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "#6B6B6B" }}>{label}</div>
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, color: "#0A0A0A", marginTop: 6, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function ProCard({ pro }: { pro: { id: string; nome: string; endereco: string; contato: string; telefone: string | null; distancia_km: number | null; credencial: string } }) {
  const waHref = pro.telefone ? `https://wa.me/55${String(pro.telefone).replace(/\D/g, "")}` : null;
  return (
    <div style={{ border: "1px solid #D9D3C6", borderRadius: 2, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto", gap: 12, background: "#fff" }}>
      <div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: "#0A0A0A" }}>{pro.nome}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ ...ficha.chip, ...ficha.chipOk }}>{pro.credencial}</span>
        </div>
        <div style={{ color: "#2A2A2A", fontSize: 13, marginTop: 6 }}>{pro.endereco}</div>
        <div style={{ color: "#6B6B6B", fontSize: 12.5, marginTop: 4 }}>{pro.contato}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        {pro.distancia_km != null && (
          <span style={{ fontFamily: "Oswald, sans-serif", color: "#7A1F2B", fontSize: 12, letterSpacing: "0.18em" }}>
            {pro.distancia_km.toFixed(1)} km
          </span>
        )}
        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer" style={{ ...ficha.btn, ...ficha.btnWa, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3.5A11 11 0 0 0 3.6 18.3L2 22l3.8-1.5A11 11 0 1 0 20 3.5Zm-8 18a9 9 0 0 1-4.6-1.3l-.3-.2-2.3.9.9-2.2-.2-.4a9 9 0 1 1 6.5 3.2Z"/></svg>
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estilos inline (isolamento total — Ficha Clara v2)
// ---------------------------------------------------------------------------

const ficha: Record<string, React.CSSProperties> = {
  wrap: { background: "#FFFFFF", border: "1px solid #E5E1D6", borderRadius: 6, maxHeight: "calc(100vh - 8rem)", overflowY: "auto", color: "#0A0A0A" },
  pad: { padding: "22px 26px" },
  eyebrow: { fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: "0.28em", color: "#6B6B6B", textTransform: "uppercase" },
  title: { fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 30, letterSpacing: "0.02em", margin: "6px 0 4px", textTransform: "uppercase", color: "#0A0A0A" },
  sub: { color: "#6B6B6B", fontSize: 13.5 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #7A1F2B", color: "#7A1F2B", background: "#F5E7EA", fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 999 },
  chipOk: { borderColor: "#2F6B3A", color: "#2F6B3A", background: "#E7F0E8" },
  chipAmber: { borderColor: "#8A5B00", color: "#8A5B00", background: "#FBEFC7" },
  chipGhost: { borderColor: "#D9D3C6", color: "#2A2A2A", background: "transparent" },
  divider: { height: 1, background: "#D9D3C6" },
  sectionTitle: { fontFamily: "Oswald, sans-serif", fontSize: 13, letterSpacing: "0.28em", textTransform: "uppercase", color: "#0A0A0A", marginBottom: 12 },
  card: { border: "1px solid #E5E1D6", borderRadius: 3, padding: 20, background: "#FAFAF7" },
  equal: { display: "flex", flexDirection: "column", minHeight: 420 },
  dropzone: { flex: 1, border: "1.5px dashed #7A1F2B", background: "#F5E7EA", borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, gap: 10 },
  up: { width: 38, height: 38, borderRadius: "50%", background: "#7A1F2B", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Oswald, sans-serif", fontWeight: 700 },
  dzTitle: { fontFamily: "Oswald, sans-serif", fontSize: 15, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7A1F2B" },
  dzText: { color: "#2A2A2A", fontSize: 13.5, maxWidth: 420, lineHeight: 1.5 },
  btn: { fontFamily: "Oswald, sans-serif", fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", padding: "11px 18px", borderRadius: 2, cursor: "pointer", border: "1px solid #0A0A0A" },
  btnPrimary: { background: "#7A1F2B", color: "#fff", borderColor: "#7A1F2B" },
  btnGhost: { background: "#fff", color: "#0A0A0A" },
  btnWa: { background: "#128C7E", color: "#fff", borderColor: "#128C7E" },
  log: { background: "#FBF7EC", border: "1px solid #EDE7D9", borderRadius: 2, padding: 12, fontSize: 12.5, lineHeight: 1.7, color: "#2A2A2A", marginTop: 12 },
  logT: { color: "#6B6B6B", fontFamily: "Oswald, sans-serif", marginRight: 8, fontSize: 11, letterSpacing: "0.15em" },
  footer: { display: "flex", justifyContent: "space-between", color: "#6B6B6B", fontSize: 11.5, padding: "12px 24px", borderTop: "1px solid #D9D3C6", letterSpacing: "0.14em", fontFamily: "Oswald, sans-serif", textTransform: "uppercase" },
};