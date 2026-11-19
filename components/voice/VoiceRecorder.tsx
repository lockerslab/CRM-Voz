"use client";

import { NoteReviewSheet } from "@/components/voice/NoteReviewSheet";
import { Button } from "@/components/ui/button";
import type { Contact, NoteProposal, ProcessNoteResponse, TranscribeResponse } from "@/types";
import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_SECONDS = 180;

type VoiceRecorderProps = {
  contacts?: Contact[];
  /** Compact floating CTA for mobile dashboard */
  floating?: boolean;
  onSaved?: () => void;
};

function pickMimeType(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", ext: "webm" };
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", ext: "mp4" };
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return { mimeType: "audio/webm", ext: "webm" };
  }
  return { mimeType: "", ext: "webm" };
}

function formatCountdown(total: number, elapsed: number): string {
  const remaining = Math.max(0, total - elapsed);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  contacts = [],
  floating = false,
  onSaved,
}: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [proposal, setProposal] = useState<NoteProposal | null>(null);
  const [transcript, setTranscript] = useState("");
  const [audioPath, setAudioPath] = useState("");

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      clearTimer();
    };
  }, [cleanupStream, clearTimer]);

  async function processBlob(blob: Blob, ext: string) {
    setBusy(true);
    setError(null);
    setStatus("Subiendo audio…");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Tenés que iniciar sesión para grabar.");
      }

      const uuid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`;
      const path = `${user.id}/${uuid}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(path, blob, {
          contentType: blob.type || `audio/${ext}`,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setStatus("Transcribiendo…");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: path }),
      });
      const transcribeJson = (await transcribeRes.json()) as TranscribeResponse & {
        error?: string;
      };
      if (!transcribeRes.ok) {
        throw new Error(transcribeJson.error ?? "Falló la transcripción");
      }

      setStatus("Extrayendo datos…");
      const processRes = await fetch("/api/process-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcribeJson.transcript,
          audioPath: path,
        }),
      });
      const processJson = (await processRes.json()) as ProcessNoteResponse & {
        error?: string;
      };
      if (!processRes.ok) {
        throw new Error(processJson.error ?? "Falló el procesamiento");
      }

      setAudioPath(path);
      setTranscript(transcribeJson.transcript);
      setProposal(processJson.proposal);
      setSheetOpen(true);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar la nota");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError(null);
    setStatus(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite grabar audio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mimeType, ext } = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearTimer();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        cleanupStream();
        void processBlob(blob, ext);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      elapsedRef.current = 0;
      setElapsed(0);
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo acceder al micrófono.",
      );
      cleanupStream();
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
    clearTimer();
  }

  const countdown = formatCountdown(MAX_SECONDS, elapsed);

  if (floating) {
    return (
      <>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {recording ? (
              <p className="rounded-full bg-background/90 px-3 py-1 text-sm font-medium shadow ring-1 ring-border">
                {countdown}
              </p>
            ) : null}
            {busy && status ? (
              <p className="rounded-full bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow ring-1 ring-border">
                {status}
              </p>
            ) : null}
            {error ? (
              <p className="max-w-xs rounded-lg bg-destructive/10 px-3 py-1 text-center text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={busy}
              variant={recording ? "destructive" : "default"}
              className="h-16 w-16 rounded-full shadow-lg"
              onClick={() => {
                if (recording) stopRecording();
                else void startRecording();
              }}
              aria-label={recording ? "Detener grabación" : "Grabar nota de voz"}
            >
              {recording ? <Square className="size-6" /> : <Mic className="size-7" />}
            </Button>
          </div>
        </div>
        <NoteReviewSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          proposal={proposal}
          transcript={transcript}
          audioPath={audioPath}
          contacts={contacts}
          onSaved={() => onSaved?.()}
        />
      </>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void startRecording()}
          >
            <Mic className="size-4" />
            Grabar
          </Button>
        ) : (
          <Button type="button" variant="destructive" onClick={stopRecording}>
            <Square className="size-4" />
            Detener · {countdown}
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          {busy
            ? status ?? "Procesando…"
            : recording
              ? "Grabando… (máx. 3 min)"
              : "Listo para grabar"}
        </span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <NoteReviewSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        proposal={proposal}
        transcript={transcript}
        audioPath={audioPath}
        contacts={contacts}
        onSaved={() => onSaved?.()}
      />
    </div>
  );
}
