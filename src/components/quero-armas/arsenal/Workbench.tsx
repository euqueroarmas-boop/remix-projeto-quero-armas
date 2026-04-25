import { useMemo, useState } from "react";
import { ChevronRight, FileText, Crosshair, Calendar, Hash, Layers, ShieldAlert } from "lucide-react";
import { WeaponSilhouette } from "./WeaponSilhouette";
import {
  buildWeaponInfo,
  maskSerial,
  TACTICAL,
  urgencyTone,
  WeaponInfo,
  WEAPON_KIND_LABEL,
} from "./utils";

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
  ok: { ring: "ring-emerald-200", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  warn: { ring: "ring-amber-200", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  danger: { ring: "ring-red-200", chip: "bg-red-50 text-red-700", dot: "bg-red-500" },
  muted: { ring: "ring-slate-200", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
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
  onClick,
  size = "md",
}: {
  w: WorkbenchWeapon;
  info: WeaponInfo;
  onClick: () => void;
  size?: "lg" | "md";
}) {
  const tone = urgencyTone(w.daysToExpire);
  const c = toneClasses[tone];
  const accent =
    tone === "ok"
      ? TACTICAL.ok
      : tone === "warn"
      ? TACTICAL.warn
      : tone === "danger"
      ? TACTICAL.danger
      : TACTICAL.cyan;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 text-left shadow-sm ring-1 ${c.ring} transition-all hover:-translate-y-[1px] hover:shadow-lg`}
    >
      {/* HUD ticks */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-3 w-6 border-l border-t border-slate-300/70" />
        <div className="absolute right-0 top-0 h-3 w-6 border-r border-t border-slate-300/70" />
        <div className="absolute bottom-0 left-0 h-3 w-6 border-b border-l border-slate-300/70" />
        <div className="absolute bottom-0 right-0 h-3 w-6 border-b border-r border-slate-300/70" />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot}`} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {WEAPON_KIND_LABEL[info.kind]}
            </span>
          </div>
          <div className="mt-1 text-[14px] font-bold text-slate-800 leading-tight">
            {info.marca || info.label}{" "}
            <span className="font-medium text-slate-500">{info.modelo || ""}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${c.chip}`}
        >
          {urgencyText(w.daysToExpire)}
        </span>
      </div>

      <div className={`mx-auto my-2 ${size === "lg" ? "h-24" : "h-20"} w-full`}>
        <WeaponSilhouette kind={info.kind} accent={accent} className="h-full w-full" />
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-dashed border-slate-200 pt-2 text-[10px]">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">CAL</div>
          <div className="font-bold text-slate-700">{info.calibre || "—"}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">SIGMA</div>
          <div className="font-mono text-slate-700">{w.numero_sigma || "—"}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">N° SÉRIE</div>
          <div className="font-mono text-slate-700">{maskSerial(w.numero_arma)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-slate-900/5 px-1.5 py-0.5 font-bold uppercase tracking-wider">
            {w.source}
          </span>
          {w.hasGte && (
            <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-bold uppercase tracking-wider text-cyan-700">
              + GTE
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-slate-600">
          DETALHES <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

function DocumentTag({ d }: { d: DocCard }) {
  const tone = urgencyTone(d.daysToExpire);
  const c = toneClasses[tone];
  return (
    <button
      type="button"
      onClick={d.onOpen}
      className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md"
    >
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{
          background:
            tone === "ok"
              ? TACTICAL.ok
              : tone === "warn"
              ? TACTICAL.warn
              : tone === "danger"
              ? TACTICAL.danger
              : TACTICAL.cyan,
        }}
      />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-slate-900/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
            {d.category}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase ${c.chip}`}>
            {urgencyText(d.daysToExpire)}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-700">{d.title}</div>
      </div>
    </button>
  );
}

export function Workbench({ weapons, documents, ammoByCalibre, onSelectWeapon }: Props) {
  const [showAll, setShowAll] = useState(false);

  const enriched = useMemo(
    () => weapons.map((w) => ({ w, info: buildWeaponInfo(w.nome_arma, w.numero_arma) })),
    [weapons],
  );

  const longas = enriched.filter((e) => ["fuzil", "carabina", "espingarda"].includes(e.info.kind));
  const curtas = enriched.filter((e) => ["pistola", "revolver", "submetralhadora"].includes(e.info.kind));
  const outras = enriched.filter((e) => e.info.kind === "outra");

  const grupoCurtas = [...curtas, ...outras];
  const visibleLongas = showAll ? longas : longas.slice(0, 2);
  const visibleCurtas = showAll ? grupoCurtas : grupoCurtas.slice(0, 4);
  const overflow = longas.length + grupoCurtas.length - (visibleLongas.length + visibleCurtas.length);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {/* Top HUD strip */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-cyan-300">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700">
              Bancada Tática
            </div>
            <div className="text-[10px] text-slate-400">Arsenal interpretado a partir do seu cadastro</div>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            STATUS · ATIVO
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {enriched.length} ITEM(S)
          </div>
        </div>
      </div>

      {/* Bench body */}
      <div
        className="relative px-4 py-6 md:px-8 md:py-8"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(15,23,42,0.04), transparent 60%), linear-gradient(180deg, #fafafa, #f3f4f6)",
        }}
      >
        {/* grid lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-slate-300" />
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-slate-600">
                NENHUMA ARMA NO ACERVO
              </div>
              <p className="mt-1 max-w-sm text-[11px] text-slate-500">
                Cadastre seus CRAFs para que o sistema monte automaticamente sua bancada.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative space-y-4">
            {visibleLongas.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleLongas.map(({ w, info }) => (
                  <WeaponCard
                    key={`${w.source}-${w.id}`}
                    w={w}
                    info={info}
                    onClick={() => onSelectWeapon(w, info)}
                    size="lg"
                  />
                ))}
              </div>
            )}

            {visibleCurtas.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCurtas.map(({ w, info }) => (
                  <WeaponCard
                    key={`${w.source}-${w.id}`}
                    w={w}
                    info={info}
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
                  className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm hover:border-slate-400"
                >
                  Ver todos ({overflow} +)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Caixas de munição + cartões de documento (rodapé da bancada) */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Munições · Por Calibre
              </div>
            </div>
            {ammoByCalibre.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-[11px] text-slate-400">
                Nenhuma munição cadastrada
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ammoByCalibre.slice(0, 6).map((a) => (
                  <div
                    key={a.calibre}
                    className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      {a.calibre}
                    </div>
                    <div className="mt-0.5 font-mono text-[15px] font-bold text-slate-800">
                      {a.quantidade.toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600"
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
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Documentos na Bancada
              </div>
            </div>
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-[11px] text-slate-400">
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