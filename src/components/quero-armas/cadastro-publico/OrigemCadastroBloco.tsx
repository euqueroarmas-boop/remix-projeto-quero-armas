import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";

/**
 * Bloco discreto e recolhível com a "origem" do cadastro público.
 * Mostra de onde veio o registro (formulário público), quando foi
 * recebido, qual era o serviço informado originalmente e qual é a
 * classificação atual. Ao expandir, exibe um JSON cru somente-leitura
 * para auditoria (sem alterar a fonte de dados).
 */

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return d; }
}

export default function OrigemCadastroBloco({ cadastro }: { cadastro: any }) {
  const [open, setOpen] = useState(false);
  const original = cadastro?.servico_interesse || "—";
  const atual =
    cadastro?.servico_fechado_final || cadastro?.servico_principal || cadastro?.servico_interesse || "—";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Origem</div>
          <div className="font-semibold text-slate-800 uppercase">Cadastro Público</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Recebido em</div>
          <div className="font-semibold text-slate-800">{fmt(cadastro?.created_at)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">ID</div>
          <div className="font-mono text-[10px] text-slate-600 truncate">{cadastro?.id}</div>
        </div>
        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              Serviço informado originalmente
            </div>
            <div className="font-semibold text-slate-800 uppercase break-words">{original}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              Classificação atual
            </div>
            <div className="font-semibold text-slate-800 uppercase break-words">{atual}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
      >
        <FileText className="h-3 w-3" />
        {open ? "Ocultar dados brutos" : "Ver dados brutos do cadastro"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-white border border-slate-200 p-2 text-[10px] leading-snug text-slate-700 font-mono">
{JSON.stringify(cadastro, null, 2)}
        </pre>
      )}
    </div>
  );
}
