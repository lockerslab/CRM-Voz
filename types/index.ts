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
  cold_lead: "Lead frío",
  contacted: "Contactado",
  meeting: "Reunión",
  negotiation: "Negociación",
  won: "Ganado",
  lost: "Perdido",
};

export type Profile = {
  id: string;
  full_name: string | null;
  timezone: string;
  created_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: PipelineStage;
  channels: string[];
  product_interest: string | null;
  position: number;
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
  extracted_json: NoteProposal | null;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  contact_id: string | null;
  title: string;
  due_date: string | null;
  completed: boolean;
  notified: boolean;
  created_at: string;
};

/** Structured CRM proposal returned by /api/process-note (not persisted). */
export type NoteProposal = {
  action: "create" | "update";
  contact_id: string | null;
  contact_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: PipelineStage | null;
  channels: string[];
  product_interest: string | null;
  summary: string | null;
  task_title: string | null;
  /** ISO 8601 with offset, e.g. 2026-11-20T10:00:00-03:00 */
  due_at: string | null;
  missing: string[];
};

export type TranscribeResponse = {
  transcript: string;
  audioPath: string;
  stub?: boolean;
};

export type ProcessNoteResponse = {
  proposal: NoteProposal;
  audioPath: string;
  transcript: string;
  stub?: boolean;
};

export type SaveNotePayload = {
  action: "create" | "update";
  contact_id: string | null;
  contact_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: PipelineStage;
  channels: string[];
  product_interest: string | null;
  notes: string | null;
  summary: string | null;
  transcript: string;
  audioPath: string;
  task_title: string | null;
  due_at: string | null;
};

/** @deprecated Prefer NoteProposal */
export type ExtractedNote = NoteProposal;
