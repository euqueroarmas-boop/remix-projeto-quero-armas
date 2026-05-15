import QACadastroV2GuidedStep from "./QACadastroV2GuidedStep";
import { QA_V2_PATH_PROFISSAO } from "../qaCadastroV2Catalog";

export default function QACadastroV2ProfissaoAtivaPage() {
  return <QACadastroV2GuidedStep definition={QA_V2_PATH_PROFISSAO} />;
}