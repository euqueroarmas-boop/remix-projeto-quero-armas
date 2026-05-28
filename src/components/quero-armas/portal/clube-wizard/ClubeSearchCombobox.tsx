// ============================================================================
// ClubeSearchCombobox
// ----------------------------------------------------------------------------
// Busca de clubes em qa_clubes por nome, CNPJ, cidade, estado, número CR.
// Cliente apenas SELECIONA; nunca grava direto na tabela.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, ShieldCheck, ShieldAlert, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ClubeRow {
  id: number;
  nome_clube: string;
  cnpj: string | null;
  numero_cr: string | null;
  data_validade: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  status_verificacao: string;
  origem: string;
}

interface Props {
  onSelect: (clube: ClubeRow) => void;
  onNotFound: () => void;
}

export default function ClubeSearchCombobox({ onSelect, onNotFound }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ClubeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const digits = term.replace(/\D/g, "");
        const orParts: string[] = [
          `nome_clube.ilike.%${term}%`,
          `cidade.ilike.%${term}%`,
          `estado.ilike.%${term}%`,
          `numero_cr.ilike.%${term}%`,
        ];
        if (digits.length >= 3) orParts.push(`cnpj.ilike.%${digits}%`);
        const { data } = await supabase
          .from("qa_clubes")
          .select("id, nome_clube, cnpj, numero_cr, data_validade, endereco, cidade, estado, status_verificacao, origem")
          .or(orParts.join(","))
          .limit(15);
        setItems((data as any) ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  const empty = useMemo(() => q.trim().length >= 2 && !loading && items.length === 0, [q, loading, items]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CNPJ, cidade, UF ou número CR..."
          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 py-3 text-[14px] uppercase outline-none focus:border-[#7A1F2B] focus:ring-2 focus:ring-[#FBE2E6]"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {items.length > 0 && (
        <ul className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold uppercase text-slate-900 truncate">{c.nome_clube}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] uppercase text-slate-500">
                      {(c.cidade || c.estado) && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[c.cidade, c.estado].filter(Boolean).join("/")}</span>
                      )}
                      {c.cnpj && <span>CNPJ {c.cnpj}</span>}
                      {c.numero_cr && <span>CR {c.numero_cr}</span>}
                    </div>
                  </div>
                  <StatusBadge status={c.status_verificacao} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {empty && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[12px] text-slate-600">
          Não encontramos esse clube no nosso catálogo.
        </div>
      )}

      <button
        type="button"
        onClick={onNotFound}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        Meu clube não está na lista
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "verificado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
        <ShieldCheck className="h-3 w-3" /> Verificado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
      <ShieldAlert className="h-3 w-3" /> Pendente
    </span>
  );
}