export const PIPELINE_STAGES = [
  "cold_lead",
  "contacted",
  "meeting",
  "negotiation",
  "won",
  "lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  cold_lead: "Cold Lead",
  contacted: "Contacted",
  meeting: "Meeting",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: PipelineStage;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InteractionType =
  | "voice_note"
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "other";

export type Interaction = {
  id: string;
  user_id: string;
  contact_id: string;
  type: InteractionType;
  transcript: string | null;
  audio_url: string | null;
  extracted_json: ExtractedNote | null;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  contact_id: string | null;
  title: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
};

/** Structured payload returned by Groq note extraction. */
export type ExtractedNote = {
  contact_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: PipelineStage | null;
  summary: string | null;
  task_title: string | null;
  /** ISO date (YYYY-MM-DD) when a follow-up is due */
  due_date: string | null;
  /** Optional time (HH:MM) for meetings / reminders */
  due_time: string | null;
  /** True when the note implies a task but date/time is incomplete */
  needs_datetime: boolean;
  raw_mentions: string[];
};

export type TranscribeResponse = {
  transcript: string;
  stub?: boolean;
};

export type ProcessNoteResponse = {
  extracted: ExtractedNote;
  task: Task | null;
  needsDatetimeModal: boolean;
  stub?: boolean;
};
