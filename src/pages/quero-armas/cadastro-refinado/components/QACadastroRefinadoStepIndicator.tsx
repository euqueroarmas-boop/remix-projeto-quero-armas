// Step indicator removido — o progresso é mostrado na barra fina do header
// e a etapa atual aparece como pill brass (qa-ref-eyebrow) acima do título.
// Mantemos o componente como no-op para preservar a API do Shell.
interface Props {
  current: number;
  total?: number;
}
export default function QACadastroRefinadoStepIndicator(_: Props) {
  return null;
}