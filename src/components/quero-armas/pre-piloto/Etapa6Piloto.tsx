import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, User, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClienteSalvo } from "./PrePilotoWizard";

interface Props {
  clienteSalvo: ClienteSalvo;
  vendaId: number | null;
  onVoltar: () => void;
}

export default function Etapa6Piloto({ clienteSalvo, vendaId, onVoltar }: Props) {
  const navigate = useNavigate();

  function irParaPiloto() {
    navigate("/admin/piloto-real", {
      state: { clienteId: clienteSalvo.id, clienteNome: clienteSalvo.nome_completo, vendaId },
    });
  }

  function novoPrePiloto() {
    // Recarrega a página para resetar o wizard completamente
    navigate("/admin/pre-piloto", { replace: true });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 6 — Pronto</h2>
        <p className="text-xs text-muted-foreground">
          Contrato enviado. Aguarde a assinatura do cliente e siga pelo histórico abaixo ou inicie o Piloto Real agora.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Pré-piloto concluído</p>
        </div>
        <div className="flex items-start gap-2 text-xs text-green-700">
          <User className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{clienteSalvo.nome_completo}</p>
            {clienteSalvo.cpf && <p className="text-green-600">{clienteSalvo.cpf}</p>}
            {clienteSalvo.email && <p className="text-green-600">{clienteSalvo.email}</p>}
            <p className="text-green-500 mt-0.5">
              {clienteSalvo.existia ? "Cadastro atualizado" : "Novo cadastro criado"} — ID {clienteSalvo.id}
            </p>
            {vendaId && <p className="text-green-500">Venda #{vendaId} criada · Contrato enviado por e-mail</p>}
          </div>
        </div>
      </div>

      <div className="bg-muted/40 rounded p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Fluxo após assinatura</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Cliente assina pelo GOV.BR e envia por WhatsApp</li>
          <li>Faça upload do contrato assinado no histórico desta página</li>
          <li>Confirme o pagamento no Piloto Real</li>
        </ul>
      </div>

      <div className="flex justify-between gap-2 pt-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={novoPrePiloto}
            className="text-xs gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Novo Pré-Piloto
          </Button>
          <Button
            onClick={irParaPiloto}
            size="sm"
            className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
          >
            <Play className="w-3.5 h-3.5" /> Piloto Real
          </Button>
        </div>
      </div>
    </div>
  );
}
