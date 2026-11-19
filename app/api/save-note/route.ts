import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PipelineStage, SaveNotePayload } from "@/types";
import { PIPELINE_STAGES } from "@/types";

export const runtime = "nodejs";

function isStage(value: unknown): value is PipelineStage {
  return (
    typeof value === "string" &&
    (PIPELINE_STAGES as readonly string[]).includes(value)
  );
}

export async function POST(request: Request) {
  // User Supabase client only — never service role for save-note.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: SaveNotePayload;
  try {
    body = (await request.json()) as SaveNotePayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const contactName = body.contact_name?.trim();
  if (!contactName) {
    return NextResponse.json(
      { error: "El nombre del contacto es obligatorio" },
      { status: 400 },
    );
  }

  if (!body.transcript?.trim() || !body.audioPath?.trim()) {
    return NextResponse.json(
      { error: "transcript y audioPath son obligatorios" },
      { status: 400 },
    );
  }

  if (!body.audioPath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "La ruta de audio no pertenece a tu usuario" },
      { status: 403 },
    );
  }

  if (body.task_title?.trim() && !body.due_at) {
    return NextResponse.json(
      {
        error:
          "La tarea tiene título pero falta la fecha. Completá la fecha antes de guardar.",
      },
      { status: 400 },
    );
  }

  const stage: PipelineStage = isStage(body.stage) ? body.stage : "cold_lead";
  const channels = Array.isArray(body.channels) ? body.channels : [];

  let contactId = body.contact_id;

  if (body.action === "update" && contactId) {
    const { data: updated, error: updateError } = await supabase
      .from("contacts")
      .update({
        name: contactName,
        company: body.company,
        email: body.email,
        phone: body.phone,
        stage,
        channels,
        product_interest: body.product_interest,
        notes: body.notes,
      })
      .eq("id", contactId)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "No se pudo actualizar el contacto" },
        { status: 400 },
      );
    }
    contactId = updated.id as string;
  } else {
    const { data: created, error: createError } = await supabase
      .from("contacts")
      .insert({
        user_id: user.id,
        name: contactName,
        company: body.company,
        email: body.email,
        phone: body.phone,
        stage,
        channels,
        product_interest: body.product_interest,
        notes: body.notes,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "No se pudo crear el contacto" },
        { status: 400 },
      );
    }
    contactId = created.id as string;
  }

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .insert({
      user_id: user.id,
      contact_id: contactId,
      type: "voice_note",
      transcript: body.transcript,
      audio_url: body.audioPath,
      extracted_json: {
        summary: body.summary,
        channels,
        product_interest: body.product_interest,
        stage,
        task_title: body.task_title,
        due_at: body.due_at,
      },
    })
    .select("id")
    .single();

  if (interactionError) {
    return NextResponse.json(
      { error: interactionError.message },
      { status: 400 },
    );
  }

  let taskId: string | null = null;
  if (body.task_title?.trim()) {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        contact_id: contactId,
        title: body.task_title.trim(),
        due_date: body.due_at,
        completed: false,
        notified: false,
      })
      .select("id")
      .single();

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 400 });
    }
    taskId = (task?.id as string) ?? null;
  }

  return NextResponse.json({
    contact_id: contactId,
    interaction_id: interaction?.id ?? null,
    task_id: taskId,
  });
}
