import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveOrShareBlob } from "@/lib/quero-armas/saveOrShareBlob";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";

type Registro = Record<string, any>;
type Prova = Record<string, any>;

const LABEL_TIPO: Record<string, string> = {
  bo: "Boletim de Ocorrência",
  inquerito: "Inquérito Policial",
  acao_criminal: "Ação Criminal",
  outro: "Outro documento",
};

const dataBR = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";

const dataHoraBR = (v?: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR") : "—";

function Resposta({ label, valor }: { label: string; valor: boolean | null }) {
  const sim = valor === true;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
      <span className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.1em]"
        style={{ color: sim ? "#2F3337" : "#64748B" }}
      >
        {valor === null || valor === undefined ? "—" : sim ? "SIM" : "NÃO"}
      </span>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="qa-card p-4 md:p-5">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-3">{titulo}</h4>
      {children}
    </div>
  );
}

export default function ClienteEfetivaNecessidade({ cliente }: { cliente: { id: number } }) {
  const [loading, setLoading] = useState(true);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [acrescimos, setAcrescimos] = useState<Registro[]>([]);
  const [auditoria, setAuditoria] = useState<Registro[]>([]);
  const [acaoRevisao, setAcaoRevisao] = useState<"aprovar" | "devolver" | null>(null);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroRevisao, setErroRevisao] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("qa_efetiva_necessidade" as any)
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const reg = (data?.[0] as Registro) ?? null;
      if (!vivo) return;
      setRegistro(reg);
      if (reg?.id) {
        const { data: pv } = await supabase
          .from("qa_efetiva_necessidade_provas" as any)
          .select("*")
          .eq("efetiva_necessidade_id", reg.id)
          .order("created_at", { ascending: true });
        if (vivo) setProvas((pv as Prova[]) ?? []);
        const { data: ac } = await supabase
          .from("qa_efetiva_necessidade_acrescimos" as any)
          .select("*")
          .eq("efetiva_necessidade_id", reg.id)
          .order("ordem", { ascending: true });
        if (vivo) setAcrescimos((ac as Registro[]) ?? []);
        const { data: au } = await supabase
          .from("qa_efetiva_necessidade_auditoria" as any)
          .select("*")
          .eq("efetiva_id", reg.id)
          .order("created_at", { ascending: false });
        if (vivo) setAuditoria((au as Registro[]) ?? []);
      } else {
        setProvas([]);
        setAcrescimos([]);
        setAuditoria([]);
      }
      if (vivo) setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente.id, recarregar]);

  const enviarRevisao = async () => {
    if (!registro?.id || !acaoRevisao) return;
    setErroRevisao(null);
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-efetiva-revisar", {
        body: { registro_id: registro.id, acao: acaoRevisao, observacao },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error(String((data as any).error));
      setAcaoRevisao(null);
      setObservacao("");
      setRecarregar((n) => n + 1);
    } catch (e) {
      setErroRevisao((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirArquivo = async (path: string) => {
    const { data } = await supabase.storage.from("qa-documentos").createSignedUrl(path, 600);
    if (!data?.signedUrl) return;
    // Nunca expor URL do storage — entrega via blob local.
    const resp = await fetch(data.signedUrl);
    if (!resp.ok) return;
    await saveOrShareBlob(await resp.blob(), path.split("/").pop() || "documento");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[10px] uppercase tracking-wider">Carregando</span>
      </div>
    );
  }

  if (!registro) {
    return (
      <div className="qa-card p-6 text-center">
        <p className="text-[12px] text-slate-500">
          Este cliente ainda não iniciou o questionário de Efetiva Necessidade.
        </p>
      </div>
    );
  }

  const narrativa = registro.narrativa_final || registro.narrativa_gerada;

  return (
    <div className="space-y-3">
      <Bloco titulo={`Status — ${String(registro.status ?? "—").toUpperCase()}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-slate-600">
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">Iniciado em</div>
            {dataHoraBR(registro.created_at)}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">Última atualização</div>
            {dataHoraBR(registro.updated_at)}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">Aprovado pelo cliente</div>
            {registro.aprovado_cliente ? dataHoraBR(registro.aprovado_cliente_em) : "Não"}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">Aprovado pela equipe</div>
            {registro.aprovado_em
              ? `${dataHoraBR(registro.aprovado_em)}${registro.aprovado_por_nome ? ` · ${registro.aprovado_por_nome}` : ""}`
              : "Não"}
          </div>
        </div>
        {registro.devolucao_motivo ? (
          <div className="mt-3 rounded-md border border-[#2F3337]/30 bg-[#F9F9FA] px-3 py-2 text-[11px] text-[#2F3337]">
            <span className="font-bold uppercase tracking-[0.1em]">Devolvido pela equipe: </span>
            {registro.devolucao_motivo}
          </div>
        ) : null}
      </Bloco>

      <Bloco titulo="Revisão da equipe">
        {registro.aprovado_cliente ? (
          <>
            <p className="text-[11px] text-slate-500">
              O aceite do cliente não aprova o relato. A aprovação abaixo é ato da equipe e fica registrada em auditoria.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setAcaoRevisao("aprovar"); setErroRevisao(null); }}
                className={`h-9 rounded-md px-4 text-[10px] font-bold uppercase tracking-[0.12em] ${
                  acaoRevisao === "aprovar" ? "bg-emerald-700 text-white" : "border border-emerald-700 text-emerald-800 hover:bg-emerald-50"
                }`}
              >
                Aprovar pela equipe
              </button>
              <button
                type="button"
                onClick={() => { setAcaoRevisao("devolver"); setErroRevisao(null); }}
                className={`h-9 rounded-md px-4 text-[10px] font-bold uppercase tracking-[0.12em] ${
                  acaoRevisao === "devolver" ? "bg-[#2F3337] text-white" : "border border-[#2F3337] text-[#2F3337] hover:bg-[#F9F9FA]"
                }`}
              >
                Devolver para ajuste
              </button>
            </div>
            {acaoRevisao ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value.toUpperCase())}
                  rows={3}
                  placeholder={acaoRevisao === "devolver" ? "MOTIVO DA DEVOLUÇÃO (OBRIGATÓRIO)" : "OBSERVAÇÃO DA APROVAÇÃO (OPCIONAL)"}
                  className="w-full rounded-md border border-slate-200 p-2 text-[11px] uppercase text-slate-700 outline-none focus:border-[#2F3337]"
                />
                {erroRevisao ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#2F3337]">{erroRevisao}</p>
                ) : null}
                <button
                  type="button"
                  disabled={salvando}
                  onClick={enviarRevisao}
                  className="h-9 rounded-md bg-[#0A0A0A] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  {salvando ? "Gravando..." : "Confirmar e registrar em auditoria"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] text-slate-400">
            Aguardando o aceite do cliente antes da revisão da equipe.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Log de auditoria">
        {auditoria.length ? (
          <ul className="space-y-2">
            {auditoria.map((a) => (
              <li key={String(a.id)} className="border-b border-slate-100 pb-2 text-[11px] text-slate-600">
                <div className="font-bold uppercase tracking-[0.1em] text-slate-700">
                  {String(a.acao).replace(/_/g, " ")} · {dataHoraBR(a.created_at)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {String(a.autor_tipo).toUpperCase()}
                  {a.autor_nome ? ` · ${a.autor_nome}` : ""}
                  {a.status_anterior || a.status_novo ? ` · ${String(a.status_anterior ?? "—").toUpperCase()} → ${String(a.status_novo ?? "—").toUpperCase()}` : ""}
                </div>
                {a.observacao ? <div className="mt-1 text-[11px] text-slate-600">{a.observacao}</div> : null}
                <div className="mt-1 font-mono text-[9px] text-slate-400 break-all">
                  IP {a.ip || "—"} · {a.user_agent || "—"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-slate-400">Nenhum registro de auditoria ainda.</p>
        )}
      </Bloco>

      <Bloco titulo="Respostas do questionário">
        <Resposta label="Registrou boletim de ocorrência" valor={registro.tem_bo} />
        <Resposta label="Existe inquérito policial" valor={registro.tem_inquerito} />
        <Resposta label="Existe ação criminal" valor={registro.tem_acao_criminal} />
        <Resposta label="Sofre ameaça" valor={registro.sofre_ameaca} />
      </Bloco>

      <Bloco titulo="Relato do cliente">
        <p className="text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
          {registro.relato_cliente || "—"}
        </p>
      </Bloco>

      <Bloco titulo="Contexto de risco (profissão / rotina)">
        <p className="text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
          {registro.contexto_risco || "—"}
        </p>
      </Bloco>

      <Bloco titulo={`Provas anexadas (${provas.length})`}>
        {provas.length === 0 ? (
          <p className="text-[11px] text-slate-400">Nenhuma prova anexada.</p>
        ) : (
          <div className="space-y-2">
            {provas.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-700">
                      {LABEL_TIPO[p.tipo] ?? p.tipo}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{p.arquivo_nome}</div>
                  </div>
                  {p.arquivo_storage_path && (
                    <button
                      onClick={() => abrirArquivo(p.arquivo_storage_path)}
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2F3337] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[10px] text-slate-600">
                  <div><span className="text-slate-400">Número: </span>{p.numero || "—"}</div>
                  <div><span className="text-slate-400">Órgão: </span>{p.orgao || "—"}</div>
                  <div><span className="text-slate-400">Data do fato: </span>{dataBR(p.data_fato)}</div>
                  <div><span className="text-slate-400">Leitura: </span>{p.leitura_por || "—"}</div>
                </div>
                {Array.isArray(p.naturezas) && p.naturezas.length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-600">
                    <span className="text-slate-400">Naturezas: </span>{p.naturezas.join(", ")}
                  </div>
                )}
                {p.relato && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{p.relato}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Narrativa gerada pela IA">
        {narrativa ? (
          <>
            <p className="text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">{narrativa}</p>
            <div className="mt-3 text-[10px] text-slate-400">
              Gerada em {dataHoraBR(registro.narrativa_gerada_em)}
              {registro.narrativa_editada_pelo_cliente ? " · editada pelo cliente" : ""}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400">Narrativa ainda não gerada.</p>
        )}
      </Bloco>

      {acrescimos.length > 0 && (
        <Bloco titulo={`Fatos acrescentados pelo cliente (${acrescimos.length})`}>
          <div className="space-y-2">
            {acrescimos.map((a, i) => (
              <div key={a.id} className="border border-slate-200 rounded-lg p-3">
                <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">
                  #{i + 1} · {dataHoraBR(a.created_at)}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">{a.texto}</p>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      <Bloco titulo="Texto para registro de boletim de ocorrência">
        {registro.texto_bo ? (
          <>
            <p className="text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">{registro.texto_bo}</p>
            <div className="mt-3 text-[10px] text-slate-400">
              {String(registro.texto_bo).length}/500 caracteres · gerado em {dataHoraBR(registro.texto_bo_gerado_em)}
              {registro.texto_bo_editado_pelo_cliente ? " · ajustado pelo cliente" : ""}
              {registro.bo_pendente_registro ? " · aguardando o BO novo" : ""}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400">Texto de BO ainda não gerado.</p>
        )}
      </Bloco>

      {registro.aprovado_cliente && (
        <Bloco titulo="Carimbo de aprovação">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-600 font-mono">
            <div><span className="text-slate-400">Data/hora: </span>{dataHoraBR(registro.aprovado_cliente_em)}</div>
            <div><span className="text-slate-400">IP: </span>{registro.aprovacao_ip || "—"}</div>
            <div className="md:col-span-2 break-all"><span className="text-slate-400">User-agent: </span>{registro.aprovacao_user_agent || "—"}</div>
            <div className="md:col-span-2 break-all"><span className="text-slate-400">Hash: </span>{registro.aprovacao_hash || "—"}</div>
          </div>
          {registro.dossie_storage_path && (
            <button
              onClick={() => abrirArquivo(registro.dossie_storage_path)}
              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2F3337] hover:underline"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Abrir dossiê assinado
            </button>
          )}
        </Bloco>
      )}
    </div>
  );
}