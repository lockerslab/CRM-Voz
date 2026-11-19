import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Task } from "@/types";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: contacts }, { data: tasks }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Voice CRM</p>
          <h1 className="text-2xl font-semibold tracking-tight">crm-voz</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="outline" size="sm" render={<Link href="/login" />}>
            Account
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Pipeline</h2>
        <PipelineBoard initialContacts={(contacts as Contact[]) ?? []} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Voice note</h2>
          <VoiceRecorder />
          <p className="text-xs text-muted-foreground">
            Record audio, then POST the blob to{" "}
            <code className="rounded bg-muted px-1">/api/transcribe</code> and
            the transcript to{" "}
            <code className="rounded bg-muted px-1">/api/process-note</code>.
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Open tasks</h2>
          <TaskList tasks={(tasks as Task[]) ?? []} />
        </div>
      </section>
    </main>
  );
}
