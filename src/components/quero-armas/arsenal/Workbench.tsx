import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Crosshair, Layers, ShieldAlert, Star, Radio } from "lucide-react";
import {
  buildWeaponInfo,
  maskSerial,
  TACTICAL,
  urgencyTone,
  WeaponInfo,
  WEAPON_KIND_LABEL,
} from "./utils";
import { useArmamentoCatalogo, type ArmamentoCatalogo } from "./useArmamentoCatalogo";
import { backgroundForKind, renderForKind } from "./weaponAssets";

export interface WorkbenchWeapon {
  id: number | string;
  source: "CRAF" | "GTE";
  nome_arma: string | null;
  numero_arma: string | null;
  numero_sigma: string | null;
  data_validade: string | null;
  daysToExpire: number | null;
  hasGte?: boolean;
}

interface DocCard {
  id: string;
  category: string;
  title: string;
  date: string | null;
  daysToExpire: number | null;
  onOpen?: () => void;
}

interface Props {
  weapons: WorkbenchWeapon[];
  documents: DocCard[];
  ammoByCalibre: { calibre: string; quantidade: number }[];
  onSelectWeapon: (w: WorkbenchWeapon, info: WeaponInfo) => void;
}

const toneClasses = {
  ok: { glow: "shadow-[0_0_24px_-6px_rgba(16,185,129,0.55)]", chip: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40", dot: "bg-emerald-400" },
  warn: { glow: "shadow-[0_0_24px_-6px_rgba(245,158,11,0.55)]", chip: "bg-amber-400/15 text-amber-300 border-amber-400/40", dot: "bg-amber-400" },
  danger: { glow: "shadow-[0_0_24px_-6px_rgba(239,68,68,0.55)]", chip: "bg-red-500/15 text-red-300 border-red-500/40", dot: "bg-red-500" },
  muted: { glow: "shadow-[0_0_24px_-6px_rgba(148,163,184,0.35)]", chip: "bg-white/5 text-white/60 border-white/10", dot: "bg-white/40" },
};

function urgencyText(days: number | null): string {
  if (days === null) return "SEM DATA";
  if (days < 0) return `VENCIDO ${Math.abs(days)}D`;
  if (days === 0) return "VENCE HOJE";
  return `${days}D RESTANTES`;
}

function WeaponCard({
  w,
  info,
  catalog,
  onClick,
  size = "md",
}: {
  w: WorkbenchWeapon;
  info: WeaponInfo;
  catalog: ArmamentoCatalogo | null;
  onClick: () => void;
  size?: "lg" | "md";
}) {
  const tone = urgencyTone(w.daysToExpire);
  const c = toneClasses[tone];
  const accent =
    tone === "ok" ? "#10b981"
    : tone === "warn" ? "#f59e0b"
    : tone === "danger" ? "#ef4444"
    : "#22d3ee";
  const marca = catalog?.marca || info.marca || info.label;
  const modelo = catalog?.modelo || info.modelo || "";
  const calibre = catalog?.calibre || info.calibre || "—";
  const bg = backgroundForKind(info.kind);
  const render = catalog?.imagem || renderForKind(info.kind);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border border-white/10 text-left transition-all hover:-translate-y-[2px] hover:border-white/30 ${c.glow}`}
      style={{ background: "linear-gradient(180deg, rgba(10,12,18,0.9), rgba(6,8,12,0.95))" }}
    >
      {/* Cinematic background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover:opacity-80"
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(2,4,8,0.45) 0%, rgba(2,4,8,0.85) 100%), radial-gradient(circle at 50% 60%, ${accent}1f, transparent 70%)`,
        }}
      />
      {/* Scanline subtle */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)",
        }}
      />
      {/* Corner ticks */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-2 top-2 h-3 w-6 border-l border-t border-white/40" />
        <div className="absolute right-2 top-2 h-3 w-6 border-r border-t border-white/40" />
        <div className="absolute bottom-2 left-2 h-3 w-6 border-b border-l border-white/40" />
        <div className="absolute bottom-2 right-2 h-3 w-6 border-b border-r border-white/40" />
      </div>

      <div className="relative p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot} animate-pulse`} />
              <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-white/70">
                {WEAPON_KIND_LABEL[info.kind]}
              </span>
              {catalog && (
                <span className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-400/40 bg-emerald-400/10 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">
                  <Star className="h-2 w-2 fill-emerald-400 text-emerald-400" /> ID
                </span>
              )}
            </div>
            <div className="mt-1 text-[16px] font-black uppercase tracking-tight text-white leading-tight">
              {marca}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
              {modelo}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-sm border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${c.chip}`}
          >
            {urgencyText(w.daysToExpire)}
          </span>
        </div>

        {/* Weapon render with glow — transparent, large, detailed */}
        <div className={`relative mx-auto my-4 overflow-hidden rounded-xl border border-white/10 ${size === "lg" ? "h-72 md:h-80" : "h-60 md:h-64"} w-full bg-slate-950/70`}>
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(34,211,238,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,0.16) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(2,4,8,0.18), rgba(2,4,8,0.72)), radial-gradient(ellipse at 50% 65%, ${accent}33, transparent 68%)`,
            }}
          />
          <img
            src={render}
            alt={`${marca} ${modelo}`}
            loading="lazy"
            style={{ background: "transparent" }}
            className="relative h-full w-[112%] max-w-none -translate-x-[6%] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]"
          />
        </div>

        {/* Mini stats armory */}
        {catalog && (
          <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-2">
            <MiniStat label="DMG" value={catalog.stat_dano} color="#ef4444" />
            <MiniStat label="PRC" value={catalog.stat_precisao} color="#22d3ee" />
            <MiniStat label="MOB" value={catalog.stat_mobilidade} color="#10b981" />
          </div>
        )}

        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-2 text-[10px]">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">CAL</div>
            <div className="font-bold text-white/90">{calibre}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">SIGMA</div>
            <div className="truncate font-mono text-white/80">{w.numero_sigma || "—"}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">N° SÉRIE</div>
            <div className="truncate font-mono text-white/80">{maskSerial(w.numero_arma)}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-white/50">
          <span className="inline-flex items-center gap-1">
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-white/80">
              {w.source}
            </span>
            {w.hasGte && (
              <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-cyan-300">
                + GTE
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-white/40 group-hover:text-cyan-300">
            INSPECIONAR <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div>
      <div className="flex items-center justify-between text-[8px]">
        <span className="font-bold uppercase tracking-wider text-white/50">{label}</span>
        <span className="font-mono text-white/70">{value ?? "—"}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color, boxShadow: `0 0 6px ${color}cc` }} />
      </div>
    </div>
  );
}

