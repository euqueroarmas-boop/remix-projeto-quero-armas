import { Boxes } from "lucide-react";

export function ClienteArmasMunicoesSection() {
  return (
    <div id="qa-portal-armas-municoes" tabIndex={-1} className="outline-none">
      <div className="rounded-sm border border-[#E4E4E4] bg-white p-8 md:p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Boxes className="h-6 w-6 text-slate-500" />
        </div>
        <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900">
          Armas e Munições
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Nova central de gerenciamento de armas, acervo e munições. Em implantação.
        </p>
      </div>
    </div>
  );
}
