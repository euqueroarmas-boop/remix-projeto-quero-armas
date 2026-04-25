import { X, ShieldCheck, Calendar, Hash, FileBadge, Crosshair, Layers, AlertTriangle, Gauge, Weight, Ruler, Zap, MapPin, BadgeCheck } from "lucide-react";
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
import { useMemo } from "react";

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
  const { items, match } = useArmamentoCatalogo();
  const info = weapon ? buildWeaponInfo(weapon.nome_arma, weapon.numero_arma) : null;
  const catalog: ArmamentoCatalogo | null = useMemo(
    () => (weapon ? match(weapon.nome_arma) : null),
    [weapon, match],
  );
  const variants = useMemo(() => {
    if (!info) return [] as ArmamentoCatalogo[];
    return items.filter((it) => it.tipo === info.kind && (!catalog || it.id !== catalog.id)).slice(0, 4);
  }, [items, info, catalog]);

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
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end bg-slate-900/60 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="flex-1"
      />
      <aside
        className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-700/40 text-slate-100 shadow-2xl"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, hsl(190 60% 22% / 0.35), transparent 50%), radial-gradient(circle at 80% 100%, hsl(220 30% 14% / 0.6), transparent 60%), linear-gradient(180deg, hsl(220 28% 10%), hsl(220 25% 7%))",
        }}
      >
        {/* Top bar estilo ARMORY */}
        <div className="relative flex items-center justify-between border-b border-white/10 bg-black/30 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-200/80">
              ARMORY
            </span>
            <span className="ml-2 text-[9px] font-mono text-white/40">
              / {WEAPON_KIND_LABEL[info.kind]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hero + status */}
        <div className="relative px-6 pt-5">
          {/* Marquee do nome (estilo CoD) */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[28px] font-black uppercase tracking-tight leading-none text-white">
                {displayMarca}
              </div>
              <div className="mt-0.5 text-[14px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
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
                <span className="rounded-sm border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">
                  ★ BLUEPRINT
                </span>
              )}
            </div>
          </div>

          {/* Hero da arma com glow */}
          <div className="relative mt-4 h-[26rem] w-full overflow-hidden rounded-xl border border-white/10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${backgroundForKind(info.kind)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, rgba(2,4,8,0.3), rgba(2,4,8,0.65)), radial-gradient(circle at 50% 60%, ${accent}40, transparent 65%)`,
              }}
            />
            <div className="relative flex h-full items-center justify-center px-4 py-4">
              <img
                src={catalog?.imagem || renderForKind(info.kind)}
                alt={`${displayMarca} ${displayModelo}`}
                style={{ background: "transparent" }}
                className="h-full w-[118%] max-w-none object-contain drop-shadow-[0_14px_32px_rgba(0,0,0,0.95)]"
              />
            </div>
            {/* corner ticks */}
            <div className="pointer-events-none absolute left-2 top-2 h-3 w-6 border-l border-t border-white/30" />
            <div className="pointer-events-none absolute right-2 top-2 h-3 w-6 border-r border-t border-white/30" />
            <div className="pointer-events-none absolute bottom-2 left-2 h-3 w-6 border-b border-l border-white/30" />
            <div className="pointer-events-none absolute bottom-2 right-2 h-3 w-6 border-b border-r border-white/30" />
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
            <span className="rounded-sm bg-white/5 px-2 py-1 font-mono text-white/70">
              {formatDate(weapon.data_validade)}
            </span>
            {catalog?.classificacao_legal && (
              <span className="rounded-sm bg-white/5 px-2 py-1 font-bold uppercase tracking-wider text-white/70">
                {catalog.classificacao_legal}
              </span>
            )}
            {catalog?.origem && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-white/5 px-2 py-1 font-bold uppercase tracking-wider text-white/70">
                <MapPin className="h-3 w-3" /> {catalog.origem}
              </span>
            )}
          </div>
        </div>

        {/* WEAPON DETAILS — Stats estilo armory */}
        {catalog && (
          <div className="mt-5 px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-cyan-300" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/80">
                Weapon Details
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-3">
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
          <SpecCell icon={<FileBadge className="h-3 w-3" />} label="Nº SÉRIE" value={maskSerial(weapon.numero_arma)} />
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
          <p className="mt-4 px-6 text-[11px] leading-relaxed text-white/60">
            {catalog.descricao}
          </p>
        )}

        {/* Variantes do mesmo tipo (estilo Sand Snake / Bengal / Piercer) */}
        {variants.length > 0 && (
          <div className="mt-5 px-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-cyan-300" />
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/80">
                Outras opções · {WEAPON_KIND_LABEL[info.kind]}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.03] p-2 transition-colors hover:border-cyan-300/40"
                >
                  <div className="text-[8px] font-bold uppercase tracking-wider text-white/40">
                    {v.marca}
                  </div>
                  <div className="text-[11px] font-bold text-white/90 leading-tight">
                    {v.modelo}
                  </div>
                  <div className="mt-0.5 text-[9px] font-mono text-cyan-300/80">{v.calibre}</div>
                  <div className="mt-1 h-20">
                    <img
                      src={v.imagem || renderForKind(v.tipo as any)}
                      alt={v.modelo}
                      style={{ background: "transparent" }}
                      className="h-full w-[112%] max-w-none -translate-x-[6%] object-contain opacity-90"
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
            <Layers className="h-3.5 w-3.5 text-cyan-300" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/80">
              Estoque · Mesmo calibre
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/30 p-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">
                {displayCalibre}
              </div>
              <div className="font-mono text-2xl font-bold text-white">
                {ammoSameCalibre.toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="text-right text-[10px] text-white/40">
              {ammoSameCalibre === 0
                ? "Sem munição cadastrada"
                : "Munições disponíveis"}
            </div>
          </div>
        </div>

        {/* Documentos vinculados */}
        <div className="mt-5 px-6 pb-8">
          <div className="mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/80">
              Acessórios · Documentos vinculados
            </div>
          </div>
          {relatedDocs.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-white/15 bg-black/20 px-3 py-3 text-[11px] text-white/50">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Nenhum documento vinculado a esta arma.
            </div>
          ) : (
            <div className="space-y-1.5">
              {relatedDocs.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-cyan-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-cyan-300">
                      {d.category}
                    </span>
                    <span className="text-[11px] font-semibold text-white/90">{d.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/50">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function StatBar({ label, value, accent }: { label: string; value: number | null; accent: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="grid grid-cols-[80px_1fr_28px] items-center gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">{label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${v}%`, background: `linear-gradient(90deg, ${accent}cc, ${accent})`, boxShadow: `0 0 8px ${accent}88` }}
        />
        {/* tick marks */}
        <div className="pointer-events-none absolute inset-0 flex">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-black/40 last:border-r-0" />
          ))}
        </div>
      </div>
      <span className="text-right font-mono text-[9px] text-white/70">{value ?? "—"}</span>
    </div>
  );
}

function SpecCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/50">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[12px] font-semibold text-white/90">
        {value}
      </div>
    </div>
  );
}