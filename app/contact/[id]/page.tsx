import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Interaction, Task } from "@/types";
import { PIPELINE_STAGE_LABELS } from "@/types";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ContactPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!contact) {
    notFound();
  }

  const typedContact = contact as Contact;

  const [{ data: interactions }, { data: tasks }] = await Promise.all([
    supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("contact_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          ← Pipeline
        </Button>
        <Badge variant="secondary">
          {PIPELINE_STAGE_LABELS[typedContact.stage]}
        </Badge>
      </div>

      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {typedContact.name}
        </h1>
        {typedContact.company ? (
          <p className="text-muted-foreground">{typedContact.company}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2 text-sm text-muted-foreground">
          {typedContact.email ? <span>{typedContact.email}</span> : null}
          {typedContact.phone ? <span>{typedContact.phone}</span> : null}
        </div>
      </header>

      {typedContact.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{typedContact.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Add voice note</h2>
        <VoiceRecorder />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tasks</h2>
        <TaskList tasks={(tasks as Task[]) ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Interactions</h2>
        <ul className="space-y-2">
          {((interactions as Interaction[]) ?? []).map((item) => (
            <li key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline">{item.type}</Badge>
                <time className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {item.transcript ?? "No transcript"}
              </p>
            </li>
          ))}
          {(interactions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions yet.</p>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
