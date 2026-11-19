import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Task } from "@/types";
import Link from "next/link";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 p-6 pb-28 md:pb-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">CRM por voz</p>
          <h1 className="text-2xl font-semibold tracking-tight">crm-voz</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="outline" size="sm" render={<Link href="/login" />}>
            Cuenta
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Pipeline</h2>
        <PipelineBoard initialContacts={contactList} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="hidden space-y-3 md:block">
          <h2 className="text-lg font-medium">Nota de voz</h2>
          <VoiceRecorder contacts={contactList} />
          <p className="text-xs text-muted-foreground">
            Grabá hasta 3 minutos. Se sube a Storage, se transcribe y revisás
            los datos antes de guardar.
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Tareas abiertas</h2>
          <TaskList tasks={(tasks as Task[]) ?? []} />
        </div>
      </section>

      {/* Large fixed record button on small screens */}
      <VoiceRecorder contacts={contactList} floating />
    </main>
  );
}
