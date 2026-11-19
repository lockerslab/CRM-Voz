// Whisper, cuando no hay voz (silencio, ruido, música), suele "alucinar" frases
// típicas de sus datos de entrenamiento. Las detectamos para no crear contactos fantasma.

export const NO_SPEECH_MESSAGE =
  "No te escuché bien 🎤 Probá de nuevo: hablá cerca del micrófono y en un lugar sin mucho ruido.";

const HALLUCINATIONS: RegExp[] = [
  /amara\.org/i,
  /subt[ií]tulos?\s+(realizados?|por|de)/i,
  /subtitulado\s+por/i,
  /gracias\s+por\s+(ver|mirar|su\s+atenci[oó]n)/i,
  /suscr[ií]b(e|ite|ete)\s+(al|a\s+(mi|nuestro))\s+canal/i,
  /no\s+olvid(es|en)\s+suscribir/i,
  /^\s*(m[uú]sica|music|aplausos|applause)\s*$/i,
  /^\s*\[.*\]\s*$/, // "[Música]", "[Silencio]"
];

export type TranscriptCheck =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "too_short" | "hallucination" };

export function checkTranscript(raw: string | null | undefined): TranscriptCheck {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };

  if (HALLUCINATIONS.some((re) => re.test(text))) {
    return { ok: false, reason: "hallucination" };
  }

  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length < 2) return { ok: false, reason: "too_short" };

  return { ok: true, text };
}
