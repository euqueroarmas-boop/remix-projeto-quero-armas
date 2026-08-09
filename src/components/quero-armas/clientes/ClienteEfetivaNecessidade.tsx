import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
        style={{ color: sim ? "#7A1F2B" : "#64748B" }}
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
      } else {
        setProvas([]);
      }
      if (vivo) setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [cliente.id]);

  const abrirArquivo = async (path: string) => {
    const { data } = await supabase.storage.from("qa-documentos").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
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
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">Exames liberados</div>
            {registro.exames_liberados_em ? dataHoraBR(registro.exames_liberados_em) : "Não"}
          </div>
        </div>
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
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B] hover:underline"
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
              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B] hover:underline"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Abrir dossiê assinado
            </button>
          )}
        </Bloco>
      )}
    </div>
  );
}