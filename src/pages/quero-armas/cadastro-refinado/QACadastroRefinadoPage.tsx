import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./styles/cadastroRefinado.css";
import { useCadastroRefinadoState } from "./hooks/useCadastroRefinadoState";
import Etapa00Escolha from "./steps/Etapa00Escolha";
import Etapa01Servico from "./steps/Etapa01Servico";
import Etapa02Documentos from "./steps/Etapa02Documentos";
import Etapa03Revisao from "./steps/Etapa03Revisao";
import Etapa04Pagamento from "./steps/Etapa04Pagamento";
import Etapa05Conclusao from "./steps/Etapa05Conclusao";

export default function QACadastroRefinadoPage() {
  const { state, update, updateDados, reset } = useCadastroRefinadoState();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Step inicial conforme query params (executa só na montagem)
  const [step, setStep] = useState<number>(() => {
    if (params.get("servico")) return 1;
    return 0;
  });
  // Se cliente entrou direto via ?servico=, lembramos disso p/ Voltar levar para "/"
  const [enteredDirect] = useState<boolean>(() => Boolean(params.get("servico")));
  const [initialPerfil, setInitialPerfil] = useState<string | null>(() => params.get("perfil_v2"));

  // Sanidade: se mudou query depois (improvável), respeitar
  useEffect(() => {
    const servico = params.get("servico");
    if (servico && step === 0) setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSelectService = (slug: string, perfilV2?: string, subperfilV2?: string) => {
    update({
      servicoSlug: slug,
      perfilV2: perfilV2 ?? state.perfilV2,
      origem: state.origem ?? "etapa00",
    });
    // Reflete no contexto (subperfil é informativo)
    if (subperfilV2) {
      try {
        sessionStorage.setItem("qa_cadastro_subperfil_v2", subperfilV2);
      } catch { /* ignore */ }
    }
    setStep(1);
  };

  const handleBackToHome = () => navigate("/");

  const handleEtapa01Back = () => {
    if (enteredDirect) handleBackToHome();
    else {
      setInitialPerfil(null);
      setStep(0);
    }
  };

  switch (step) {
    case 0:
      return (
        <Etapa00Escolha
          onSelectService={handleSelectService}
          onBackToHome={handleBackToHome}
          initialPerfil={initialPerfil}
        />
      );
    case 1:
      return <Etapa01Servico state={state} update={update} onNext={next} onBack={handleEtapa01Back} />;
    case 2:
      return <Etapa02Documentos state={state} update={update} updateDados={updateDados} onNext={next} onBack={back} />;
    case 3:
      return <Etapa03Revisao state={state} update={update} updateDados={updateDados} onNext={next} onBack={back} />;
    case 4:
      return <Etapa04Pagamento state={state} update={update} onNext={next} onBack={back} />;
    case 5:
      return <Etapa05Conclusao state={state} onReset={reset} />;
    default:
      return null;
  }
}