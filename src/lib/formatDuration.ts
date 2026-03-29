/**
 * Formata duração em milissegundos para string legível.
 * Exemplos: "450ms", "45s", "1m 05s", "1h 02m 08s"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "—";

  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}
