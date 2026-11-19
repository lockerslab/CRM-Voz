import { NextResponse } from "next/server";
import {
  ExtractionValidationError,
  extractNoteData,
} from "@/lib/ai/extractData";
import { createClient } from "@/lib/supabase/server";
import type { ProcessNoteResponse } from "@/types";

export const runtime = "nodejs";

type ProcessNoteBody = {
  transcript?: string;
  audioPath?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: ProcessNoteBody;
  try {
    body = (await request.json()) as ProcessNoteBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  const audioPath = body.audioPath?.trim();

  if (!transcript) {
    return NextResponse.json(
      { error: "transcript es obligatorio" },
      { status: 400 },
    );
  }
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

  const [{ data: profile }, { data: contacts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, company")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  const timezone =
    (profile as { timezone?: string } | null)?.timezone ??
    "America/Argentina/Buenos_Aires";

  try {
    const { proposal, stub } = await extractNoteData(transcript, {
      timezone,
      contacts: (contacts ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        company: (c.company as string | null) ?? null,
      })),
    });

    const response: ProcessNoteResponse = {
      proposal,
      audioPath,
      transcript,
      stub,
    };

    // Endpoint does NOT persist — only returns the proposal.
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ExtractionValidationError) {
      return NextResponse.json(
        {
          error:
            "No pude interpretar la nota de voz. Probá de nuevo o completá los datos a mano.",
          detail: error.message,
        },
        { status: 422 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Falló el procesamiento";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
