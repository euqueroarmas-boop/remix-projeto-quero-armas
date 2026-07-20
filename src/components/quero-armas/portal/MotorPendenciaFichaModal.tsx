// ============================================================================
// MotorPendenciaFichaModal — Ficha de Pendência v3
// ----------------------------------------------------------------------------
// Fachada visual para pendências do portal do cliente.
// Upload delega ao ClienteDocsHubModal (Hub Documental — IA qa-classificar).
// Seção de credenciados PF com busca por endereço do cliente (raio 25 km),
// busca manual por estado/cidade, CRP/credencial, link WhatsApp.
// Tipografia: Oswald (destaque) + Arial Narrow (corpo).
// Cores de status: macOS traffic-light (red #FF5F57, yellow #FEBC2E, green #28C840)
// aplicadas de forma discreta.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";
import { ClienteDocsHubModal } from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import {
  useCredenciadosPsico,
  type BuscarParams as BuscarPsicoParams,
} from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosPsico";
import { useCredenciadosIAT } from "@/components/quero-armas/clientes/AgendarExame/useCredenciadosIAT";

// ---------------------------------------------------------------------------
// Cores macOS traffic light
// ---------------------------------------------------------------------------
const MAC = {
  red: "#FF5F57",
  redBg: "rgba(255,95,87,0.08)",
  redBorder: "rgba(255,95,87,0.22)",
  yellow: "#FEBC2E",
  yellowBg: "rgba(254,188,46,0.08)",
  yellowBorder: "rgba(254,188,46,0.28)",
  green: "#28C840",
  greenBg: "rgba(40,200,64,0.08)",
  greenBorder: "rgba(40,200,64,0.22)",
} as const;

// ---------------------------------------------------------------------------
// Config por tipo de documento
// ---------------------------------------------------------------------------
type Profissional = "psicologo" | "instrutor_tiro" | null;

type RequirementConfig = {
  titulo: string;
  subtitulo: string;
  categoria: string;
  profissional: Profissional;
  baseLegal: string;
  validade?: string;
  hubTipo: string;
};

const CONFIGS: Record<string, RequirementConfig> = {
  laudo_psicologico: {
    titulo: "Laudo Psicológico",
    subtitulo: "Psicólogo credenciado pela Polícia Federal",
    categoria: "Exames Técnicos",
    profissional: "psicologo",
    baseLegal: "LEI 10.826/03 · DEC. 11.615/23 · IN DG/PF 201",
    validade: "12 meses",
    hubTipo: "laudo_psicologico",
  },
  atestado_capacidade_tecnica: {
    titulo: "Atestado de Capacidade Técnica",
    subtitulo: "Instrutor de tiro credenciado pela Polícia Federal",
    categoria: "Exames Técnicos",
    profissional: "instrutor_tiro",
    baseLegal: "LEI 10.826/03 · DEC. 11.615/23 · DEC. 12.345/24 · IN DG/PF 201 · IN DG/PF 311",
    validade: "12 meses",
    hubTipo: "laudo_capacidade_tecnica",
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
    hubTipo: k || "outro",
  };
}

