import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Contact, PipelineStage, SaveNotePayload } from "@/types";
import { PIPELINE_STAGES } from "@/types";

export const runtime = "nodejs";

function isStage(value: unknown): value is PipelineStage {
  return (
    typeof value === "string" &&
    (PIPELINE_STAGES as readonly string[]).includes(value)
  );
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
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

  const contactName = body.contact_name?.trim() ?? "";
  const isUpdate = body.action === "update" && Boolean(body.contact_id);

  if (!isUpdate && !contactName) {
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

  let contactId = body.contact_id;
  let resolvedStage: PipelineStage | null = isStage(body.stage)
    ? body.stage
    : null;

  if (isUpdate && contactId) {
    const { data: existing, error: existingError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: existingError?.message ?? "Contacto no encontrado" },
        { status: 404 },
      );
    }

    const current = existing as Contact;
    // Invalid stage → keep current; never fall back to cold_lead.
    if (!resolvedStage) {
      resolvedStage = current.stage;
    }

    const patch: Record<string, unknown> = {};
    if (contactName) patch.name = contactName;
    if (!isEmpty(body.company)) patch.company = body.company;
    if (!isEmpty(body.email)) patch.email = body.email;
    if (!isEmpty(body.phone)) patch.phone = body.phone;
    if (isStage(body.stage)) patch.stage = body.stage;
    if (!isEmpty(body.channels)) patch.channels = body.channels;
    if (!isEmpty(body.product_interest)) {
      patch.product_interest = body.product_interest;
    }
    if (!isEmpty(body.notes)) patch.notes = body.notes;

    if (Object.keys(patch).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from("contacts")
        .update(patch)
        .eq("id", contactId)
        .eq("user_id", user.id)
        .select("id")
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          {
            error: updateError?.message ?? "No se pudo actualizar el contacto",
          },
          { status: 400 },
        );
      }
      contactId = updated.id as string;
    }
  } else {
    const stage: PipelineStage = resolvedStage ?? "cold_lead";
    resolvedStage = stage;
    const channels = Array.isArray(body.channels) ? body.channels : [];

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

  const channelsForJson = Array.isArray(body.channels) ? body.channels : [];

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
        channels: channelsForJson,
        product_interest: body.product_interest,
        stage: resolvedStage,
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
