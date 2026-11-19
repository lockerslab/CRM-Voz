export const NOTE_EXTRACTION_SYSTEM_PROMPT = `You are a CRM assistant for crm-voz.
Extract structured CRM data from a voice-note transcript.
Return ONLY valid JSON matching this schema (no markdown):

{
  "contact_name": string | null,
  "company": string | null,
  "email": string | null,
  "phone": string | null,
  "stage": "cold_lead" | "contacted" | "meeting" | "negotiation" | "won" | "lost" | null,
  "summary": string | null,
  "task_title": string | null,
  "due_date": string | null,   // YYYY-MM-DD if known
  "due_time": string | null,   // HH:MM 24h if known
  "needs_datetime": boolean,   // true if a follow-up/task is implied but date or time is missing
  "raw_mentions": string[]
}

Rules:
- Prefer null over guessing.
- If the speaker mentions a follow-up, deadline, or meeting without a clear date, set needs_datetime=true and leave due_date/due_time null when unknown.
- If both a task intent and a complete due_date exist, set needs_datetime=false.
- Map pipeline language to stages (e.g. "cerramos" → won, "perdido" → lost).
- Keep summary concise (1–2 sentences).`;

export function buildNoteExtractionUserPrompt(transcript: string): string {
  return `Transcript:\n"""\n${transcript.trim()}\n"""\n\nExtract the JSON now.`;
}

export const EMPTY_EXTRACTED_NOTE = {
  contact_name: null,
  company: null,
  email: null,
  phone: null,
  stage: null,
  summary: null,
  task_title: null,
  due_date: null,
  due_time: null,
  needs_datetime: false,
  raw_mentions: [] as string[],
} as const;
