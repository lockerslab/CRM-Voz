import Groq from "groq-sdk";
import { z } from "zod";
import { buildCalendarTable, resolveDue } from "@/lib/dates";
import type { NoteProposal, PipelineStage } from "@/types";
import { PIPELINE_STAGES } from "@/types";
import {
  EMPTY_NOTE_PROPOSAL,
  buildNoteExtractionSystemPrompt,
  buildNoteExtractionUserPrompt,
  formatNowInTimezone,
  type ContactBrief,
} from "./prompts";

const stageSchema = z.enum(
  PIPELINE_STAGES as unknown as [PipelineStage, ...PipelineStage[]],
);

/** Lo que devuelve el modelo: la fecha viene como "elección", no como ISO. */
const dueSpecSchema = z
  .object({
    days_from_today: z.number().int().min(0).max(366).nullable().catch(null),
    day: z.number().int().min(1).max(31).nullable().catch(null),
    month: z.number().int().min(1).max(12).nullable().catch(null),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .catch(null),
  })
  .nullable()
  .catch(null);

const llmNoteSchema = z.object({
  action: z.enum(["create", "update"]),
  contact_id: z.string().uuid().nullable().catch(null),
  contact_name: z.string().nullable().catch(null),
  company: z.string().nullable().catch(null),
  email: z.string().nullable().catch(null),
  phone: z.string().nullable().catch(null),
  stage: stageSchema.nullable().catch(null),
  channels: z.array(z.string()).catch([]),
  product_interest: z.string().nullable().catch(null),
  summary: z.string().nullable().catch(null),
  task_title: z.string().nullable().catch(null),
  due: dueSpecSchema,
  missing: z.array(z.string()).catch([]),
});

/** Modelo de chat de Groq. Se puede cambiar con GROQ_CHAT_MODEL sin tocar código. */
export const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b";

export type ExtractContext = {
  timezone: string;
  contacts: ContactBrief[];
  /** Solo para tests: reloj fijo. */
  now?: Date;
};

function stubExtract(transcript: string): NoteProposal {
  const mentionsFollowUp =
    /\b(follow[\s-]?up|llamar|llamá|reunión|reunion|meeting|mañana|tomorrow|próxima|proxima|seguimiento)\b/i.test(
      transcript,
    );

  return {
    ...EMPTY_NOTE_PROPOSAL,
    summary: transcript.slice(0, 240) || null,
    task_title: mentionsFollowUp ? "Seguimiento de nota de voz" : null,
    due_at: null,
    missing: mentionsFollowUp ? ["due_at"] : [],
  };
}

/**
 * Valida el JSON del modelo y arma la propuesta final.
 * La fecha (due_at) la calcula el código a partir de la elección del modelo.
 */
export function parseProposal(
  content: string,
  context: ExtractContext,
): NoteProposal {
  const llm = llmNoteSchema.parse(JSON.parse(content) as unknown);
  const now = context.now ?? new Date();

  const dueAt = resolveDue(llm.due, now, context.timezone);

  // Si el modelo inventó un contact_id que no es del usuario, lo descartamos.
  const knownContact =
    llm.contact_id != null &&
    context.contacts.some((c) => c.id === llm.contact_id);
  const action = llm.action === "update" && knownContact ? "update" : "create";

  const missing = new Set(llm.missing);
  if (llm.task_title && !dueAt) missing.add("due_at");
  if (dueAt) missing.delete("due_at");

  return {
    action,
    contact_id: action === "update" ? llm.contact_id : null,
    contact_name: llm.contact_name,
    company: llm.company,
    email: llm.email,
    phone: llm.phone,
    stage: llm.stage,
    channels: llm.channels,
    product_interest: llm.product_interest,
    summary: llm.summary,
    task_title: llm.task_title,
    due_at: dueAt,
    missing: [...missing],
  };
}

export type ExtractResult = {
  proposal: NoteProposal;
  stub: boolean;
};

export async function extractNoteData(
  transcript: string,
  context: ExtractContext,
): Promise<ExtractResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return { proposal: stubExtract(transcript), stub: true };
  }

  const groq = new Groq({ apiKey });
  const now = context.now ?? new Date();
  const system = buildNoteExtractionSystemPrompt({
    timezone: context.timezone,
    nowLabel: formatNowInTimezone(context.timezone, now),
    contacts: context.contacts,
    calendar: buildCalendarTable(now, context.timezone),
  });
  const user = buildNoteExtractionUserPrompt(transcript);

  async function once(): Promise<NoteProposal> {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_CHAT_MODEL || DEFAULT_CHAT_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    return parseProposal(content, context);
  }

  try {
    const proposal = await once();
    return { proposal, stub: false };
  } catch (firstError) {
    try {
      const proposal = await once();
      return { proposal, stub: false };
    } catch (secondError) {
      const message =
        secondError instanceof Error
          ? secondError.message
          : firstError instanceof Error
            ? firstError.message
            : "No se pudo validar la extracción";
      throw new ExtractionValidationError(message);
    }
  }
}

export class ExtractionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionValidationError";
  }
}

/** Whether a task should be created from a proposal. */
export function shouldCreateTask(proposal: NoteProposal): boolean {
  return Boolean(proposal.task_title || proposal.due_at);
}

/** True when UI should require date/time before save. */
export function needsDueAt(proposal: NoteProposal): boolean {
  if (proposal.task_title && !proposal.due_at) return true;
  if (proposal.missing.includes("due_at")) return true;
  return false;
}
