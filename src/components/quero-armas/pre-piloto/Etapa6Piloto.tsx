import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClienteSalvo } from "./PrePilotoWizard";

interface Props {
  clienteSalvo: ClienteSalvo;
  onVoltar: () => void;
}

export default function Etapa6Piloto({ clienteSalvo, onVoltar }: Props) {
  const navigate = useNavigate();

  function irParaPiloto() {
    navigate("/admin/piloto-real", {
      state: { clienteId: clienteSalvo.id, clienteNome: clienteSalvo.nome_completo },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 6 — Iniciar Piloto Real</h2>
        <p className="text-xs text-muted-foreground">
          O cliente está pronto. Clique para ir ao Piloto Real com o cadastro pré-selecionado.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800">Pré-piloto concluído com sucesso</p>
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
          </div>
        </div>
      </div>

      <div className="bg-muted/40 rounded p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">O que acontece agora</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>O Piloto Real será aberto com este cliente já selecionado</li>
          <li>Selecione o serviço, crie a venda e siga o fluxo normal</li>
          <li>Toda a trilha de auditoria é gerada automaticamente</li>
        </ul>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
        <Button
          onClick={irParaPiloto}
          className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-sm gap-2 px-6"
        >
          <Play className="w-4 h-4" /> Iniciar Piloto Real
        </Button>
      </div>
    </div>
  );
}
