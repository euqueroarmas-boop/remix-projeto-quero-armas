// ============================================================================
// CARIMBOS DE CONEXÃO — aba permanente no cadastro do cliente.
//
// Regra do usuário: tudo que o cliente entrega, aceita, acessa ou que a equipe
// visualiza/baixa fica registrado com IP, dispositivo e data/hora. Esta aba
// consolida todas as fontes de auditoria em uma linha do tempo única.
// Fonte: RPC `qa_carimbos_conexao_cliente`.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { Loader2, Fingerprint, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Carimbo {
  ocorrido_em: string | null;
  origem: string | null;
  evento: string | null;
  referencia: string | null;
  ip: string | null;
  user_agent: string | null;
  detalhe: string | null;
}

const BORDO = "#7A1F2B";

const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export default function ClienteCarimbosConexao({ cliente }: { cliente: any }) {
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState<Carimbo[]>([]);
  const [origem, setOrigem] = useState<string>("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!cliente?.id) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const { data } = await supabase.rpc("qa_carimbos_conexao_cliente" as any, {
        _cliente_id: Number(cliente.id),
      });
      if (!vivo) return;
      setItens(((data as any[]) ?? []) as Carimbo[]);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [cliente?.id]);

  const origens = useMemo(
    () => Array.from(new Set(itens.map((i) => i.origem ?? "").filter(Boolean))).sort(),
    [itens],
  );

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (origem && i.origem !== origem) return false;
      if (!t) return true;
      return [i.evento, i.referencia, i.ip, i.user_agent, i.detalhe]
        .some((v) => String(v ?? "").toLowerCase().includes(t));
    });
  }, [itens, origem, busca]);

  const ipsUnicos = useMemo(
    () => new Set(itens.map((i) => i.ip).filter(Boolean)).size,
    [itens],
  );

  const baixarCsv = () => {
    const linhas = [
      ["DATA/HORA", "ORIGEM", "EVENTO", "REFERENCIA", "IP", "DISPOSITIVO", "USER AGENT"],
      ...filtrados.map((i) => [
        dataHora(i.ocorrido_em), i.origem ?? "", i.evento ?? "", i.referencia ?? "",
        i.ip ?? "", i.detalhe ?? "", i.user_agent ?? "",
      ]),
    ];
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `carimbos-conexao-${cliente?.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-[11px] uppercase tracking-wider text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando carimbos
      </div>
    );
  }

  return (
    <div className="qa-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4" style={{ color: BORDO }} />
          <h3 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: BORDO }}>
            Carimbos de conexão
          </h3>
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
            {itens.length} registro(s) · {ipsUnicos} IP(s) distinto(s)
          </span>
        </div>
        <button
          type="button"
          onClick={baixarCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 hover:border-slate-400"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="BUSCAR IP, EVENTO OU DOCUMENTO"
            className="h-9 w-[280px] max-w-full rounded-lg border border-slate-200 pl-7 pr-3 text-[11px] uppercase tracking-wider outline-none focus:border-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setOrigem("")}
          className={`rounded-full border px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider ${
            origem === "" ? "border-[#7A1F2B] text-[#7A1F2B]" : "border-slate-200 text-slate-500"
          }`}
        >
          Todas
        </button>
        {origens.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOrigem((v) => (v === o ? "" : o))}
            className={`rounded-full border px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider ${
              origem === o ? "border-[#7A1F2B] text-[#7A1F2B]" : "border-slate-200 text-slate-500"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="py-8 text-center text-[11px] uppercase tracking-wider text-slate-400">
          Nenhum carimbo registrado
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {["DATA/HORA", "ORIGEM", "EVENTO", "REFERÊNCIA", "IP", "DISPOSITIVO"].map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i, idx) => (
                <tr key={idx} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2 text-[10.5px] font-medium tabular-nums text-slate-700 whitespace-nowrap">
                    {dataHora(i.ocorrido_em)}
                  </td>
                  <td className="px-2 py-2">
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {i.origem}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-[10.5px] font-medium uppercase text-slate-700">{i.evento ?? "—"}</td>
                  <td className="px-2 py-2 text-[10.5px] font-medium text-slate-600 max-w-[260px] truncate" title={i.referencia ?? ""}>
                    {i.referencia || "—"}
                  </td>
                  <td className="px-2 py-2 text-[10.5px] font-bold tabular-nums" style={{ color: BORDO }}>
                    {i.ip || "—"}
                  </td>
                  <td className="px-2 py-2 text-[10.5px] font-medium text-slate-600 max-w-[280px]">
                    <div className="truncate" title={i.detalhe ?? ""}>{i.detalhe || "—"}</div>
                    <div className="truncate text-[9.5px] text-slate-400" title={i.user_agent ?? ""}>{i.user_agent || ""}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}