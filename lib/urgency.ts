// Urgencia de una tarea: qué tan cerca (o pasada) está su vencimiento.
// Todo se calcula en la zona horaria del usuario, no en la del servidor.

import { DEFAULT_TIMEZONE, formatDue, todayInTimezone, type YMD } from "@/lib/dates";

export type Urgency = "overdue" | "today" | "tomorrow" | "soon" | "later" | "none";

export const URGENCY_ORDER: Urgency[] = [
  "overdue",
  "today",
  "tomorrow",
  "soon",
  "later",
  "none",
];

function dayNumber(d: YMD): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86_400_000);
}

export function getUrgency(
  due: string | null | undefined,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): Urgency {
  if (!due) return "none";
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return "none";

  const diff =
    dayNumber(todayInTimezone(dueDate, timeZone)) -
    dayNumber(todayInTimezone(now, timeZone));

  if (diff < 0) return "overdue";
  if (diff === 0) return dueDate.getTime() < now.getTime() ? "overdue" : "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "soon";
  return "later";
}

function clock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * Texto para el chip: "Atrasada · jue 19 nov", "Hoy 17:00", "Mañana 10:00", "jue 26 nov, 16:00".
 * Con short=true (espacios chicos, como las tarjetas del pipeline): "Atrasada", "Hoy 17:00",
 * "Mañana 10:00", "26 nov · 16:00".
 */
export function urgencyLabel(
  due: string | null | undefined,
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
  short = false,
): string {
  const u = getUrgency(due, now, timeZone);
  if (u === "none" || !due) return "Sin fecha";
  const d = new Date(due);
  if (short) {
    if (u === "overdue") return "Atrasada";
    if (u === "today") return `Hoy ${clock(d, timeZone)}`;
    if (u === "tomorrow") return `Mañana ${clock(d, timeZone)}`;
    const day = new Intl.DateTimeFormat("es-AR", { timeZone, day: "numeric", month: "short" })
      .format(d)
      .replace(/\./g, "");
    return `${day} · ${clock(d, timeZone)}`;
  }
  if (u === "overdue") {
    const sameDay =
      dayNumber(todayInTimezone(d, timeZone)) === dayNumber(todayInTimezone(now, timeZone));
    return sameDay ? `Atrasada · ${clock(d, timeZone)}` : `Atrasada · ${formatDue(d, timeZone).split(",")[0]}`;
  }
  if (u === "today") return `Hoy ${clock(d, timeZone)}`;
  if (u === "tomorrow") return `Mañana ${clock(d, timeZone)}`;
  return formatDue(d, timeZone);
}

type Dated = { due_date: string | null };

/** Más urgentes primero; dentro de cada grupo, por fecha. */
export function sortByUrgency<T extends Dated>(
  tasks: T[],
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): T[] {
  const rank = (t: T) => URGENCY_ORDER.indexOf(getUrgency(t.due_date, now, timeZone));
  return [...tasks].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (!a.due_date || !b.due_date) return 0;
    return a.due_date.localeCompare(b.due_date);
  });
}

export type TaskGroupKey = "overdue" | "today" | "upcoming" | "none";

export const TASK_GROUP_TITLES: Record<TaskGroupKey, string> = {
  overdue: "Atrasadas",
  today: "Hoy",
  upcoming: "Próximas",
  none: "Sin fecha",
};

export function groupKey(u: Urgency): TaskGroupKey {
  if (u === "overdue") return "overdue";
  if (u === "today") return "today";
  if (u === "none") return "none";
  return "upcoming";
}

/** Agrupa las tareas (ya ordenadas) en Atrasadas / Hoy / Próximas / Sin fecha. */
export function groupTasks<T extends Dated>(
  tasks: T[],
  now: Date,
  timeZone: string = DEFAULT_TIMEZONE,
): { key: TaskGroupKey; title: string; tasks: T[] }[] {
  const sorted = sortByUrgency(tasks, now, timeZone);
  const buckets: Record<TaskGroupKey, T[]> = { overdue: [], today: [], upcoming: [], none: [] };
  for (const t of sorted) buckets[groupKey(getUrgency(t.due_date, now, timeZone))].push(t);
  return (Object.keys(buckets) as TaskGroupKey[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, title: TASK_GROUP_TITLES[k], tasks: buckets[k] }));
}
