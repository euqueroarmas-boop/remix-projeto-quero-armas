/**
 * F1B-1 — Wrapper sortable de um grupo do Arsenal.
 * Usa @dnd-kit/sortable (mesma stack já usada nos KPIs do ArsenalSummary).
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { ArsenalGroupId } from "./useArsenalGruposLayout";
import { ARSENAL_GROUP_LABELS } from "./useArsenalGruposLayout";

interface Props {
  id: ArsenalGroupId;
  editing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: ReactNode;
}

export function ArsenalGroupItem({ id, editing, isFirst, isLast, onMoveUp, onMoveDown, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 30 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style} className={`relative ${editing ? "ring-1 ring-dashed ring-amber-300 rounded-2xl" : ""}`}>
      {editing && (
        <div className="absolute -top-3 left-3 z-20 flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 shadow-sm">
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            title="Arraste para reordenar"
            {...attributes}
            {...listeners}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-amber-700 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Mover para cima"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-amber-700 hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            title="Mover para baixo"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-amber-700 hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
          <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-amber-800">
            {ARSENAL_GROUP_LABELS[id]}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}