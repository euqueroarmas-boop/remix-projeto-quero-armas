// ============================================================================
// TemplateDataConfirmationModal — etapa obrigatória de conferência dos dados
// que serão usados para preencher um modelo .docx (declaração/compromisso).
// Camada ADITIVA. Não muda as edges qa-fill-template / qa-fill-template-cliente.
// ============================================================================

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, FileSignature, Loader2, Lock, Pencil, ShieldAlert, X } from "lucide-react";
import {
  buildTemplatePreviewData,
  TEMPLATE_PREVIEW_GROUP_LABEL,
  type TemplatePreviewField,
} from "@/lib/quero-armas/templatePreviewData";

const MARROM = "#7A1F2B";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  cliente: any;
  /** opcional: nome do documento que está sendo gerado, para o título */
  documentoNome?: string | null;
  /** chamado quando o cliente confirma; o caller dispara a geração de fato */
  onConfirmGenerate: () => void;
  /** chamado quando o cliente clica em "Corrigir dados" */
  onEditCadastro: () => void;
  /** quando true, o botão de confirmar fica em loading */
  gerando?: boolean;
  /**
   * Se true, pula a validação de obrigatórios (admin gerando manualmente).
   * No portal do cliente, mantenha FALSE para bloquear total quando faltar dado.
   */
  permitirGerarComPendencias?: boolean;
}

export default function TemplateDataConfirmationModal({
  open,
  onOpenChange,
  cliente,
  documentoNome,
  onConfirmGenerate,
  onEditCadastro,
  gerando = false,
  permitirGerarComPendencias = false,
}: Props) {
  const campos = buildTemplatePreviewData(cliente);
  const faltando = campos.filter((c) => !c.value);
  const faltandoObrigatorios = campos.filter((c) => c.required && !c.value);
  const bloqueado = !permitirGerarComPendencias && faltandoObrigatorios.length > 0;
  const grupos = (["identificacao", "civil", "endereco", "contato"] as const).map((g) => ({
    id: g,
    label: TEMPLATE_PREVIEW_GROUP_LABEL[g],
    fields: campos.filter((c) => c.group === g),
  }));

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onOpenChange(false)}>
      <DialogContent
        className="qa-scope w-[calc(100vw-1rem)] max-w-xl rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[90dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden"
      >
        {/* Cabeçalho */}
        <div
          className="shrink-0 border-b border-slate-200 px-5 py-4"
          style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: MARROM }}
            >
              <FileSignature className="h-5 w-5" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Conferência antes de gerar
              </div>
              <h2 className="text-[17px] font-extrabold leading-tight text-slate-900">
                Confira seus dados antes de gerar o documento
              </h2>
              {documentoNome && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Estes dados entrarão em: <span className="font-semibold text-slate-700">{documentoNome}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {bloqueado && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-[12px] text-red-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong className="font-bold uppercase tracking-wide">
                  Faltam {faltandoObrigatorios.length} dado(s) obrigatório(s).
                </strong>{" "}
                Não conseguimos gerar este documento até você completar:{" "}
                <span className="font-semibold">
                  {faltandoObrigatorios.map((f) => f.label).join(", ")}
                </span>
                . Clique em <span className="font-bold">Corrigir dados</span> para preencher agora.
              </div>
            </div>
          )}
          {!bloqueado && faltando.length > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong className="font-bold">{faltando.length} campo(s) em branco.</strong>{" "}
                Recomendamos preencher antes de gerar — campos vazios sairão em branco no documento.
              </div>
            </div>
          )}

          <div className="space-y-4">
            {grupos.map((g) => (
              <section key={g.id}>
                <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {g.label}
                </h3>
                <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {g.fields.map((f) => (
                    <FieldRow key={f.key} field={f} />
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Os campos travados (<Lock className="inline h-3 w-3 -mt-0.5" />) só podem ser ajustados
            pela Equipe Quero Armas — fale com a gente se algum estiver errado.
          </p>
        </div>

        {/* Rodapé */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onEditCadastro}
            disabled={gerando}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <Pencil className="h-4 w-4" /> Corrigir dados
          </button>
          <button
            type="button"
            onClick={onConfirmGenerate}
            disabled={gerando || bloqueado}
            title={bloqueado ? "Complete os campos obrigatórios antes de gerar" : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
            style={{ background: MARROM }}
          >
            {gerando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
              </>
            ) : bloqueado ? (
              <>
                <ShieldAlert className="h-4 w-4" /> Complete os obrigatórios
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Confirmar e gerar documento
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ field }: { field: TemplatePreviewField }) {
  const vazio = !field.value;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
        {field.label}
        {field.locked && <Lock className="h-3 w-3 text-slate-400" />}
      </dt>
      <dd
        className={
          "max-w-[60%] truncate text-right text-[13px] " +
          (vazio ? "italic text-amber-600" : "font-medium text-slate-800")
        }
        title={field.value || "Não informado"}
      >
        {field.value || "Não informado"}
      </dd>
    </div>
  );
}