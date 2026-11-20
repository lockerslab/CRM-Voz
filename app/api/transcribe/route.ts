import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { TranscribeResponse } from "@/types";
import { NO_SPEECH_MESSAGE, checkTranscript } from "@/lib/ai/transcript";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type TranscribeBody = {
  audioPath?: string;
};

function extensionFromPath(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1]! : "webm";
}

function mimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mp4":
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "webm":
    default:
      return "audio/webm";
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: TranscribeBody;
  try {
    body = (await request.json()) as TranscribeBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const audioPath = body.audioPath?.trim();
  if (!audioPath) {
    return NextResponse.json(
      { error: "audioPath es obligatorio" },
      { status: 400 },
    );
  }

  if (!audioPath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "La ruta de audio no pertenece a tu usuario" },
      { status: 403 },
    );
  }

  const tDownload = performance.now();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("audio")
    .download(audioPath);
  const downloadMs = Math.round(performance.now() - tDownload);

  if (downloadError || !fileData) {
    return NextResponse.json(
      {
        error:
          downloadError?.message ??
          "No se pudo descargar el audio desde Storage",
      },
      { status: 404 },
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  const ext = extensionFromPath(audioPath);
  const file = new File([fileData], `audio.${ext}`, {
    type: mimeFromExt(ext),
  });

  if (!apiKey) {
    const stub: TranscribeResponse = {
      transcript:
        "[transcripción de prueba] Nota de voz recibida. Configurá GROQ_API_KEY para activar Whisper.",
      audioPath,
      stub: true,
    };
    return NextResponse.json(stub);
  }

  try {
    const groq = new Groq({ apiKey });
    const tWhisper = performance.now();
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "es",
      response_format: "json",
    });

    const whisperMs = Math.round(performance.now() - tWhisper);
    const check = checkTranscript(transcription.text);
    if (!check.ok) {
      // Silencio / ruido / "frase fantasma" de Whisper: no seguimos al paso de extracción.
      return NextResponse.json(
        { error: NO_SPEECH_MESSAGE, code: "no_speech" },
        { status: 422 },
      );
    }

    const response: TranscribeResponse = {
      transcript: check.text,
      audioPath,
      stub: false,
      timing: { download_ms: downloadMs, whisper_ms: whisperMs },
    };
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falló la transcripción";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
