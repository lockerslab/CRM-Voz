import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Interaction, Task } from "@/types";
import { PIPELINE_STAGE_LABELS } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

type ContactPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactPage({ params }: ContactPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

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

  const [{ data: interactions }, { data: tasks }, { data: allContacts }] =
    await Promise.all([
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
      supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
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
          {typedContact.product_interest ? (
            <span>Interés: {typedContact.product_interest}</span>
          ) : null}
        </div>
        {typedContact.channels?.length ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {typedContact.channels.map((ch) => (
              <Badge key={ch} variant="outline" className="text-[10px]">
                {ch}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      {typedContact.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{typedContact.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Agregar nota de voz</h2>
        <VoiceRecorder contacts={(allContacts as Contact[]) ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tareas</h2>
        <TaskList tasks={(tasks as Task[]) ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Interacciones</h2>
        <ul className="space-y-2">
          {((interactions as Interaction[]) ?? []).map((item) => (
            <li key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline">{item.type}</Badge>
                <time className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("es-AR")}
                </time>
              </div>
              {item.extracted_json?.summary ? (
                <p className="mb-1 text-sm">{item.extracted_json.summary}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-muted-foreground">
                {item.transcript ?? "Sin transcripción"}
              </p>
            </li>
          ))}
          {(interactions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay interacciones.
            </p>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
