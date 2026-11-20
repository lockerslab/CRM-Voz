"use client";

import { NoteReviewSheet } from "@/components/voice/NoteReviewSheet";
import type { Contact, NoteProposal, ProcessNoteResponse, TranscribeResponse } from "@/types";
import { Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { buildTimingReport } from "@/lib/timing";
import { createClient } from "@/lib/supabase/client";

const MAX_SECONDS = 180;

type VoiceRecorderProps = {
  contacts?: Contact[];
  /** Botón flotante para el celular */
  floating?: boolean;
  /** "hero": tarjeta grande y protagonista (compu). "compact": versión chica (ficha de contacto). */
  layout?: "hero" | "compact";
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

function formatElapsed(elapsed: number): string {
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  contacts = [],
  floating = false,
  layout = "compact",
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
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [timingReport, setTimingReport] = useState<string[] | null>(null);
  const router = useRouter();

  // Al guardar: refrescar los datos del servidor (tareas, lista de contactos,
  // interacciones). Los contactos nuevos llegan por Realtime, pero las tareas no.
  const handleSaved = useCallback(() => {
    router.refresh();
    onSaved?.();
  }, [router, onSaved]);

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
    setTimingReport(null);
    const tStart = performance.now();

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
      const uploadMs = performance.now() - tStart;

      setStatus("Transcribiendo…");
      const tTranscribe = performance.now();
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: path }),
      });
      const transcribeJson = (await transcribeRes.json()) as TranscribeResponse & {
        error?: string;
        code?: string;
      };
      if (!transcribeRes.ok) {
        if (transcribeJson.code === "no_speech") {
          // Audio sin voz: no lo dejamos ocupando lugar en Storage.
          await supabase.storage.from("audio").remove([path]);
        }
        throw new Error(transcribeJson.error ?? "Falló la transcripción");
      }
      const transcribeMs = performance.now() - tTranscribe;

      setStatus("Extrayendo datos…");
      const tProcess = performance.now();
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
        code?: string;
      };
      if (!processRes.ok) {
        if (processJson.code === "empty_note") {
          await supabase.storage.from("audio").remove([path]);
        }
        throw new Error(processJson.error ?? "Falló el procesamiento");
      }
      const processMs = performance.now() - tProcess;

      // Medidor de tiempos: solo si la dirección termina en ?debug=1
      if (new URLSearchParams(window.location.search).has("debug")) {
        const report = buildTimingReport({
          upload_ms: uploadMs,
          transcribe_total_ms: transcribeMs,
          process_total_ms: processMs,
          transcribe: transcribeJson.timing,
          process: processJson.timing,
        });
        setTimingReport(report);
        console.info("[crm-voz] tiempos\n" + report.join("\n"));
      }

      setAudioPath(path);
      setTranscript(transcribeJson.transcript);
      setTimezone(processJson.timezone ?? DEFAULT_TIMEZONE);
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
        if (elapsedRef.current < 1) {
          cleanupStream();
          setError("Fue muy cortito 🙂 Mantené apretado y contame la nota completa.");
          return;
        }
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
  const elapsedLabel = formatElapsed(elapsed);

  const sheet = (
    <NoteReviewSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      proposal={proposal}
      transcript={transcript}
      audioPath={audioPath}
      contacts={contacts}
      timezone={timezone}
      onSaved={handleSaved}
    />
  );

  const micIcon = recording ? (
    <Square className="size-1/3 fill-current" />
  ) : (
    <Mic className="size-2/5" />
  );

  const recAria = recording ? "Detener grabación" : "Grabar nota de voz";
  const onRecClick = () => {
    if (recording) stopRecording();
    else void startRecording();
  };

  const statusText = busy
    ? status ?? "Procesando…"
    : recording
      ? `Grabando · ${elapsedLabel}`
      : null;

  const feedback = (
    <>
      {error ? (
        <p className="surface px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {timingReport ? (
        <pre className="surface whitespace-pre-wrap p-3 text-xs leading-relaxed text-muted-foreground">
          {timingReport.join("\n")}
        </pre>
      ) : null}
    </>
  );

  /* ---------- Celular: botón flotante ---------- */
  if (floating) {
    return (
      <>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="pointer-events-auto flex max-w-[92vw] flex-col items-center gap-2.5">
            {recording ? (
              <div className="surface flex items-center gap-3 px-4 py-2 text-primary">
                <span className="eq" aria-hidden>
                  <span /><span /><span /><span /><span />
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {elapsedLabel}
                  <span className="ml-1 font-medium text-muted-foreground">/ {formatElapsed(MAX_SECONDS)}</span>
                </span>
              </div>
            ) : null}
            {busy && status ? (
              <p className="surface px-4 py-2 text-sm font-semibold text-foreground">{status}</p>
            ) : null}
            {error ? (
              <p className="surface px-4 py-2 text-center text-sm font-medium text-destructive">{error}</p>
            ) : null}
            {timingReport ? (
              <pre className="surface max-w-[92vw] whitespace-pre-wrap p-2.5 text-[10px] leading-snug text-muted-foreground">
                {timingReport.join("\n")}
              </pre>
            ) : null}
            <button
              type="button"
              disabled={busy}
              data-recording={recording}
              className="rec-btn size-[76px]"
              onClick={onRecClick}
              aria-label={recAria}
            >
              {micIcon}
            </button>
          </div>
        </div>
        {sheet}
      </>
    );
  }

  /* ---------- Compu: tarjeta héroe ---------- */
  if (layout === "hero") {
    return (
      <div className="hero-card relative flex flex-col justify-between gap-6 overflow-hidden p-6 sm:p-7">
        <div
          className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold opacity-90">Nota de voz</p>
          <h2 className="display mt-1 text-[1.7rem] leading-tight">Contame cómo te fue</h2>
          <p className="mt-1.5 max-w-sm text-sm opacity-90">
            Hablá como si le escribieras a un colega. Yo cargo el contacto y la tarea.
          </p>
        </div>

        <div className="relative flex items-center gap-5">
          <button
            type="button"
            disabled={busy}
            data-recording={recording}
            className="rec-btn size-24"
            onClick={onRecClick}
            aria-label={recAria}
          >
            {micIcon}
          </button>
          <div className="min-w-0 space-y-1">
            {recording ? (
              <>
                <span className="eq" aria-hidden>
                  <span /><span /><span /><span /><span />
                </span>
                <p className="text-sm font-bold tabular-nums">
                  {elapsedLabel}{" "}
                  <span className="font-medium opacity-80">· quedan {countdown}</span>
                </p>
                <p className="text-xs opacity-90">Tocá el botón para terminar</p>
              </>
            ) : statusText ? (
              <p className="text-sm font-bold">{statusText}</p>
            ) : (
              <>
                <p className="text-sm font-bold">Tocá para grabar</p>
                <p className="text-xs opacity-90">Hasta 3 minutos por nota</p>
              </>
            )}
          </div>
        </div>

        {error || timingReport ? <div className="relative space-y-2">{feedback}</div> : null}
        {sheet}
      </div>
    );
  }

  /* ---------- Compacto: ficha de contacto ---------- */
  return (
    <div className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          data-recording={recording}
          className="rec-btn size-14"
          onClick={onRecClick}
          aria-label={recAria}
        >
          {micIcon}
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {recording ? `Grabando · ${elapsedLabel}` : busy ? status ?? "Procesando…" : "Agregar una nota de voz"}
          </p>
          <p className="text-xs text-muted-foreground">
            {recording ? `Quedan ${countdown} · tocá para terminar` : "Contame cómo siguió con esta persona"}
          </p>
        </div>
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      {timingReport ? (
        <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
          {timingReport.join("\n")}
        </pre>
      ) : null}
      {sheet}
    </div>
  );
}
