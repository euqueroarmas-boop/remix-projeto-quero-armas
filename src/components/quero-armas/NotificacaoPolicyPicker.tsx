import { useMemo } from "react";
import { Bell, BellOff, Mail, MessageCircle, Monitor } from "lucide-react";

export interface NotificacaoPolicyValue {
  notificar_cliente: boolean;
  canais: {
    email: boolean;
    whatsapp: boolean;
    portal: boolean;
  };
  motivo_nao_notificar: string;
}

export const DEFAULT_NOTIFICACAO_POLICY: NotificacaoPolicyValue = {
  notificar_cliente: true,
  canais: { email: true, whatsapp: false, portal: true },
  motivo_nao_notificar: "",
};

interface Props {
  value: NotificacaoPolicyValue;
  onChange: (v: NotificacaoPolicyValue) => void;
  clienteEmail?: string | null;
  acaoLabel?: string;
  className?: string;
}

/**
 * Componente reutilizável — "Notificar cliente?" antes de executar
 * uma ação relevante (pagamento, contrato, upload, liberação, docs, etc.).
 *
 * Regras da UI:
 * - Sim → escolher canais (e-mail, WhatsApp, portal).
 * - Não → motivo obrigatório com mínimo 20 caracteres.
 * - E-mail habilita só se cliente tem e-mail.
 * - WhatsApp fica preparado (aviso de "preparado — provedor pode não estar configurado").
 */
export function NotificacaoPolicyPicker({
  value,
  onChange,
  clienteEmail,
  acaoLabel,
  className,
}: Props) {
  const emailDisabled = !clienteEmail;
  const motivoInvalido = useMemo(
    () => !value.notificar_cliente && value.motivo_nao_notificar.trim().length < 20,
    [value],
  );

  return (
    <div
      className={
        "rounded-lg border border-neutral-300 bg-white p-4 text-neutral-900 " +
        (className || "")
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-neutral-700" />
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
          NOTIFICAR CLIENTE?
        </span>
        {acaoLabel ? (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-neutral-500">
            {acaoLabel}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, notificar_cliente: true, motivo_nao_notificar: "" })
          }
          className={
            "flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold uppercase " +
            (value.notificar_cliente
              ? "border-emerald-600 bg-emerald-50 text-emerald-800"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
          }
        >
          <Bell className="h-4 w-4" /> Sim, notificar
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              notificar_cliente: false,
              canais: { email: false, whatsapp: false, portal: false },
            })
          }
          className={
            "flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold uppercase " +
            (!value.notificar_cliente
              ? "border-red-700 bg-red-50 text-red-800"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
          }
        >
          <BellOff className="h-4 w-4" /> Não notificar
        </button>
      </div>

      {value.notificar_cliente ? (
        <div className="mt-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            CANAIS
          </div>
          <label
            className={
              "flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm " +
              (emailDisabled
                ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400"
                : value.canais.email
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-neutral-300 bg-white text-neutral-700")
            }
          >
            <input
              type="checkbox"
              disabled={emailDisabled}
              checked={value.canais.email}
              onChange={(e) =>
                onChange({
                  ...value,
                  canais: { ...value.canais, email: e.target.checked },
                })
              }
            />
            <Mail className="h-4 w-4" />
            <span className="font-semibold uppercase">E-MAIL</span>
            <span className="ml-auto text-[11px] text-neutral-500">
              {clienteEmail || "sem e-mail cadastrado"}
            </span>
          </label>

          <label
            className={
              "flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm " +
              (value.canais.whatsapp
                ? "border-amber-600 bg-amber-50 text-amber-900"
                : "border-neutral-300 bg-white text-neutral-700")
            }
          >
            <input
              type="checkbox"
              checked={value.canais.whatsapp}
              onChange={(e) =>
                onChange({
                  ...value,
                  canais: { ...value.canais, whatsapp: e.target.checked },
                })
              }
            />
            <MessageCircle className="h-4 w-4" />
            <span className="font-semibold uppercase">WHATSAPP</span>
            <span className="ml-auto text-[11px] text-amber-800">
              PREPARADO (PROVEDOR PODE NÃO ESTAR CONFIGURADO)
            </span>
          </label>

          <label
            className={
              "flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm " +
              (value.canais.portal
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-neutral-300 bg-white text-neutral-700")
            }
          >
            <input
              type="checkbox"
              checked={value.canais.portal}
              onChange={(e) =>
                onChange({
                  ...value,
                  canais: { ...value.canais, portal: e.target.checked },
                })
              }
            />
            <Monitor className="h-4 w-4" />
            <span className="font-semibold uppercase">PORTAL (SINO DO CLIENTE)</span>
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            MOTIVO PARA NÃO NOTIFICAR (MÍNIMO 20 CARACTERES)
          </div>
          <textarea
            value={value.motivo_nao_notificar}
            onChange={(e) =>
              onChange({ ...value, motivo_nao_notificar: e.target.value.toUpperCase() })
            }
            rows={3}
            className="w-full rounded border border-neutral-300 bg-white p-2 text-sm uppercase text-neutral-900 focus:outline-none focus:ring-1 focus:ring-red-700"
            placeholder="EX: TESTE ADMINISTRATIVO, CLIENTE JÁ CONTACTADO POR WHATSAPP INTERNO..."
          />
          <div
            className={
              "text-[11px] " + (motivoInvalido ? "text-red-700" : "text-neutral-500")
            }
          >
            {value.motivo_nao_notificar.trim().length}/20 caracteres
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Serializa a política para envio ao backend (aceito por edge functions que
 * usam extractPolicy do _shared/notificacaoPolicy.ts).
 */
export function toBackendPolicy(v: NotificacaoPolicyValue) {
  return {
    notificar_cliente: v.notificar_cliente,
    canais: v.canais,
    motivo_nao_notificar: v.notificar_cliente ? null : v.motivo_nao_notificar.trim(),
  };
}

export function policyIsValid(v: NotificacaoPolicyValue) {
  if (v.notificar_cliente) return true;
  return v.motivo_nao_notificar.trim().length >= 20;
}