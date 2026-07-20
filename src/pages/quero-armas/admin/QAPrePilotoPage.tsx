import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";
import PrePilotoWizard from "@/components/quero-armas/pre-piloto/PrePilotoWizard";
import { ShieldAlert } from "lucide-react";

export default function QAPrePilotoPage() {
  const { adminOnly } = useQAAuthContext();

  if (!adminOnly) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3 px-4">
        <ShieldAlert className="w-10 h-10 text-red-500" />
        <p className="text-sm text-muted-foreground">Acesso restrito à equipe.</p>
      </div>
    );
  }

  return <PrePilotoWizard />;
}