function DocumentTag({ d }: { d: DocCard }) {
  const tone = urgencyTone(d.daysToExpire);
  const c = toneClasses[tone];
  const accent =
    tone === "ok" ? "#10b981"
    : tone === "warn" ? "#f59e0b"
    : tone === "danger" ? "#ef4444"
    : "#22d3ee";
  return (
    <button
      type="button"
      onClick={d.onOpen}
      className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-all hover:-translate-y-[1px] hover:border-white/25 hover:bg-white/[0.06]"
    >
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/40 text-cyan-300">
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/80">
            {d.category}
          </span>
          <span className={`rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase ${c.chip}`}>
            {urgencyText(d.daysToExpire)}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-white/90">{d.title}</div>
      </div>
    </button>
  );
}

export function Workbench({ weapons, documents, ammoByCalibre, onSelectWeapon }: Props) {
  const [showAll, setShowAll] = useState(false);
  const { match, autoCreatePending, loading: catLoading } = useArmamentoCatalogo();

  const enriched = useMemo(
    () => weapons.map((w) => ({ w, info: buildWeaponInfo(w.nome_arma, w.numero_arma), catalog: match(w.nome_arma) })),
    [weapons, match],
  );

  // Para armas sem match no catálogo, pede pra IA gerar entrada pendente de revisão (uma vez).
  useEffect(() => {
    if (catLoading) return;
    enriched.forEach(({ w, info, catalog }) => {
      if (!catalog && w.nome_arma) autoCreatePending(w.nome_arma, info.kind as any, null);
    });
  }, [enriched, catLoading, autoCreatePending]);

  const longas = enriched.filter((e) => ["fuzil", "carabina", "espingarda"].includes(e.info.kind));
  const curtas = enriched.filter((e) => ["pistola", "revolver", "submetralhadora"].includes(e.info.kind));
  const outras = enriched.filter((e) => e.info.kind === "outra");

  const grupoCurtas = [...curtas, ...outras];
  const visibleLongas = showAll ? longas : longas.slice(0, 2);
  const visibleCurtas = showAll ? grupoCurtas : grupoCurtas.slice(0, 4);
  const overflow = longas.length + grupoCurtas.length - (visibleLongas.length + visibleCurtas.length);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
      style={{ background: "linear-gradient(180deg, #07090f 0%, #04060a 100%)" }}
    >
      {/* Top HUD strip */}
      <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/30">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-white">
              ARMORY · BANCADA TÁTICA
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Arsenal interpretado a partir do seu cadastro</div>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300">
            <Radio className="h-3 w-3 animate-pulse" />
            ONLINE
          </div>
          <div className="text-[10px] font-mono text-white/50">
            {enriched.length.toString().padStart(2, "0")} ITEM(S)
          </div>
        </div>
      </div>

      {/* Bench body */}
      <div className="relative px-4 py-6 md:px-6 md:py-7">
        {/* grid lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #22d3ee 1px, transparent 1px), linear-gradient(to bottom, #22d3ee 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.12), transparent 70%)" }}
        />

        {enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-white/30" />
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-white/80">
                NENHUMA ARMA NO ACERVO
              </div>
              <p className="mt-1 max-w-sm text-[11px] text-white/40">
                Cadastre seus CRAFs para que o sistema monte automaticamente sua bancada.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative space-y-4">
            {visibleLongas.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleLongas.map(({ w, info, catalog }) => (
                  <WeaponCard
                    key={`${w.source}-${w.id}`}
                    w={w}
                    info={info}
                    catalog={catalog}
                    onClick={() => onSelectWeapon(w, info)}
                    size="lg"
                  />
                ))}
              </div>
            )}

            {visibleCurtas.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCurtas.map(({ w, info, catalog }) => (
                  <WeaponCard
                    key={`${w.source}-${w.id}`}
                    w={w}
                    info={info}
                    catalog={catalog}
                    onClick={() => onSelectWeapon(w, info)}
                  />
                ))}
              </div>
            )}

            {overflow > 0 && !showAll && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300 hover:bg-cyan-400/20"
                >
                  Ver todos (+{overflow})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Caixas de munição + cartões de documento (rodapé da bancada) */}
        <div className="relative mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-cyan-300" />
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
                Munições · Por Calibre
              </div>
            </div>
            {ammoByCalibre.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-4 text-center text-[11px] text-white/40">
                Nenhuma munição cadastrada
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ammoByCalibre.slice(0, 6).map((a) => (
                  <div
                    key={a.calibre}
                    className="rounded-xl border border-white/10 bg-black/30 p-2 backdrop-blur"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                      {a.calibre}
                    </div>
                    <div className="mt-0.5 font-mono text-[15px] font-bold text-white">
                      {a.quantidade.toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500"
                        style={{ width: `${Math.min(100, (a.quantidade / 200) * 100)}%`, boxShadow: "0 0 6px #22d3ee" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-cyan-300" />
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
                Documentos na Bancada
              </div>
            </div>
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-4 text-center text-[11px] text-white/40">
                Nenhum documento vinculado
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {documents.slice(0, 6).map((d) => (
                  <DocumentTag key={d.id} d={d} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}