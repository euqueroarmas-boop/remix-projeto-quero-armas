import { useState, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Shield, AlertTriangle, Zap } from "lucide-react";

interface Props {
  onRelease: (value: number) => void;
}

const ZONES = [
  { max: 20, label: "Estável", color: "from-emerald-500 to-emerald-400", text: "text-emerald-400", icon: Shield, bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "shadow-emerald-500/20" },
  { max: 40, label: "Sensível", color: "from-yellow-500 to-yellow-400", text: "text-yellow-400", icon: AlertTriangle, bg: "bg-yellow-500/10", border: "border-yellow-500/20", glow: "shadow-yellow-500/20" },
  { max: 60, label: "Atenção", color: "from-orange-500 to-orange-400", text: "text-orange-400", icon: Flame, bg: "bg-orange-500/10", border: "border-orange-500/20", glow: "shadow-orange-500/20" },
  { max: 80, label: "Tensão Alta", color: "from-red-500 to-red-400", text: "text-red-400", icon: Zap, bg: "bg-red-500/10", border: "border-red-500/20", glow: "shadow-red-500/20" },
  { max: 100, label: "🔴 BRIGA", color: "from-red-700 to-red-500", text: "text-red-500", icon: Zap, bg: "bg-red-500/15", border: "border-red-500/40", glow: "shadow-red-500/40" },
];

function getZone(v: number) {
  return ZONES.find(z => v <= z.max) || ZONES[ZONES.length - 1];
}

function getGradientColor(v: number): string {
  if (v <= 20) return "hsl(152, 69%, 45%)";
  if (v <= 40) return "hsl(45, 93%, 55%)";
  if (v <= 60) return "hsl(25, 95%, 53%)";
  if (v <= 80) return "hsl(0, 72%, 51%)";
  return "hsl(0, 72%, 35%)";
}

export default function StressThermometer({ onRelease }: Props) {
  const [value, setValue] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const zone = useMemo(() => getZone(value), [value]);
  const ZoneIcon = zone.icon;
  const fillColor = getGradientColor(value);

  const calcValue = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, []);

  const handleStart = useCallback((clientY: number) => {
    setDragging(true);
    setValue(calcValue(clientY));
  }, [calcValue]);

  const handleMove = useCallback((clientY: number) => {
    if (!dragging) return;
    setValue(calcValue(clientY));
  }, [dragging, calcValue]);

  const handleEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    onRelease(value);
  }, [dragging, value, onRelease]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${zone.border} ${zone.bg} p-4 transition-all duration-300`}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 50% ${100 - value}%, ${fillColor}15 0%, transparent 70%)`,
          opacity: dragging ? 1 : 0.5,
        }}
      />

      <div className="relative flex gap-4 items-stretch">
        {/* Track */}
        <div className="relative flex flex-col items-center" style={{ width: 48 }}>
          <div
            ref={trackRef}
            className="relative w-3 rounded-full bg-border/50 overflow-hidden cursor-pointer touch-none select-none"
            style={{ height: 180 }}
            onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientY); }}
            onMouseMove={(e) => handleMove(e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => { e.preventDefault(); handleStart(e.touches[0].clientY); }}
            onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientY); }}
            onTouchEnd={handleEnd}
          >
            {/* Fill */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 rounded-full"
              style={{ background: fillColor }}
              animate={{ height: `${value}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            {/* Thumb */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-foreground/80 shadow-lg"
              style={{
                background: fillColor,
                boxShadow: dragging ? `0 0 12px 3px ${fillColor}80` : `0 0 6px 1px ${fillColor}40`,
              }}
              animate={{ bottom: `calc(${value}% - 10px)` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
          {/* Scale labels */}
          <div className="absolute left-[34px] top-0 bottom-0 flex flex-col justify-between py-0.5">
            {[100, 80, 60, 40, 20, 0].map(n => (
              <span key={n} className="text-[8px] font-mono text-muted-foreground/50 leading-none">{n}</span>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between py-1">
          {/* Value */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ZoneIcon className={`w-4 h-4 ${zone.text}`} />
              <span className={`text-xs font-mono font-bold uppercase tracking-wider ${zone.text}`}>
                {zone.label}
              </span>
            </div>
            <motion.div
              className="text-4xl font-mono font-extrabold text-foreground tabular-nums"
              key={value}
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.15 }}
            >
              {value}
            </motion.div>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              {dragging ? "Arraste para ajustar" : "Toque na barra para registrar"}
            </p>
          </div>

          {/* Zone bars */}
          <div className="flex gap-0.5 mt-3">
            {ZONES.map((z, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: value > (i === 0 ? 0 : ZONES[i - 1].max) ? fillColor : "hsl(var(--border))",
                  opacity: value > (i === 0 ? 0 : ZONES[i - 1].max) ? 1 : 0.3,
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
            {ZONES.map((z, i) => (
              <span
                key={i}
                className={`text-[8px] font-mono ${value <= z.max && value > (i === 0 ? -1 : ZONES[i - 1].max) ? z.text + " font-bold" : "text-muted-foreground/40"}`}
              >
                {i === 0 ? "0" : ZONES[i - 1].max + 1}–{z.max}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
