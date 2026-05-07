import { ReactNode } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  CircleDot,
  FileText,
  CreditCard,
  ShieldCheck,
  FileImage,
  MapPin,
  Phone,
  Mail,
  Calendar,
} from "lucide-react";

/**
 * Header profissional da tela de conferência do Cadastro Público.
 * Substitui o "dump" anterior por um cabeçalho com:
 *  - foto/selfie em destaque
 *  - identidade (nome, CPF, contatos, cidade)
 *  - 4 chips de status separados (cadastro, financeiro, serviço, documentos)
 *  - meta linha com origem + data/hora
 *
 * 100% leitura/UX. Não altera nada na DB.
 */

export type StatusKind = "ok" | "warn" | "danger" | "neutral" | "info";

function chipColor(kind: StatusKind) {
  switch (kind) {
    case "ok":
      return { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-500" };
    case "warn":
      return { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" };
    case "danger":
      return { bg: "bg-red-50", text: "text-red-800", border: "border-red-200", dot: "bg-red-500" };
    case "info":
      return { bg: "bg-[#FBF3F4]", text: "text-[#7A1F2B]", border: "border-[#E5C2C6]", dot: "bg-[#7A1F2B]" };
    default:
      return { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" };
  }
}

function StatusChip({
  icon: Icon,
  label,
  value,
  kind,
}: {
  icon: any;
  label: string;
  value: string;
  kind: StatusKind;
}) {
  const c = chipColor(kind);
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border ${c.border} ${c.bg} px-2.5 py-1.5 min-w-0`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${c.text}`} />
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 leading-none mb-0.5">
          {label}
        </div>
        <div className={`text-[11px] font-bold uppercase ${c.text} truncate`}>{value}</div>
      </div>
    </div>
  );
}

export interface ConferenciaStatus {
  cadastro: { kind: StatusKind; label: string };
  financeiro: { kind: StatusKind; label: string };
  servico: { kind: StatusKind; label: string };
  documentos: { kind: StatusKind; label: string };
}

export interface ConferenciaHeaderProps {
  selfieSlot?: ReactNode;
  nome: string;
  cpfFormatado: string;
  email?: string | null;
  telefone?: string | null;
  cidadeUf?: string | null;
  servicoInteresse?: string | null;
  recebidoEm?: string | null;
  status: ConferenciaStatus;
  badges?: ReactNode;
  actionsPrimary?: ReactNode;
  actionsDestructive?: ReactNode;
  onBack?: () => void;
  backSlot?: ReactNode;
}

export default function ConferenciaHeader({
  selfieSlot,
  nome,
  cpfFormatado,
  email,
  telefone,
  cidadeUf,
  servicoInteresse,
  recebidoEm,
  status,
  badges,
  actionsPrimary,
  actionsDestructive,
  backSlot,
}: ConferenciaHeaderProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Top strip — origem */}
      <div className="flex items-center justify-between gap-3 bg-[#FBF3F4] border-b border-[#E5C2C6] px-4 py-1.5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A1F2B]">
          <FileText className="h-3 w-3" />
          Cadastro Público — Conferência da Equipe
        </div>
        {recebidoEm && (
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <Calendar className="h-3 w-3" />
            Recebido em <span className="font-mono ml-1">{recebidoEm}</span>
          </div>
        )}
      </div>

      <div className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          {backSlot}
          {selfieSlot && <div className="shrink-0">{selfieSlot}</div>}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1
                  className="text-lg md:text-2xl font-bold tracking-tight uppercase break-words"
                  style={{ color: "hsl(220 20% 14%)" }}
                >
                  {nome}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-600">
                  <span className="font-mono font-semibold text-slate-800">CPF: {cpfFormatado}</span>
                  {telefone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" /> {telefone}
                    </span>
                  )}
                  {email && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 text-slate-400" /> {email}
                    </span>
                  )}
                  {cidadeUf && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" /> {cidadeUf}
                    </span>
                  )}
                </div>
                {servicoInteresse && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] uppercase font-bold text-slate-700">
                    <ShieldCheck className="h-3 w-3 text-[#7A1F2B]" />
                    {servicoInteresse}
                  </div>
                )}
                {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
              </div>
            </div>

            {/* Chips de status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              <StatusChip icon={CircleDot} label="Cadastro" value={status.cadastro.label} kind={status.cadastro.kind} />
              <StatusChip icon={CreditCard} label="Financeiro" value={status.financeiro.label} kind={status.financeiro.kind} />
              <StatusChip icon={ShieldCheck} label="Serviço" value={status.servico.label} kind={status.servico.kind} />
              <StatusChip icon={FileImage} label="Documentos" value={status.documentos.label} kind={status.documentos.kind} />
            </div>
          </div>
        </div>

        {/* Ações */}
        {(actionsPrimary || actionsDestructive) && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">{actionsPrimary}</div>
            <div className="flex flex-wrap gap-1.5 md:justify-end">{actionsDestructive}</div>
          </div>
        )}
      </div>
    </section>
  );
}

export const StatusIcons = { CheckCircle2, AlertTriangle, Clock, XCircle };