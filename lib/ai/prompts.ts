import type { PipelineStage } from "@/types";

export type ContactBrief = {
  id: string;
  name: string;
  company: string | null;
};

export function formatNowInTimezone(timezone: string, date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

export function buildNoteExtractionSystemPrompt(params: {
  timezone: string;
  nowLabel: string;
  contacts: ContactBrief[];
  /** Tabla "0 → HOY jueves 19/11 …" de lib/dates.ts */
  calendar?: string;
}): string {
  const contactList =
    params.contacts.length === 0
      ? "(sin contactos existentes)"
      : params.contacts
          .map(
            (c) =>
              `- id=${c.id} | nombre=${c.name}${c.company ? ` | empresa=${c.company}` : ""}`,
          )
          .join("\n");

  return `Sos un asistente de CRM para crm-voz (español rioplatense).
Extraé datos estructurados de una nota de voz.
Respondé SOLO con JSON válido (sin markdown) con este esquema:

{
  "action": "create" | "update",
  "contact_id": string | null,
  "contact_name": string | null,
  "company": string | null,
  "email": string | null,
  "phone": string | null,
  "stage": "cold_lead" | "contacted" | "meeting" | "negotiation" | "won" | "lost" | null,
  "channels": string[],
  "product_interest": string | null,
  "summary": string | null,
  "task_title": string | null,
  "due": {
    "days_from_today": number | null,
    "day": number | null,
    "month": number | null,
    "time": string | null
  } | null,
  "missing": string[]
}

Contexto temporal:
- Fecha y hora actual: ${params.nowLabel}
- Zona horaria del usuario: ${params.timezone}

Calendario (el número de la izquierda es days_from_today):
${params.calendar ?? "(sin calendario)"}

Cómo completar "due" (NO calcules fechas: ELEGÍ de la tabla):
- Si la fecha dicha cae dentro de la tabla ("mañana", "el jueves", "el viernes que viene"), poné el número de esa fila en days_from_today y dejá day y month en null.
- Un día de la semana sin más ("el jueves") es la próxima fecha FUTURA con ese nombre; si hoy es ese día, es la de la semana que viene (usá la fila de 7).
- "la semana que viene" sin día = el mismo día de la semana, 7 días después.
- Si la fecha es posterior a la tabla y dicen día y mes ("el 25 de diciembre"), poné day=25, month=12 y days_from_today=null.
- time: hora local en formato 24 hs "HH:MM" ("a las cuatro de la tarde" → "16:00"; "a las 10" de la mañana → "10:00"). Si no dicen hora, time=null.
- Si no hay tarea o no hay forma de saber el día, due=null.

Contactos existentes del usuario:
${contactList}

Reglas:
- Preferí null antes que inventar datos.
- Si el contacto coincide con uno existente (nombre/empresa), usá action="update" y su contact_id.
- Si es un contacto nuevo, action="create" y contact_id=null.
- Si hay intención de tarea/seguimiento pero falta la fecha, due=null y agregá "due_at" en missing.
- channels: canales mencionados (whatsapp, email, teléfono, linkedin, etc.).
- product_interest: producto o servicio de interés si se menciona.
- stage: mapeá lenguaje de pipeline (ej. "cerramos" → won, "perdido" → lost, "lead frío" → cold_lead).
- summary: 1–2 oraciones en español rioplatense. NO incluyas fechas, días ni horas en el resumen (ya van en la tarea): contá qué pasó y qué necesita el contacto. Ejemplo correcto: "Tiene una prepaga y quiere cotizar un plan para toda la familia." Ejemplo incorrecto: "Hay que llamarla el jueves a las 16:00."
- missing: lista de campos importantes que faltan (contact_name, email, phone, due_at, etc.).`;
}

export function buildNoteExtractionUserPrompt(transcript: string): string {
  return `Transcripción:\n"""\n${transcript.trim()}\n"""\n\nDevolvé el JSON ahora.`;
}

export const EMPTY_NOTE_PROPOSAL = {
  action: "create" as const,
  contact_id: null,
  contact_name: null,
  company: null,
  email: null,
  phone: null,
  stage: null as PipelineStage | null,
  channels: [] as string[],
  product_interest: null,
  summary: null,
  task_title: null,
  due_at: null,
  missing: [] as string[],
};

/** @deprecated */
export const NOTE_EXTRACTION_SYSTEM_PROMPT = buildNoteExtractionSystemPrompt({
  timezone: "America/Argentina/Buenos_Aires",
  nowLabel: "(ver contexto de request)",
  contacts: [],
});

/** @deprecated */
export const EMPTY_EXTRACTED_NOTE = EMPTY_NOTE_PROPOSAL;
