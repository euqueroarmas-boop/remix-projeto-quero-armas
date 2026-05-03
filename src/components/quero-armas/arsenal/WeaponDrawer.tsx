import { X, ShieldCheck, Calendar, Hash, FileBadge, Crosshair, Layers, AlertTriangle, Gauge, Weight, Ruler, Zap, MapPin, BadgeCheck, Trash2, Loader2 } from "lucide-react";
import { WeaponSilhouette } from "./WeaponSilhouette";
import { backgroundForKind, renderForKind } from "./weaponAssets";
import {
  buildWeaponInfo,
  maskSerial,
  TACTICAL,
  urgencyTone,
  WEAPON_KIND_LABEL,
} from "./utils";
import type { WorkbenchWeapon } from "./Workbench";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";
import { useEffect, useMemo, useState } from "react";

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
  onDelete?: (weapon: WorkbenchWeapon) => Promise<void> | void;
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

export function WeaponDrawer({ open, weapon, relatedDocs, ammoSameCalibre, onClose, onDelete }: Props) {
  const { items, match } = useArmamentoCatalogo();
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { setConfirmDel(false); setDeleting(false); }, [weapon?.id, open]);
  const info = weapon ? buildWeaponInfo(weapon.nome_arma, weapon.numero_arma) : null;
  const catalog: ArmamentoCatalogo | null = useMemo(
    () => (weapon ? match(weapon.nome_arma) : null),
    [weapon, match],
  );
  const variants = useMemo(() => {
    if (!info) return [] as ArmamentoCatalogo[];
    return items.filter((it) => it.tipo === info.kind && (!catalog || it.id !== catalog.id)).slice(0, 4);
  }, [items, info, catalog]);

  // Lock background scroll while drawer is open + ESC to close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !weapon || !info) return null;
  const tone = urgencyTone(weapon.daysToExpire);
  const accent =
    tone === "ok"
      ? TACTICAL.ok
      : tone === "warn"
      ? TACTICAL.warn
      : tone === "danger"
      ? TACTICAL.danger
      : TACTICAL.cyan;

  const displayMarca = catalog?.marca || info.marca || info.label;
  const displayModelo = catalog?.modelo || info.modelo || "";
  const displayCalibre = catalog?.calibre || info.calibre || "—";

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center">
      <aside
        className="relative flex h-full w-full flex-col overflow-y-auto overscroll-contain text-slate-900 bg-slate-50 shadow-2xl"
      >
        {/* Top bar estilo ARMORY */}
        <div className="relative flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 backdrop-blur shadow-sm">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-[#7A1F2B]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#7A1F2B]">
              ARMORY
            </span>
            <span className="ml-2 text-[9px] font-mono text-slate-400">
              / {WEAPON_KIND_LABEL[info.kind]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hero + status */}
        <div className="relative px-6 pt-5">
          {/* Marquee do nome (estilo CoD) */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[28px] font-black uppercase tracking-tight leading-none text-slate-900">
                {displayMarca}
              </div>
              <div className="mt-0.5 text-[14px] font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
                {displayModelo || displayCalibre}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
              >
                <BadgeCheck className="h-3 w-3" />
                {weapon.source === "CRAF" ? "REGISTRADA" : "EM TRÁFEGO"}
              </span>
              {catalog && (
                <span className="rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  ★ BLUEPRINT
                </span>
              )}
            </div>
          </div>

          {/* Hero da arma com glow */}
          <div
            className="relative mt-4 h-[26rem] w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="relative flex h-full items-center justify-center px-2 py-2">
              <img
                src={catalog?.imagem || renderForKind(info.kind)}
                alt={`${displayMarca} ${displayModelo}`}
                style={{ background: "transparent" }}
                className={
                  ["espingarda", "fuzil", "carabina", "submetralhadora"].includes(info.kind)
                    ? "h-auto max-h-full w-full max-w-[98%] object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                    : "h-full w-full max-w-full object-contain px-2 py-3 drop-shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                }
              />
            </div>
          </div>

          {/* Validade pill */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className="rounded-sm px-2 py-1 font-bold uppercase tracking-wider"
              style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
            >
              {weapon.daysToExpire === null
                ? "SEM DATA"
                : weapon.daysToExpire < 0
                ? `VENCIDO ${Math.abs(weapon.daysToExpire)}D`
                : weapon.daysToExpire === 0
                ? "VENCE HOJE"
                : `${weapon.daysToExpire}D RESTANTES`}
            </span>
            <span className="rounded-sm bg-slate-100 px-2 py-1 font-mono text-slate-700">
              {formatDate(weapon.data_validade)}
            </span>
            {catalog?.classificacao_legal && (
              <span className="rounded-sm bg-slate-100 px-2 py-1 font-bold uppercase tracking-wider text-slate-700">
                {catalog.classificacao_legal}
              </span>
            )}
            {catalog?.origem && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-slate-100 px-2 py-1 font-bold uppercase tracking-wider text-slate-700">
                <MapPin className="h-3 w-3" /> {catalog.origem}
              </span>
            )}
          </div>
        </div>

        {/* WEAPON DETAILS — Stats estilo armory */}
        {catalog && (
          <div className="mt-5 px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
                Weapon Details
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <StatBar label="Damage"     value={catalog.stat_dano} accent="#ef4444" />
              <StatBar label="Precision"  value={catalog.stat_precisao} accent="#22d3ee" />
              <StatBar label="Range"      value={catalog.stat_alcance} accent="#a78bfa" />
              <StatBar label="Fire Rate"  value={catalog.stat_cadencia} accent="#f59e0b" />
              <StatBar label="Mobility"   value={catalog.stat_mobilidade} accent="#10b981" />
              <StatBar label="Control"    value={catalog.stat_controle} accent="#f472b6" />
            </div>
          </div>
        )}

        {/* Specs técnicos */}
        <div className="mt-4 grid grid-cols-2 gap-2 px-6">
          <SpecCell icon={<Hash className="h-3 w-3" />}    label="SIGMA"     value={weapon.numero_sigma || "—"} />
          <SpecCell icon={<FileBadge className="h-3 w-3" />} label="Nº SÉRIE" value={weapon.numero_arma || "—"} />
          <SpecCell icon={<Crosshair className="h-3 w-3" />} label="CALIBRE"  value={displayCalibre} />
          <SpecCell icon={<Calendar className="h-3 w-3" />}  label="VALIDADE" value={formatDate(weapon.data_validade)} />
          {catalog?.capacidade_carregador && (
            <SpecCell icon={<Layers className="h-3 w-3" />} label="CAPACIDADE" value={`${catalog.capacidade_carregador} TIROS`} />
          )}
          {catalog?.peso_gramas && (
            <SpecCell icon={<Weight className="h-3 w-3" />} label="PESO" value={`${catalog.peso_gramas} G`} />
          )}
          {catalog?.comprimento_cano_mm && (
            <SpecCell icon={<Ruler className="h-3 w-3" />} label="CANO" value={`${catalog.comprimento_cano_mm} MM`} />
          )}
          {catalog?.alcance_efetivo_m && (
            <SpecCell icon={<Crosshair className="h-3 w-3" />} label="ALCANCE EFETIVO" value={`${catalog.alcance_efetivo_m} M`} />
          )}
          {catalog?.velocidade_projetil_ms && (
            <SpecCell icon={<Zap className="h-3 w-3" />} label="VELOCIDADE" value={`${catalog.velocidade_projetil_ms} M/S`} />
          )}
        </div>

        {catalog?.descricao && (
          <p className="mt-4 px-6 text-[11px] leading-relaxed text-slate-600">
            {catalog.descricao}
          </p>
        )}

        {/* Variantes do mesmo tipo (estilo Sand Snake / Bengal / Piercer) */}
        {variants.length > 0 && (
          <div className="mt-5 px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
                Outras opções · {WEAPON_KIND_LABEL[info.kind]}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="group relative overflow-hidden rounded-md border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:border-[#7A1F2B]"
                >
                  <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    {v.marca}
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 leading-tight">
                    {v.modelo}
                  </div>
                  <div className="mt-0.5 text-[9px] font-mono text-[#7A1F2B]">{v.calibre}</div>
                  <div className="mt-1 h-20 overflow-hidden rounded-md" style={{ background: "transparent", backgroundImage: "none" }}>
                    <img
                      src={v.imagem || renderForKind(v.tipo as any)}
                      alt={v.modelo}
                      className="h-full w-[112%] max-w-none -translate-x-[6%] object-contain opacity-95"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Munições compatíveis */}
        <div className="mt-5 px-6">
          <div className="mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
              Estoque · Mesmo calibre
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {displayCalibre}
              </div>
              <div className="font-mono text-2xl font-bold text-slate-900">
                {ammoSameCalibre.toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              {ammoSameCalibre === 0
                ? "Sem munição cadastrada"
                : "Munições disponíveis"}
            </div>
          </div>
        </div>

        {/* Documentos vinculados */}
        <div className="mt-5 px-6 pb-8">
          <div className="mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#7A1F2B]">
              Acessórios · Documentos vinculados
            </div>
          </div>
          {relatedDocs.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Nenhum documento vinculado a esta arma.
            </div>
          ) : (
            <div className="space-y-1.5">
              {relatedDocs.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-[#FBF3F4] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#7A1F2B] border border-[#E5C2C6]">
                      {d.category}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-800">{d.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zona de risco — Excluir armamento */}
        {onDelete && (
          <div className="mt-2 border-t border-slate-200 px-6 py-5">
            <div className="mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-700">
                Zona de Risco
              </div>
            </div>
            {!confirmDel ? (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir este armamento
              </button>
            ) : (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3">
                <p className="text-[11px] text-rose-800">
                  Tem certeza? Esta ação remove o registro <b>{displayMarca} {displayModelo}</b>{" "}
                  {weapon.numero_arma ? <>(série <span className="font-mono">{weapon.numero_arma}</span>)</> : null}
                  {" "}e seus documentos vinculados. Não pode ser desfeita.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!weapon || !onDelete) return;
                      try {
                        setDeleting(true);
                        await onDelete(weapon);
                        onClose();
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Sim, excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(false)}
                    disabled={deleting}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function StatBar({ label, value, accent }: { label: string; value: number | null; accent: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="grid grid-cols-[80px_1fr_28px] items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${accent}cc, ${accent})`, boxShadow: `0 0 6px ${accent}55` }}
        />
        {/* tick marks */}
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-white/70 last:border-r-0" />
          ))}
        </div>
      </div>
      <span className="text-right font-mono text-[9px] text-slate-700">{value ?? "—"}</span>
    </div>
  );
}

function SpecCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[12px] font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}