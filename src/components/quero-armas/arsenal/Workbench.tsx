import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Crosshair, Layers, ShieldAlert, Star, Radio, X } from "lucide-react";
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
  catalogo_id?: string | null;
}

interface DocCard {
  id: string;
  category: string;
  title: string;
  date: string | null;
  daysToExpire: number | null;
  onOpen?: () => void;
  onDelete?: () => void;
}

interface Props {
  weapons: WorkbenchWeapon[];
  documents: DocCard[];
  ammoByCalibre: { calibre: string; quantidade: number }[];
  onSelectWeapon: (w: WorkbenchWeapon, info: WeaponInfo) => void;
  headerAction?: React.ReactNode;
}

const toneClasses = {
  ok: { glow: "shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  warn: { glow: "shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  danger: { glow: "shadow-[0_8px_24px_-12px_rgba(239,68,68,0.35)]", chip: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  muted: { glow: "shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]", chip: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

function urgencyText(days: number | null): string {
  if (days === null) return "SEM DATA";
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  if (days < 0) return `VENCIDO ${fmt(Math.abs(days))} DIAS`;
  if (days === 0) return "VENCE HOJE";
  return `${fmt(days)} DIAS RESTANTES`;
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
  // Aura/fundo do card sempre neutro (sem amarelo/dourado).
  // Cores semânticas ficam apenas em chips, dots e badges de urgência.
  const accent =
    tone === "danger" ? "#ef4444"
    : tone === "ok" ? "#10b981"
    : "#94a3b8";
  const marca = catalog?.marca || info.marca || info.label;
  const modeloRaw = (catalog?.modelo || info.modelo || "").toString();
  // Espingardas com espaços; demais armas compactadas (TS9, RT838, T4).
  const isEspingarda = info.kind === "espingarda";
  const modelo = isEspingarda
    ? modeloRaw
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
    : modeloRaw.replace(/\s+/g, "").trim();
  const calibre = catalog?.calibre || info.calibre || "—";
  const bg = backgroundForKind(info.kind);
  const render = catalog?.imagem || renderForKind(info.kind);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-all hover:-translate-y-[2px] hover:border-slate-300 ${c.glow}`}
    >
      {/* Cinematic background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(248,250,252,0.85) 100%), radial-gradient(circle at 50% 60%, ${accent}14, transparent 70%)`,
        }}
      />
      {/* Scanline subtle */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(15,23,42,0.35) 2px, rgba(15,23,42,0.35) 3px)",
        }}
      />
      {/* Corner ticks */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-2 top-2 h-3 w-6 border-l border-t border-slate-300" />
        <div className="absolute right-2 top-2 h-3 w-6 border-r border-t border-slate-300" />
        <div className="absolute bottom-2 left-2 h-3 w-6 border-b border-l border-slate-300" />
        <div className="absolute bottom-2 right-2 h-3 w-6 border-b border-r border-slate-300" />
      </div>

      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot} animate-pulse`} />
              <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-500">
                {WEAPON_KIND_LABEL[info.kind]}
              </span>
              {catalog && (
                <span className="inline-flex items-center gap-0.5 rounded-sm border border-emerald-200 bg-emerald-50 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">
                  <Star className="h-2 w-2 fill-emerald-500 text-emerald-500" /> ID
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-[15px] font-black uppercase tracking-tight text-slate-900 leading-tight">
              {marca}
            </div>
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7A1F2B]">
              {modelo}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              CAL · {calibre}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 max-w-[40%]">
            <span
              className={`rounded-sm border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] leading-tight text-right ${c.chip}`}
            >
              {urgencyText(w.daysToExpire)}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
              {w.source}
              {w.hasGte && (
                <span className="rounded bg-[#FBF3F4] px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  + GTE
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Weapon render with glow — transparent, large, detailed */}
        <div
          className={`relative mx-auto my-4 overflow-hidden rounded-xl ${size === "lg" ? "h-52 md:h-56" : "h-60 md:h-64"} w-full`}
          style={{ background: "transparent", backgroundImage: "none" }}
        >
          {(() => {
            const isLonga = ["espingarda", "fuzil", "carabina", "submetralhadora"].includes(info.kind);
            const longaScale = info.kind === "espingarda"
              ? "scale-125 md:scale-[1.75]"
              : "scale-110 md:scale-[1.65]";
            return (
              <img
                src={render}
                alt={`${marca} ${modelo}`}
                loading="lazy"
                style={{ background: "transparent" }}
                className={`relative h-full w-full max-w-full object-contain px-2 py-3 drop-shadow-[0_10px_18px_rgba(15,23,42,0.25)] ${isLonga ? longaScale : ""}`}
              />
            );
          })()}
        </div>

        {/* Mini stats armory */}
        {catalog && (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
            <MiniStat label="DMG" value={catalog.stat_dano} color="#ef4444" />
            <MiniStat label="PRC" value={catalog.stat_precisao} color="#0ea5e9" />
            <MiniStat label="MOB" value={catalog.stat_mobilidade} color="#10b981" />
          </div>
        )}

        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-200 pt-2 text-[10px]">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">CAL</div>
            <div className="font-bold text-slate-800">{calibre}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">SIGMA</div>
            <div className="truncate font-mono text-slate-700">{w.numero_sigma || "—"}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">N° SÉRIE</div>
            <div className="truncate font-mono text-slate-700">{w.numero_arma || "—"}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-[#7A1F2B] ml-auto">
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
        <span className="font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="font-mono text-slate-700">{value ?? "—"}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color, boxShadow: `0 0 6px ${color}66` }} />
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
    : "#0ea5e9";
  return (
    <div className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:bg-slate-50">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: accent, boxShadow: `0 0 8px ${accent}55` }} />
      <button
        type="button"
        onClick={d.onOpen}
        className="flex flex-1 items-center gap-2.5 text-left min-w-0"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FBF3F4] text-[#7A1F2B]">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
              {d.category}
            </span>
            <span className={`rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase ${c.chip}`}>
              {urgencyText(d.daysToExpire)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide text-slate-800">{d.title}</div>
        </div>
      </button>
      {d.onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); d.onDelete?.(); }}
          aria-label="Excluir documento"
          title="Excluir"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Workbench({ weapons, documents, ammoByCalibre, onSelectWeapon, headerAction }: Props) {
  const [showAll, setShowAll] = useState(false);
  const { match, byId, resolveCraf, loading: catLoading } = useArmamentoCatalogo();

  const enriched = useMemo(
    () => weapons.map((w) => ({
      w,
      info: buildWeaponInfo(w.nome_arma, w.numero_arma),
      // Prioriza vínculo direto (catalogo_id na CRAF/GTE) → senão tenta match fuzzy
      catalog: byId(w.catalogo_id || null) || match(w.nome_arma),
    })),
    [weapons, match, byId],
  );

  // Para CRAFs/GTEs ainda não vinculados ao catálogo: dispara resolução IA (1× por arma).
  useEffect(() => {
    if (catLoading) return;
    enriched.forEach(({ w }) => {
      if (!w.catalogo_id && w.nome_arma) {
        if (w.source === "CRAF" && typeof w.id === "number") {
          resolveCraf({ craf_id: w.id });
        } else if (w.source === "GTE" && typeof w.id === "number") {
          resolveCraf({ gte_id: w.id });
        } else {
          resolveCraf({ nome_arma: w.nome_arma });
        }
      }
    });
  }, [enriched, catLoading, resolveCraf]);

  const longas = enriched.filter((e) => ["fuzil", "carabina", "espingarda"].includes(e.info.kind));
  const curtas = enriched.filter((e) => ["pistola", "revolver", "submetralhadora"].includes(e.info.kind));
  const outras = enriched.filter((e) => e.info.kind === "outra");

  const grupoCurtas = [...curtas, ...outras];
  const visibleLongas = showAll ? longas : longas.slice(0, 2);
  const visibleCurtas = showAll ? grupoCurtas : grupoCurtas.slice(0, 4);
  const overflow = longas.length + grupoCurtas.length - (visibleLongas.length + visibleCurtas.length);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Top HUD strip */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF3F4] text-[#7A1F2B] ring-1 ring-[#7A1F2B]">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-900">
              ARMORY · BANCADA TÁTICA
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Arsenal interpretado a partir do seu cadastro</div>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600">
            <Radio className="h-3 w-3 animate-pulse" />
            ONLINE
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {enriched.length.toString().padStart(2, "0")} ITEM(S)
          </div>
          {headerAction}
        </div>
        {headerAction && (
          <div className="flex md:hidden">{headerAction}</div>
        )}
      </div>

      {/* Bench body */}
      <div className="relative px-4 py-6 md:px-6 md:py-7">
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(14,165,233,0.06), transparent 70%)" }}
        />

        {enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-slate-300" />
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-slate-700">
                NENHUMA ARMA NO ACERVO
              </div>
              <p className="mt-1 max-w-sm text-[11px] text-slate-400">
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
                  className="rounded-full border border-[#E5C2C6] bg-[#FBF3F4] px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A1F2B] hover:bg-[#FBF3F4]"
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
              <Layers className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-700">
                Munições · Por Calibre
              </div>
            </div>
            {ammoByCalibre.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
                Nenhuma munição cadastrada
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ammoByCalibre.slice(0, 6).map((a) => (
                  <div
                    key={a.calibre}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      {a.calibre}
                    </div>
                    <div className="mt-0.5 font-mono text-[15px] font-bold text-slate-900">
                      {a.quantidade.toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#7A1F2B] to-[#641722]"
                        style={{ width: `${Math.min(100, (a.quantidade / 200) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#7A1F2B]" />
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-700">
                Documentos na Bancada
              </div>
            </div>
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
                Nenhum documento vinculado
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {documents.map((d) => (
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