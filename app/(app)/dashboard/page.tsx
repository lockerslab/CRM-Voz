import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Task } from "@/types";
import Link from "next/link";

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirects if unauthenticated; user is guaranteed here.
  if (!user) return null;

  const [{ data: contacts }, { data: tasks }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true }),
  ]);

  const contactList = (contacts as Contact[]) ?? [];
  const taskList = (tasks as Task[]) ?? [];
  const initials = initialsFromEmail(user.email);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-7 px-4 py-5 pb-32 sm:px-6 md:pb-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="text-xl font-bold tracking-tight text-slate-900 transition-all duration-200 hover:text-violet-700"
        >
          crm-voz
        </Link>
        <Link
          href="/login"
          title={user.email ?? "Cuenta"}
          className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800 shadow-sm ring-2 ring-white transition-all duration-200 hover:bg-violet-200 hover:shadow-md"
        >
          {initials}
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Pipeline</h2>
        <PipelineBoard initialContacts={contactList} tasks={taskList} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="hidden space-y-3 md:block">
          <h2 className="text-base font-semibold text-slate-800">Nota de voz</h2>
          <VoiceRecorder contacts={contactList} />
          <p className="text-xs text-slate-400">
            Grabá hasta 3 minutos. Se sube a Storage, se transcribe y revisás
            los datos antes de guardar.
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800">
            Tareas abiertas
          </h2>
          <TaskList tasks={taskList} />
        </div>
      </section>

      {/* Large fixed record button on small screens */}
      <VoiceRecorder contacts={contactList} floating />
    </main>
  );
}
