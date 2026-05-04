/**
 * F1B-1 — Toolbar para reordenar manualmente os grupos do Arsenal.
 *
 * Não é "modo de edição": o drag-handle de cada grupo está sempre disponível
 * (mas com opacidade baixa fora do modo). O modo "Organizar" só destaca os
 * handles e habilita os botões de mover ↑/↓ inline.
 */
import { GripVertical, RotateCcw, Check, Pencil } from "lucide-react";

interface Props {
  editing: boolean;
  saving: boolean;
  onToggle: () => void;
  onRestoreDefault: () => void;
}

export function ArsenalGruposToolbar({ editing, saving, onToggle, onRestoreDefault }: Props) {
  return (
    <div className="flex items-center justify-end gap-2">
      {editing && (
        <button
          type="button"
          onClick={onRestoreDefault}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-300 bg-white text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50 transition"
          title="Restaurar ordem padrão"
        >
          <RotateCcw className="h-3 w-3" /> Restaurar Padrão
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[10px] font-bold uppercase tracking-[0.14em] transition ${
          editing
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
        title={editing ? "Concluir organização" : "Organizar grupos"}
      >
        {editing ? (
          <>
            <Check className="h-3 w-3" /> Concluir
          </>
        ) : (
          <>
            <Pencil className="h-3 w-3" /> Organizar Grupos
          </>
        )}
      </button>
      {editing && (
        <span className="hidden md:inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
          <GripVertical className="h-3 w-3" />
          Arraste pelo handle
        </span>
      )}
    </div>
  );
}