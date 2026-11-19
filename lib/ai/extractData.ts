import Groq from "groq-sdk";
import { z } from "zod";
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

export const noteProposalSchema = z.object({
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
  due_at: z.string().nullable().catch(null),
  missing: z.array(z.string()).catch([]),
});

export type ExtractContext = {
  timezone: string;
  contacts: ContactBrief[];
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

function parseProposal(content: string): NoteProposal {
  const parsed = JSON.parse(content) as unknown;
  return noteProposalSchema.parse(parsed);
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
  const nowLabel = formatNowInTimezone(context.timezone);
  const system = buildNoteExtractionSystemPrompt({
    timezone: context.timezone,
    nowLabel,
    contacts: context.contacts,
  });
  const user = buildNoteExtractionUserPrompt(transcript);

  async function once(): Promise<NoteProposal> {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    return parseProposal(content);
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
