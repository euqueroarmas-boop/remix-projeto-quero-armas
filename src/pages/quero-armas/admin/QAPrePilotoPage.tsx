import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import PrePilotoWizard from "@/components/quero-armas/pre-piloto/PrePilotoWizard";
import HistoricoContratosPendentes from "@/components/quero-armas/pre-piloto/HistoricoContratosPendentes";
import { ShieldAlert } from "lucide-react";

export default function QAPrePilotoPage() {
  const { profile, loading } = useQAAuthContext();
  const isAdmin = profile?.perfil === "administrador";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3 px-4">
        <ShieldAlert className="w-10 h-10 text-red-500" />
        <p className="text-sm text-muted-foreground">Acesso restrito à equipe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PrePilotoWizard />

      {/* Histórico de contratos pendentes */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-foreground mb-1">Histórico — Contratos Aguardando Assinatura</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Contratos gerados via Pré-Piloto. Faça upload do PDF assinado quando o cliente devolver por WhatsApp.
          </p>
          <HistoricoContratosPendentes />
        </div>
      </div>
    </div>
  );
}
