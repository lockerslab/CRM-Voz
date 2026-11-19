import { NextResponse } from "next/server";
import {
  extractNoteData,
  needsDatetimeModal,
  shouldCreateTask,
} from "@/lib/ai/extractData";
import { createClient } from "@/lib/supabase/server";
import type { ProcessNoteResponse, Task } from "@/types";

export const runtime = "nodejs";

type ProcessNoteBody = {
  transcript?: string;
  contact_id?: string | null;
};

function buildDueIso(dueDate: string, dueTime: string | null): string {
  return dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T09:00:00`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ProcessNoteBody;
  try {
    body = (await request.json()) as ProcessNoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const { extracted, stub } = await extractNoteData(transcript);
  const showModal = needsDatetimeModal(extracted);

  let task: Task | null = null;

  // Spec: if extract JSON has due_date → create task.
  // If date/time missing → return needsDatetimeModal for UI completion.
  if (extracted.due_date && shouldCreateTask(extracted)) {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        contact_id: body.contact_id ?? null,
        title: extracted.task_title ?? "Follow up",
        due_date: new Date(
          buildDueIso(extracted.due_date, extracted.due_time),
        ).toISOString(),
        completed: false,
      })
      .select("*")
      .single();

    if (!error && data) {
      task = data as Task;
    }
  }

  const response: ProcessNoteResponse = {
    extracted,
    task,
    needsDatetimeModal: showModal,
    stub,
  };

  return NextResponse.json(response);
}
