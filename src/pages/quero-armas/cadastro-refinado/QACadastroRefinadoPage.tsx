import { useState } from "react";
import "./styles/cadastroRefinado.css";
import { useCadastroRefinadoState } from "./hooks/useCadastroRefinadoState";
import Etapa01Servico from "./steps/Etapa01Servico";
import Etapa02Documentos from "./steps/Etapa02Documentos";
import Etapa03Revisao from "./steps/Etapa03Revisao";
import Etapa04Pagamento from "./steps/Etapa04Pagamento";
import Etapa05Conclusao from "./steps/Etapa05Conclusao";

export default function QACadastroRefinadoPage() {
  const { state, update, updateDados, reset } = useCadastroRefinadoState();
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  switch (step) {
    case 1:
      return <Etapa01Servico state={state} update={update} onNext={next} />;
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