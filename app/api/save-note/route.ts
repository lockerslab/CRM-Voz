import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PIPELINE_STAGES } from "@/types";

export const runtime = "nodejs";

const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const saveNoteSchema = z.object({
  action: z.enum(["create", "update"]),
  contact_id: z.string().uuid().nullish(),
  contact_name: optionalText,
  company: optionalText,
  email: optionalText,
  phone: optionalText,
  stage: z.enum(PIPELINE_STAGES).nullish(),
  channels: z.array(z.string()).max(20).catch([]),
  product_interest: optionalText,
  notes: optionalText,
  summary: optionalText,
  transcript: z.string().trim().min(1, "Falta la transcripción"),
  audioPath: z.string().trim().min(1, "Falta la ruta del audio"),
  task_title: optionalText,
  // ISO 8601 con offset, ej. 2026-11-20T10:00:00-03:00
  due_at: z
    .string()
    .datetime({ offset: true, message: "La fecha de la tarea no es válida" })
    .nullish(),
});

/** Traduce los errores de la función SQL save_note a mensajes para el usuario. */
function mapRpcError(error: { message: string; code?: string }): {
  message: string;
  status: number;
} {
  const raw = error.message ?? "";
  if (raw.includes("not_authenticated")) {
    return { message: "No autorizado", status: 401 };
  }
  if (raw.includes("audio_path_not_owned")) {
    return { message: "La ruta de audio no pertenece a tu usuario", status: 403 };
  }
  if (raw.includes("contact_not_found")) {
    return { message: "Contacto no encontrado", status: 404 };
  }
  if (raw.includes("contact_name_required")) {
    return { message: "El nombre del contacto es obligatorio", status: 400 };
  }
  if (raw.includes("due_at_required")) {
    return {
      message:
        "La tarea tiene título pero falta la fecha. Completá la fecha antes de guardar.",
      status: 400,
    };
  }
  if (raw.includes("transcript_and_audio_required")) {
    return { message: "transcript y audioPath son obligatorios", status: 400 };
  }
  return { message: "No se pudo guardar la nota. Probá de nuevo.", status: 500 };
}

export async function POST(request: Request) {
  // Cliente del usuario (con RLS) — nunca service role.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = saveNoteSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.action === "update" && !body.contact_id) {
    return NextResponse.json(
      { error: "Falta el contacto a actualizar" },
      { status: 400 },
    );
  }
  if (body.action === "create" && !body.contact_name) {
    return NextResponse.json(
      { error: "El nombre del contacto es obligatorio" },
      { status: 400 },
    );
  }
  if (!body.audioPath.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "La ruta de audio no pertenece a tu usuario" },
      { status: 403 },
    );
  }
  if (body.task_title && !body.due_at) {
    return NextResponse.json(
      {
        error:
          "La tarea tiene título pero falta la fecha. Completá la fecha antes de guardar.",
      },
      { status: 400 },
    );
  }

  // Todo o nada: contacto + interacción + tarea en una sola transacción.
  const { data, error } = await supabase.rpc("save_note", { p_note: body });

  if (error) {
    const mapped = mapRpcError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json(data);
}
