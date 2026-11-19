// Fechas de tareas: las calcula el CÓDIGO, no el modelo de IA.
// Sin dependencias (sirve en servidor y en el navegador).

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export type YMD = { year: number; month: number; day: number };

/** Lo que le pedimos al modelo: elegir de una tabla, nunca calcular. */
export type DueSpec = {
  /** 0 = hoy, 1 = mañana… (se elige de la tabla del calendario) */
  days_from_today: number | null;
  /** Para fechas lejanas dichas con día y mes ("el 25 de diciembre") */
  day: number | null;
  month: number | null;
  /** "HH:MM" en 24 hs, hora local del usuario */
  time: string | null;
};

const WEEKDAYS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const pad = (n: number) => String(n).padStart(2, "0");

function localParts(ms: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) {
    if (p.type !== "literal") o[p.type] = Number(p.value);
  }
  return {
    year: o.year!,
    month: o.month!,
    day: o.day!,
    hour: o.hour!,
    minute: o.minute!,
    second: o.second!,
  };
}

/** Diferencia (en minutos) entre la hora local de `timeZone` y UTC en ese instante. */
export function tzOffsetMinutes(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * Hora de pared en una zona horaria -> ISO 8601 con offset.
 * Ej: (2026,11,26,16,0,"America/Argentina/Buenos_Aires") -> "2026-11-26T16:00:00-03:00"
 */
export function zonedTimeToIso(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string,
): string {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let offset = tzOffsetMinutes(naive, timeZone);
  let utc = naive - offset * 60000;
  const offset2 = tzOffsetMinutes(utc, timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    utc = naive - offset * 60000;
  }
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${formatOffset(offset)}`;
}

/** Fecha de "hoy" en la zona del usuario. */
export function todayInTimezone(now: Date, timeZone: string): YMD {
  const p = localParts(now.getTime(), timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

export function addDays(ymd: YMD, n: number): YMD {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + n));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function weekdayEs(ymd: YMD): string {
  return WEEKDAYS_ES[new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay()]!;
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** Tabla "0 → hoy jueves 19/11" para que el modelo ELIJA una fila en vez de calcular. */
export function buildCalendarTable(now: Date, timeZone: string, days = 15): string {
  const today = todayInTimezone(now, timeZone);
  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const label = i === 0 ? "HOY " : i === 1 ? "MAÑANA " : "";
    lines.push(`${i} → ${label}${weekdayEs(d)} ${pad(d.day)}/${pad(d.month)}`);
  }
  return lines.join("\n");
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convierte lo que eligió el modelo en un ISO con offset.
 * Devuelve null si no hay datos suficientes, la fecha no existe o ya pasó.
 * Si hay fecha pero no hora, usa 09:00 (igual que la pantalla de revisión).
 */
export function resolveDue(
  spec: DueSpec | null | undefined,
  now: Date,
  timeZone: string,
): string | null {
  if (!spec) return null;
  const today = todayInTimezone(now, timeZone);

  let target: YMD | null = null;
  if (spec.day != null && spec.month != null) {
    // Primer año (este o los próximos) donde esa fecha existe y no pasó.
    // El rango de 5 años cubre el 29/02.
    for (let year = today.year; year <= today.year + 4; year++) {
      if (!isRealDate(year, spec.month, spec.day)) continue;
      const passed =
        spec.month < today.month ||
        (spec.month === today.month && spec.day < today.day);
      if (year === today.year && passed) continue;
      target = { year, month: spec.month, day: spec.day };
      break;
    }
  } else if (spec.days_from_today != null) {
    if (!Number.isInteger(spec.days_from_today)) return null;
    if (spec.days_from_today < 0 || spec.days_from_today > 366) return null;
    target = addDays(today, spec.days_from_today);
  }
  if (!target) return null;

  const timeMatch = TIME_RE.exec(spec.time ?? "09:00");
  if (!timeMatch) return null;

  const iso = zonedTimeToIso(
    target.year,
    target.month,
    target.day,
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    timeZone,
  );

  // Una tarea en el pasado casi seguro es un error: mejor pedirle la fecha al usuario.
  const FIVE_MIN = 5 * 60 * 1000;
  if (new Date(iso).getTime() < now.getTime() - FIVE_MIN) return null;

  return iso;
}
