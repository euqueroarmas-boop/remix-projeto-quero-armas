import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { isEmuAtivo, getEmuSessao, EMU_BLOQUEIO_COMPRA } from "@/lib/quero-armas/emuSessao";

/**
 * Cerca das rotas de contratação/pagamento. Em modo espelho a equipe navega
 * pelo portal inteiro; só aqui ela bate na parede. É a trava de TELA — a de
 * verdade é o trigger `qa_emu_block_compra` no banco, que vale mesmo se
 * alguém chamar a API direto.
 */
export default function EmuCompraGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  if (!isEmuAtivo()) return <>{children}</>;

  const sessao = getEmuSessao();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F2F2F2] px-4 pt-12">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <Lock className="h-5 w-5 text-amber-700" />
        </div>
        <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">Bloqueado no modo espelho</h1>
        <p className="text-[12px] leading-relaxed text-slate-500">{EMU_BLOQUEIO_COMPRA}</p>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Você está vendo a área de <strong>{sessao?.clienteNome}</strong>. Todo o resto do portal funciona
          normalmente — contratar, pagar e assinar continuam sendo do próprio cliente.
        </p>
        <button
          type="button"
          onClick={() => navigate("/area-do-cliente", { replace: true })}
          className="h-10 w-full rounded-xl bg-[#7A1F2B] text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#641722]"
        >
          Voltar para a área do cliente
        </button>
      </div>
    </div>
  );
}
