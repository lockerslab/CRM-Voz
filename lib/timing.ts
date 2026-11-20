// Medidor de tiempos de la nota de voz (solo se muestra con ?debug=1).
// Separa lo que tarda el SERVIDOR de lo que tarda la RED, para saber dónde optimizar.

/** Tiempos medidos dentro de /api/transcribe */
export type TranscribeTiming = { download_ms: number; whisper_ms: number };
/** Tiempos medidos dentro de /api/process-note */
export type ProcessTiming = { db_ms: number; llm_ms: number };

export type ClientTimings = {
  /** Subir el audio a Storage (desde el navegador) */
  upload_ms: number;
  /** Pedido completo a /api/transcribe, medido en el navegador */
  transcribe_total_ms: number;
  /** Pedido completo a /api/process-note, medido en el navegador */
  process_total_ms: number;
  transcribe?: TranscribeTiming;
  process?: ProcessTiming;
};

/** 1234 -> "1,2 s" (coma decimal, como en Argentina) */
export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1).replace(".", ",")} s`;
}

function stageLine(
  label: string,
  totalMs: number,
  parts: { name: string; ms: number }[] | null,
): string {
  if (!parts) return `${label}: ${formatSeconds(totalMs)}`;
  const server = parts.reduce((acc, p) => acc + p.ms, 0);
  const network = Math.max(0, totalMs - server);
  const detail = parts.map((p) => `${p.name} ${formatSeconds(p.ms)}`).join(" + ");
  return `${label}: ${formatSeconds(totalMs)}  (servidor: ${detail} · red y arranque: ${formatSeconds(network)})`;
}

/** Devuelve las líneas del reporte, listas para mostrar. */
export function buildTimingReport(t: ClientTimings): string[] {
  const total = t.upload_ms + t.transcribe_total_ms + t.process_total_ms;
  return [
    `Total desde "Detener": ${formatSeconds(total)}`,
    stageLine("1 · Subir audio", t.upload_ms, null),
    stageLine(
      "2 · Transcribir",
      t.transcribe_total_ms,
      t.transcribe
        ? [
            { name: "bajar audio", ms: t.transcribe.download_ms },
            { name: "Whisper", ms: t.transcribe.whisper_ms },
          ]
        : null,
    ),
    stageLine(
      "3 · Extraer datos",
      t.process_total_ms,
      t.process
        ? [
            { name: "base de datos", ms: t.process.db_ms },
            { name: "IA", ms: t.process.llm_ms },
          ]
        : null,
    ),
  ];
}
