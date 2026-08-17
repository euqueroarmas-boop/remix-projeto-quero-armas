/**
 * Dashboard — Profissionais NÃO localizados na base de credenciados da PF.
 *
 * Alimentado pelo Hub Documental: sempre que um laudo cita psicólogo ou
 * instrutor cuja credencial não é confirmada na base da Polícia Federal,
 * o registro cai em public.qa_psico_nao_localizados (log de auditoria).
 * Aqui a equipe vê nome completo, CRP/IAT, endereço, cidade/UF e telefone.
 */

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  tipo: string;
  nome: string;
  registro: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  cliente_nome: string | null;
  situacao: string;
  ocorrencias: number;
  created_at: string;
};

const BORDO = "#2F3337";

export default function DashboardCredenciadosNaoLocalizados() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("qa_psico_nao_localizados" as any)
      .select("id, tipo, nome, registro, endereco, cidade, uf, telefone, cliente_nome, situacao, ocorrencias, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(((data as any[]) || []) as Row[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="qa-card p-4 md:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: BORDO }} />
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] truncate" style={{ color: BORDO }}>
            Profissionais não localizados na base da Polícia Federal
          </h2>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ background: "rgba(47,51,55,0.08)", color: BORDO }}
          >
            {rows.length}
          </span>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
        >
          <RefreshCw className="h-3 w-3" /> Atualizar
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-4">
          Nenhum profissional pendente de verificação. Todos os laudos recebidos citam credenciados confirmados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-left text-[9.5px] uppercase tracking-[0.08em] text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-semibold align-middle">Nome completo</th>
                <th className="py-2 pr-3 font-semibold align-middle">CRP / Registro</th>
                <th className="py-2 pr-3 font-semibold align-middle">Endereço</th>
                <th className="py-2 pr-3 font-semibold align-middle">Cidade / Estado</th>
                <th className="py-2 pr-3 font-semibold align-middle">Telefone</th>
                <th className="py-2 pr-3 font-semibold align-middle">Cliente</th>
                <th className="py-2 font-semibold align-middle">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold uppercase text-slate-900">
                    {r.nome}
                    {r.ocorrencias > 1 && (
                      <span className="ml-1 text-[9px] font-bold text-slate-400">×{r.ocorrencias}</span>
                    )}
                    <div className="text-[9px] font-normal uppercase tracking-wide text-slate-400">
                      {r.tipo === "instrutor_tiro" ? "Instrutor de tiro" : "Psicólogo"}
                    </div>
                  </td>
                  <td className="py-2 pr-3 uppercase text-slate-700 tabular-nums">{r.registro || "—"}</td>
                  <td className="py-2 pr-3 uppercase text-slate-700 max-w-[280px]">{r.endereco || "—"}</td>
                  <td className="py-2 pr-3 uppercase text-slate-700">
                    {r.cidade ? `${r.cidade}${r.uf ? ` / ${r.uf}` : ""}` : r.uf || "—"}
                  </td>
                  <td className="py-2 pr-3 text-slate-700 tabular-nums">{r.telefone || "—"}</td>
                  <td className="py-2 pr-3 uppercase text-slate-600">{r.cliente_nome || "—"}</td>
                  <td className="py-2">
                    <span
                      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={
                        r.situacao === "pendente"
                          ? { background: "rgba(47,51,55,0.08)", color: BORDO }
                          : { background: "rgba(16,122,72,0.08)", color: "#0F7A48" }
                      }
                    >
                      {r.situacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}