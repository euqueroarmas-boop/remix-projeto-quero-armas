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
      className={"nv-block " + (className || "")}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Bell className="h-4 w-4 shrink-0" />
        <span className="nv-block__title mb-0">Notificar cliente?</span>
        {acaoLabel ? <span className="nv-eyebrow ml-auto">{acaoLabel}</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, notificar_cliente: true, motivo_nao_notificar: "" })
          }
          className={
            "nv-optbtn " +
            (value.notificar_cliente ? "nv-optbtn--ok" : "")
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
            "nv-optbtn " +
            (!value.notificar_cliente ? "nv-optbtn--danger" : "")
          }
        >
          <BellOff className="h-4 w-4" /> Não notificar
        </button>
      </div>

      {value.notificar_cliente ? (
        <div className="mt-4 space-y-2">
          <div className="nv-eyebrow">Canais</div>
          <label
            className={
              "nv-chan " +
              (emailDisabled ? "nv-chan--off" : value.canais.email ? "nv-chan--on" : "")
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
            <Mail className="h-4 w-4 shrink-0" />
            <span className="nv-chan__name">E-mail</span>
            <span className="nv-chan__meta">{clienteEmail || "sem e-mail cadastrado"}</span>
          </label>

          <label
            className={
              "nv-chan " + (value.canais.whatsapp ? "nv-chan--warn" : "")
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
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="nv-chan__name">WhatsApp</span>
            <span className="nv-chan__meta">preparado — provedor pode não estar configurado</span>
          </label>

          <label
            className={
              "nv-chan " + (value.canais.portal ? "nv-chan--on" : "")
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
            <Monitor className="h-4 w-4 shrink-0" />
            <span className="nv-chan__name">Portal (sino do cliente)</span>
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="nv-eyebrow">Motivo para não notificar (mínimo 20 caracteres)</div>
          <textarea
            value={value.motivo_nao_notificar}
            onChange={(e) =>
              onChange({ ...value, motivo_nao_notificar: e.target.value.toUpperCase() })
            }
            rows={3}
            className="nv-input nv-input--caps"
            placeholder="EX: TESTE ADMINISTRATIVO, CLIENTE JÁ CONTACTADO POR WHATSAPP INTERNO..."
          />
          <div
            className={"nv-counter " + (motivoInvalido ? "text-red-700" : "")}
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