import { X, ShieldCheck, Calendar, Hash, FileBadge, Crosshair, Layers, AlertTriangle } from "lucide-react";
import { WeaponSilhouette } from "./WeaponSilhouette";
import {
  buildWeaponInfo,
  maskSerial,
  TACTICAL,
  urgencyTone,
  WEAPON_KIND_LABEL,
} from "./utils";
import type { WorkbenchWeapon } from "./Workbench";

interface RelatedDoc {
  category: string;
  title: string;
  date: string | null;
}

interface Props {
  open: boolean;
  weapon: WorkbenchWeapon | null;
  relatedDocs: RelatedDoc[];
  ammoSameCalibre: number;
  onClose: () => void;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const p = new Date(d);
    return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

export function WeaponDrawer({ open, weapon, relatedDocs, ammoSameCalibre, onClose }: Props) {
  if (!open || !weapon) return null;
  const info = buildWeaponInfo(weapon.nome_arma, weapon.numero_arma);
  const tone = urgencyTone(weapon.daysToExpire);
  const accent =
    tone === "ok"
      ? TACTICAL.ok
      : tone === "warn"
      ? TACTICAL.warn
      : tone === "danger"
      ? TACTICAL.danger
      : TACTICAL.cyan;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end bg-slate-900/40 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="flex-1"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div
          className="relative overflow-hidden px-5 py-5 text-white"
          style={{
            background:
              "linear-gradient(135deg, hsl(220 30% 14%), hsl(220 25% 22%) 60%, hsl(220 22% 28%))",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5 text-white/80 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accent }}
            />
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">
              {WEAPON_KIND_LABEL[info.kind]} · {weapon.source}
            </span>
          </div>
          <div className="mt-1 text-lg font-bold leading-tight">
            {info.marca || info.label}{" "}
            <span className="font-medium text-white/70">{info.modelo || ""}</span>
          </div>
          <div className="mt-1 text-[11px] text-white/60">{info.calibre || "Calibre não identificado"}</div>

          <div className="mt-3 h-28 w-full" style={{ color: accent }}>
            <WeaponSilhouette kind={info.kind} accent={accent} className="h-full w-full" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className="rounded-full px-2 py-0.5 font-bold uppercase tracking-wider"
              style={{ background: `${accent}22`, color: accent }}
            >
              {weapon.daysToExpire === null
                ? "SEM DATA"
                : weapon.daysToExpire < 0
                ? `VENCIDO ${Math.abs(weapon.daysToExpire)}D`
                : weapon.daysToExpire === 0
                ? "VENCE HOJE"
                : `${weapon.daysToExpire}D RESTANTES`}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-white/80">
              {formatDate(weapon.data_validade)}
            </span>
          </div>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-100">
          {[
            { icon: <Hash className="h-3 w-3" />, label: "SIGMA", value: weapon.numero_sigma || "—" },
            { icon: <FileBadge className="h-3 w-3" />, label: "Nº SÉRIE", value: maskSerial(weapon.numero_arma) },
            { icon: <Crosshair className="h-3 w-3" />, label: "CALIBRE", value: info.calibre || "—" },
            { icon: <Calendar className="h-3 w-3" />, label: "VALIDADE", value: formatDate(weapon.data_validade) },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-3">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {s.icon}
                {s.label}
              </div>
              <div className="mt-0.5 font-mono text-[12px] font-semibold text-slate-800">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Munições compatíveis */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-cyan-600" />
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
              Munições do mesmo calibre
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {info.calibre || "Calibre não identificado"}
              </div>
              <div className="font-mono text-2xl font-bold text-slate-800">
                {ammoSameCalibre.toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-400">
              {ammoSameCalibre === 0
                ? "Nenhuma munição cadastrada para este calibre"
                : "Estoque atual"}
            </div>
          </div>
        </div>

        {/* Documentos vinculados */}
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700">
              Documentos vinculados
            </div>
          </div>
          {relatedDocs.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[11px] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Nenhum documento vinculado a esta arma.
            </div>
          ) : (
            <div className="space-y-1.5">
              {relatedDocs.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-900/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
                      {d.category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700">{d.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}