// Retorna cor macOS pelo status do documento
function statusColor(status: string | undefined): { dot: string; bg: string; border: string; label: string } {
  const s = String(status || "").toLowerCase();
  if (["aprovado", "dispensado_grupo", "dispensado_por_reaproveitamento"].includes(s))
    return { dot: MAC.green, bg: MAC.greenBg, border: MAC.greenBorder, label: "Aprovado" };
  if (["em_analise", "enviado", "em_revisao_humana", "revisao_humana", "fila"].includes(s))
    return { dot: MAC.yellow, bg: MAC.yellowBg, border: MAC.yellowBorder, label: "Em análise" };
  if (["invalido", "divergente"].includes(s))
    return { dot: MAC.red, bg: MAC.redBg, border: MAC.redBorder, label: "Não aprovado" };
  return { dot: MAC.yellow, bg: MAC.yellowBg, border: MAC.yellowBorder, label: "Pendente" };
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
  onContinuar?: () => void;
  onUpdated?: () => void;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function MotorPendenciaFichaModal({
  clienteId,
  focusDocId,
  open,
  onClose,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [processo, setProcesso] = useState<any>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState(false);

  // busca manual de credenciados
  const [buscaUF, setBuscaUF] = useState("");
  const [buscaCidade, setBuscaCidade] = useState("");
  const [buscaManual, setBuscaManual] = useState(false);

  // Carrega dados
  useEffect(() => {
    if (!open || !focusDocId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [docRes, cliRes] = await Promise.all([
          supabase.from("qa_processo_documentos" as any)
            .select("id, processo_id, tipo_documento, nome_documento, instrucoes, status, arquivo_url, updated_at, formato_aceito, motivo_rejeicao")
            .eq("id", focusDocId)
            .maybeSingle(),
          supabase.from("qa_clientes" as any)
            .select("id, nome_completo, cep, cidade, estado, bairro, endereco, numero, complemento, cpf, celular, email, customer_id")
            .eq("id", clienteId)
            .maybeSingle(),
        ]);
        if (cancel) return;
        setDoc((docRes as any).data);
        const cli = (cliRes as any).data;
        if (cli) {
          setCustomerId(cli.customer_id ?? null);
          try {
            const { data: cr } = await supabase
              .from("qa_cadastro_cr" as any)
              .select("numero_cr")
              .eq("cliente_id", clienteId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if ((cr as any)?.numero_cr) cli.cr_numero = (cr as any).numero_cr;
          } catch { /* opcional */ }
        }
        setCliente(cli);
        const pid = (docRes as any).data?.processo_id;
        if (pid) {
          const { data: p } = await supabase.from("qa_processos" as any)
            .select("id, tipo, protocolo, etapa_atual, cliente_id")
            .eq("id", pid).maybeSingle();
          if (!cancel) setProcesso(p);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, focusDocId, clienteId]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setBuscaUF("");
      setBuscaCidade("");
      setBuscaManual(false);
    }
  }, [open, focusDocId]);

  const cfg = useMemo(
    () => getConfig(doc?.tipo_documento, doc?.nome_documento),
    [doc?.tipo_documento, doc?.nome_documento],
  );

  // Formatação de endereço
  const cep = String(cliente?.cep || "").replace(/\D/g, "");
  const uf = String(cliente?.estado || "").toUpperCase();
  const cidade = String(cliente?.cidade || "");
  const cepFmt = cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : (cliente?.cep || "");
  const cpfRaw = String(cliente?.cpf || "").replace(/\D/g, "");
  const cpfFmt = cpfRaw.length === 11
    ? `${cpfRaw.slice(0, 3)}.${cpfRaw.slice(3, 6)}.${cpfRaw.slice(6, 9)}-${cpfRaw.slice(9)}`
    : (cliente?.cpf || "");
  const linhaLogradouro = [cliente?.endereco, cliente?.numero, cliente?.complemento]
    .filter((v) => v && String(v).trim()).join(", ");
  const linhaLocalidade = [
    cliente?.bairro,
    cidade && uf ? `${cidade}/${uf}` : cidade || uf,
    cepFmt,
  ].filter((v) => v && String(v).trim()).join(" · ");
  const enderecoCompleto = [linhaLogradouro, linhaLocalidade].filter(Boolean).join(" — ") || "—";

  // Parâmetros de busca: manual tem prioridade, senão usa endereço do cliente
  const ufBusca = buscaManual && buscaUF ? buscaUF.toUpperCase() : uf;
  const cidadeBusca = buscaManual && buscaCidade ? buscaCidade : cidade;
  const cepBusca = buscaManual ? undefined : (cep.length === 8 ? cep : undefined);

  const psicoParams: BuscarPsicoParams | null =
    cfg.profissional === "psicologo" && (cepBusca || ufBusca)
      ? { tipo: "psicologo", cep: cepBusca, uf: cepBusca ? undefined : ufBusca, cidade: cidadeBusca, raio_km: 25, limit: 8 }
      : null;
  const psico = useCredenciadosPsico(psicoParams);

  const iatParams = cfg.profissional === "instrutor_tiro" && (cepBusca || ufBusca)
    ? { cep: cepBusca, uf: cepBusca ? undefined : ufBusca, cidade: cidadeBusca, raio_km: 25, limit: 8 }
    : null;
  const iat = useCredenciadosIAT(iatParams);

  const buscaLoading = cfg.profissional === "psicologo" ? psico.loading : cfg.profissional === "instrutor_tiro" ? iat.loading : false;
  const foraDoRaio = cfg.profissional === "psicologo" ? psico.foraDoRaio : false;
  const distMaisProximo = cfg.profissional === "psicologo" ? psico.distanciaMaisProximo : null;

  const credenciados = cfg.profissional === "psicologo"
    ? (psico.results || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        endereco: [r.endereco, r.cidade && r.uf ? `${r.cidade}/${r.uf}` : r.cidade || r.uf].filter(Boolean).join(" — "),
        credencial: r.registro ? `CRP ${r.registro}` : "Credenciado PF",
        telefone: r.telefones?.[0] || null,
        contato: r.emails?.[0] || r.telefones?.[0] || "—",
        distancia_km: r.distancia_km ?? null,
      }))
    : cfg.profissional === "instrutor_tiro"
    ? (iat.data?.results || []).map((r) => ({
        id: r.id,
        nome: r.nome,
        endereco: [r.endereco, uf].filter(Boolean).join(" — "),
        credencial: r.portaria ? `Portaria ${r.portaria}` : "Credenciado PF",
        telefone: r.telefone || null,
        contato: r.email || r.telefone || "—",
        distancia_km: r.distancia_km ?? null,
      }))
    : [];

  const sc = statusColor(doc?.status);

  // Após salvar no Hub Documental
  const handleHubSaved = async () => {
    setHubOpen(false);
    onUpdated?.();
    // Recarrega o slot para refletir o novo status
    await new Promise((r) => setTimeout(r, 900));
    const { data: novo } = await supabase.from("qa_processo_documentos" as any)
      .select("id, processo_id, tipo_documento, nome_documento, instrucoes, status, arquivo_url, updated_at, formato_aceito, motivo_rejeicao")
      .eq("id", focusDocId).maybeSingle();
    if (novo) setDoc(novo);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="p-0 overflow-hidden bg-transparent border-0 shadow-none sm:max-w-none w-[calc(100vw-6rem)] max-h-[calc(100vh-6rem)]"
          style={{ fontFamily: '"Arial Narrow", Arial, sans-serif' }}
        >
          <div style={s.wrap}>
            {loading ? (
              <div style={{ padding: 64, display: "flex", justifyContent: "center", alignItems: "center", color: "#6B6B6B" }}>
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* ── Header ── */}
                <div style={{ ...s.pad, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                  <div>
                    <div style={s.eyebrow}>Ficha de Pendência</div>
                    <h1 style={s.title}>{cfg.titulo}</h1>
                    <div style={s.sub}>{cfg.subtitulo} · {cfg.categoria}</div>
                  </div>
                  {/* Status badge com macOS color */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 999, padding: "6px 14px", flexShrink: 0 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: sc.dot, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: sc.dot }}>{sc.label}</span>
                  </div>
                </div>

                <div style={s.divider} />

                {/* ── Requerente + Exigência ── */}
                <div style={{ ...s.pad, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                  <div>
                    <div style={s.sectionTitle}>Requerente</div>
                    <KV k="Nome" v={String(cliente?.nome_completo || "—").toUpperCase()} />
                    {cpfFmt && <KV k="CPF" v={cpfFmt} />}
                    {cliente?.celular && <KV k="Celular" v={String(cliente.celular)} />}
                    {cliente?.cr_numero && <KV k="CR" v={cliente.cr_numero} />}
                    <KV k="Endereço" v={enderecoCompleto.toUpperCase()} />
                    {processo && <KV k="Serviço" v={String(processo.tipo || "—").toUpperCase()} />}
                  </div>
                  <div>
                    <div style={s.sectionTitle}>Exigência</div>
                    <KV k="Documento" v={String(doc?.nome_documento || cfg.titulo).toUpperCase()} />
                    {cfg.validade && <KV k="Validade" v={cfg.validade} />}
                    <KV k="Status" v={String(doc?.status || "pendente").toUpperCase()} />
                    <KV k="Base legal" v={cfg.baseLegal} />
                    {doc?.motivo_rejeicao && (
                      <div style={{ marginTop: 10, padding: "9px 12px", background: MAC.redBg, border: `1px solid ${MAC.redBorder}`, borderRadius: 3, fontSize: 12.5, color: "#7A1F2B" }}>
                        {doc.motivo_rejeicao}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Upload via Hub Documental ── */}
                <div style={{ ...s.pad, paddingTop: 0 }}>
                  <div style={s.sectionTitle}>Documento</div>
                  <div style={s.uploadCard}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <div style={s.upIcon}>↑</div>
                      <div style={s.uploadTitle}>Envie o documento em PDF, JPG ou PNG</div>
                      <div style={s.uploadText}>
                        A IA do Hub Documental identifica o tipo, extrai os dados e valida o documento automaticamente.
                        {cfg.profissional && " Confirma se o profissional é credenciado pela PF."}
                      </div>
                    </div>
                    <button
                      onClick={() => setHubOpen(true)}
                      style={s.btnPrimary}
                    >
                      {doc?.arquivo_url ? "Substituir / reenviar documento" : "Selecionar ou tirar foto"}
                    </button>
                    <div style={{ fontSize: 12, color: "#6B6B6B", display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 420 }}>
                      <span>Tamanho máximo 20 MB</span>
                      {doc?.updated_at && (
                        <span>Última análise: {new Date(doc.updated_at).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Credenciados PF ── */}
                {cfg.profissional && (
                  <>
                    <div style={s.divider} />
                    <div style={s.pad}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={s.sectionTitle}>
                            {cfg.profissional === "psicologo" ? "Psicólogos credenciados pela PF" : "Instrutores de tiro credenciados pela PF"}
                          </div>
                          {!buscaManual && (
                            <div style={{ fontSize: 12.5, color: "#6B6B6B", marginTop: 2 }}>
                              Buscando próximos de <b>{cidadeBusca || "—"}/{ufBusca || "—"}</b> · raio 25 km
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setBuscaManual((v) => !v)}
                          style={{ ...s.btnGhost, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                        >
                          <Search size={13} />
                          {buscaManual ? "Usar meu endereço" : "Buscar por estado / cidade"}
                        </button>
                      </div>

                      {/* Busca manual */}
                      {buscaManual && (
                        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 100px" }}>
                            <label style={s.filterLabel}>Estado (UF)</label>
                            <input
                              value={buscaUF}
                              onChange={(e) => setBuscaUF(e.target.value.slice(0, 2))}
                              placeholder="SP"
                              maxLength={2}
                              style={s.filterInput}
                            />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
                            <label style={s.filterLabel}>Cidade</label>
                            <input
                              value={buscaCidade}
                              onChange={(e) => setBuscaCidade(e.target.value)}
                              placeholder="São Paulo"
                              style={s.filterInput}
                            />
                          </div>
                        </div>
                      )}

                      {/* Lista */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {buscaLoading && (
                          <div style={{ color: "#6B6B6B", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                            <Loader2 className="h-4 w-4 animate-spin" /> Buscando credenciados...
                          </div>
                        )}
                        {!buscaLoading && foraDoRaio && credenciados.length > 0 && (
                          <div style={{ fontSize: 12.5, background: MAC.yellowBg, border: `1px solid ${MAC.yellowBorder}`, padding: "8px 12px", borderRadius: 3, color: "#7A5000" }}>
                            Nenhum dentro de 25 km — exibindo os mais próximos{distMaisProximo ? ` (a partir de ${distMaisProximo.toFixed(0)} km)` : ""}.
                          </div>
                        )}
                        {!buscaLoading && credenciados.length === 0 && (
                          <div style={{ fontSize: 13, color: "#6B6B6B" }}>
                            {ufBusca || cepBusca ? "Nenhum credenciado encontrado para esta região." : "Informe estado ou cidade para buscar."}
                          </div>
                        )}
                        {credenciados.map((p) => (
                          <ProCard key={p.id} pro={p} />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Footer ── */}
                <div style={s.footer}>
                  <span>{cfg.baseLegal}</span>
                  <span>Quero Armas · Área do Cliente</span>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hub Documental */}
      <ClienteDocsHubModal
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        customerId={customerId}
        qaClienteId={clienteId}
        mode="portal"
        defaultTipo={cfg.hubTipo}
        onSaved={handleHubSaved}
        pendingHubTipos={[cfg.hubTipo]}
        clienteCpf={null}
        clienteNome={null}
        clienteDataNascimento={null}
        clienteNomeMae={null}
        docsAprovados={[]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "8px 0", borderBottom: "1px dashed #EDE7D9", fontSize: 13.5 }}>
      <span style={{ color: "#6B6B6B", flexShrink: 0 }}>{k}</span>
      <span style={{ color: "#0A0A0A", fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

function ProCard({ pro }: {
  pro: {
    id: string; nome: string; endereco: string; credencial: string;
    telefone: string | null; contato: string; distancia_km: number | null;
  };
}) {
  const waHref = pro.telefone
    ? `https://wa.me/55${String(pro.telefone).replace(/\D/g, "")}`
    : null;
  return (
    <div style={{
      border: "1px solid #E5E1D6", borderRadius: 4, padding: "14px 16px",
      background: "#FAFAF7", display: "grid", gridTemplateColumns: "1fr auto", gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", color: "#0A0A0A", fontWeight: 600 }}>
          {pro.nome}
        </div>
        {/* Badge credencial com macOS green sutil */}
        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: MAC.green, flexShrink: 0 }} />
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#2F6B3A" }}>
            {pro.credencial}
          </span>
        </div>
        {pro.endereco && (
          <div style={{ fontSize: 13, color: "#2A2A2A", marginTop: 6 }}>{pro.endereco}</div>
        )}
        {pro.contato !== "—" && (
          <div style={{ fontSize: 12.5, color: "#6B6B6B", marginTop: 4 }}>{pro.contato}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {pro.distancia_km != null && (
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 13, color: "#7A1F2B", letterSpacing: "0.12em" }}>
            {pro.distancia_km.toFixed(1)} km
          </span>
        )}
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: "0.18em",
              textTransform: "uppercase", padding: "8px 14px", borderRadius: 2,
              background: "#128C7E", color: "#fff", border: "1px solid #128C7E",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 3.5A11 11 0 0 0 3.6 18.3L2 22l3.8-1.5A11 11 0 1 0 20 3.5Zm-8 18a9 9 0 0 1-4.6-1.3l-.3-.2-2.3.9.9-2.2-.2-.4a9 9 0 1 1 6.5 3.2Z" />
            </svg>
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  wrap: {
    background: "#FFFFFF",
    border: "1px solid #E5E1D6",
    borderRadius: 6,
    maxHeight: "calc(100vh - 6rem)",
    overflowY: "auto",
    color: "#0A0A0A",
  },
  pad: { padding: "22px 28px" },
  eyebrow: {
    fontFamily: "Oswald, sans-serif",
    fontSize: 11,
    letterSpacing: "0.28em",
    color: "#6B6B6B",
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Oswald, sans-serif",
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: "0.02em",
    margin: "5px 0 3px",
    textTransform: "uppercase",
    color: "#0A0A0A",
  },
  sub: { color: "#6B6B6B", fontSize: 13.5 },
  divider: { height: 1, background: "#E5E1D6" },
  sectionTitle: {
    fontFamily: "Oswald, sans-serif",
    fontSize: 12,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: "#0A0A0A",
    marginBottom: 10,
  },
  uploadCard: {
    border: "1.5px dashed #7A1F2B",
    background: "#FBF7F8",
    borderRadius: 4,
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    textAlign: "center",
  },
  upIcon: {
    width: 40, height: 40, borderRadius: "50%",
    background: "#7A1F2B", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18,
  },
  uploadTitle: {
    fontFamily: "Oswald, sans-serif",
    fontSize: 14,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#7A1F2B",
  },
  uploadText: {
    fontSize: 13.5,
    color: "#2A2A2A",
    maxWidth: 440,
    lineHeight: 1.55,
  },
  btnPrimary: {
    fontFamily: "Oswald, sans-serif",
    fontSize: 12,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    padding: "11px 24px",
    borderRadius: 2,
    cursor: "pointer",
    border: "1px solid #7A1F2B",
    background: "#7A1F2B",
    color: "#fff",
  },
  btnGhost: {
    fontFamily: "Oswald, sans-serif",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    padding: "8px 14px",
    borderRadius: 2,
    cursor: "pointer",
    border: "1px solid #D9D3C6",
    background: "transparent",
    color: "#2A2A2A",
  },
  filterLabel: {
    fontFamily: "Oswald, sans-serif",
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  filterInput: {
    fontFamily: '"Arial Narrow", Arial, sans-serif',
    fontSize: 14,
    padding: "8px 10px",
    border: "1px solid #D9D3C6",
    borderRadius: 2,
    background: "#FAFAF7",
    color: "#0A0A0A",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#6B6B6B",
    fontSize: 11,
    padding: "12px 28px",
    borderTop: "1px solid #E5E1D6",
    letterSpacing: "0.12em",
    fontFamily: "Oswald, sans-serif",
    textTransform: "uppercase",
  },
};
