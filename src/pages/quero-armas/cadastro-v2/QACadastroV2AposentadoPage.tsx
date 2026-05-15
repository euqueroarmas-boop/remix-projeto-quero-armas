import QACadastroV2GuidedStep from "./QACadastroV2GuidedStep";
import { QA_V2_PATH_APOSENTADO } from "../qaCadastroV2Catalog";

export default function QACadastroV2AposentadoPage() {
  return <QACadastroV2GuidedStep definition={QA_V2_PATH_APOSENTADO} />;
}