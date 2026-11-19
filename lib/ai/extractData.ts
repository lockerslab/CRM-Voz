import Groq from "groq-sdk";
import type { ExtractedNote, PipelineStage } from "@/types";
import {
  EMPTY_EXTRACTED_NOTE,
  NOTE_EXTRACTION_SYSTEM_PROMPT,
  buildNoteExtractionUserPrompt,
} from "./prompts";

const VALID_STAGES = new Set<PipelineStage>([
  "cold_lead",
  "contacted",
  "meeting",
  "negotiation",
  "won",
  "lost",
]);

function normalizeExtracted(raw: Partial<ExtractedNote> | null | undefined): ExtractedNote {
  const stage =
    raw?.stage && VALID_STAGES.has(raw.stage as PipelineStage)
      ? (raw.stage as PipelineStage)
      : null;

  return {
    contact_name: raw?.contact_name ?? null,
    company: raw?.company ?? null,
    email: raw?.email ?? null,
    phone: raw?.phone ?? null,
    stage,
    summary: raw?.summary ?? null,
    task_title: raw?.task_title ?? null,
    due_date: raw?.due_date ?? null,
    due_time: raw?.due_time ?? null,
    needs_datetime: Boolean(raw?.needs_datetime),
    raw_mentions: Array.isArray(raw?.raw_mentions) ? raw.raw_mentions.map(String) : [],
  };
}

function stubExtract(transcript: string): ExtractedNote {
  const lower = transcript.toLowerCase();
  const mentionsFollowUp =
    /\b(follow[\s-]?up|llamar|reunión|reunion|meeting|mañana|tomorrow|próxima|proxima)\b/i.test(
      transcript,
    );
  const hasDate = /\b(20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/.test(transcript);

  return {
    ...EMPTY_EXTRACTED_NOTE,
    summary: transcript.slice(0, 240) || null,
    task_title: mentionsFollowUp ? "Follow up from voice note" : null,
    due_date: hasDate ? null : null,
    needs_datetime: mentionsFollowUp && !hasDate,
    raw_mentions: lower ? [transcript.slice(0, 80)] : [],
  };
}

export type ExtractResult = {
  extracted: ExtractedNote;
  stub: boolean;
};

export async function extractNoteData(transcript: string): Promise<ExtractResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return { extracted: stubExtract(transcript), stub: true };
  }

  const groq = new Groq({ apiKey });

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: NOTE_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: buildNoteExtractionUserPrompt(transcript) },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<ExtractedNote>;
    return { extracted: normalizeExtracted(parsed), stub: false };
  } catch {
    return { extracted: stubExtract(transcript), stub: true };
  }
}

/** Whether a task should be created from extraction. */
export function shouldCreateTask(extracted: ExtractedNote): boolean {
  return Boolean(extracted.task_title || extracted.due_date || extracted.needs_datetime);
}

/** True when UI should prompt the user to complete date/time. */
export function needsDatetimeModal(extracted: ExtractedNote): boolean {
  if (extracted.needs_datetime) return true;
  if (extracted.task_title && !extracted.due_date) return true;
  return false;
}
