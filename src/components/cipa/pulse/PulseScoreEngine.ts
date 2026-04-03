/**
 * CIPA Pulse — Score Engine (Phase 1)
 * Basic score calculation and status label mapping
 */

export type PulseStatusLabel = "calmo" | "atencao" | "tensao" | "critico" | "conflito";

export interface PulseZone {
  max: number;
  label: PulseStatusLabel;
  displayLabel: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export const PULSE_ZONES: PulseZone[] = [
  { max: 20, label: "calmo", displayLabel: "Calmo", color: "hsl(152, 69%, 45%)", textColor: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
  { max: 40, label: "atencao", displayLabel: "Atenção", color: "hsl(45, 93%, 55%)", textColor: "text-yellow-400", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20" },
  { max: 60, label: "tensao", displayLabel: "Tensão", color: "hsl(25, 95%, 53%)", textColor: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" },
  { max: 80, label: "critico", displayLabel: "Crítico", color: "hsl(0, 72%, 51%)", textColor: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" },
  { max: 100, label: "conflito", displayLabel: "Conflito", color: "hsl(0, 72%, 35%)", textColor: "text-red-500", bgColor: "bg-red-500/15", borderColor: "border-red-500/40" },
];

export function getZone(value: number): PulseZone {
  return PULSE_ZONES.find(z => value <= z.max) || PULSE_ZONES[PULSE_ZONES.length - 1];
}

export function getStatusLabel(value: number): PulseStatusLabel {
  return getZone(value).label;
}

export function calculateStressScore(manualLevel: number): number {
  return Math.max(0, Math.min(100, Math.round(manualLevel)));
}
