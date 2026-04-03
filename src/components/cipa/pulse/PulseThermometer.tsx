/**
 * CIPA Pulse — Thermometer (Phase 1)
 * Touch slider 0-100 with 5 zones
 */

import { useState, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, Flame, Zap, Skull } from "lucide-react";
import { PULSE_ZONES, getZone } from "./PulseScoreEngine";

interface Props {
  onRelease: (value: number) => void;
}

const ZONE_ICONS = [Shield, AlertTriangle, Flame, Zap, Skull];

export default function PulseThermometer({ onRelease }: Props) {
  const [value, setValue] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const zone = useMemo(() => getZone(value), [value]);
  const zoneIndex = PULSE_ZONES.indexOf(zone);
  const ZoneIcon = ZONE_ICONS[zoneIndex] || Shield;

  const calcValue = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    const raw = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    // Snap to 0 when near bottom — allows registering absolute calm
    return raw <= 3 ? 0 : raw;
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
    <div className={`relative overflow-hidden rounded-2xl border ${zone.borderColor} ${zone.bgColor} p-4 transition-all duration-300`}>
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at 50% ${100 - value}%, ${zone.color}15 0%, transparent 70%)`,
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
            <motion.div
              className="absolute bottom-0 left-0 right-0 rounded-full"
              style={{ background: zone.color }}
              animate={{ height: `${value}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-foreground/80 shadow-lg"
              style={{
                background: zone.color,
                boxShadow: dragging ? `0 0 12px 3px ${zone.color}80` : `0 0 6px 1px ${zone.color}40`,
              }}
              animate={{ bottom: `calc(${value}% - 10px)` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
          <div className="absolute left-[34px] top-0 bottom-0 flex flex-col justify-between py-0.5">
            {[100, 80, 60, 40, 20, 0].map(n => (
              <span key={n} className="text-[8px] font-mono text-muted-foreground/50 leading-none">{n}</span>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between py-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ZoneIcon className={`w-4 h-4 ${zone.textColor}`} />
              <span className={`text-xs font-mono font-bold uppercase tracking-wider ${zone.textColor}`}>
                {zone.displayLabel}
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
              {dragging ? "Arraste para ajustar" : value === 0 ? "Toque abaixo para registrar calmo" : "Toque na barra para registrar"}
            </p>
            {!dragging && value === 0 && (
              <button
                type="button"
                onClick={() => onRelease(0)}
                className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-colors"
                style={{ background: zone.color, color: "#fff" }}
              >
                ✓ Registrar Calmo
              </button>
            )}
          </div>

          {/* Zone bars */}
          <div className="flex gap-0.5 mt-3">
            {PULSE_ZONES.map((z, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: value > (i === 0 ? 0 : PULSE_ZONES[i - 1].max) ? zone.color : "hsl(var(--border))",
                  opacity: value > (i === 0 ? 0 : PULSE_ZONES[i - 1].max) ? 1 : 0.3,
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
            {PULSE_ZONES.map((z, i) => (
              <span
                key={i}
                className={`text-[8px] font-mono ${value <= z.max && value > (i === 0 ? -1 : PULSE_ZONES[i - 1].max) ? z.textColor + " font-bold" : "text-muted-foreground/40"}`}
              >
                {z.displayLabel}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
