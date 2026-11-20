import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStamp } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Interaction, Task } from "@/types";
import { PIPELINE_STAGE_LABELS } from "@/types";
import { MessageSquare } from "lucide-react";
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
    <main
      data-stage={typedContact.stage}
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pt-5 pb-16 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="transition-all duration-200"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          ← Pipeline
        </Button>
        <span className="chip stage-chip px-3 py-1 text-sm">
          {PIPELINE_STAGE_LABELS[typedContact.stage]}
        </span>
      </div>

      <header className="surface relative space-y-1 overflow-hidden p-5">
        <span className="stage-solid absolute inset-y-0 left-0 w-1.5" aria-hidden />
        <h1 className="display pl-2 text-3xl text-foreground">
          {typedContact.name}
        </h1>
        {typedContact.company ? (
          <p className="pl-2 text-muted-foreground">{typedContact.company}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pl-2 pt-2 text-sm text-muted-foreground">
          {typedContact.email ? <span>{typedContact.email}</span> : null}
          {typedContact.phone ? <span>{typedContact.phone}</span> : null}
          {typedContact.product_interest ? (
            <span>Interés: {typedContact.product_interest}</span>
          ) : null}
        </div>
        {typedContact.channels?.length ? (
          <div className="flex flex-wrap gap-1 pl-2 pt-1">
            {typedContact.channels.map((ch) => (
              <Badge key={ch} variant="outline" className="text-[10px]">
                {ch}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      {typedContact.notes ? (
        <Card className="surface ring-0">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {typedContact.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="display text-lg text-foreground">
          Agregar nota de voz
        </h2>
        <VoiceRecorder contacts={(allContacts as Contact[]) ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="display text-lg text-foreground">Tareas</h2>
        <TaskList
          tasks={(tasks as Task[]) ?? []}
          now={new Date()}
          contactNames={{ [typedContact.id]: typedContact.name }}
          emptyText="Sin tareas para esta persona."
        />
      </section>

      <section className="space-y-3">
        <h2 className="display text-lg text-foreground">Interacciones</h2>
        <ul className="space-y-2">
          {((interactions as Interaction[]) ?? []).map((item) => (
            <li
              key={item.id}
              className="surface p-4 text-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline">{item.type}</Badge>
                <time className="text-xs text-muted-foreground">
                  {formatStamp(item.created_at)}
                </time>
              </div>
              {item.extracted_json?.summary ? (
                <p className="mb-1 text-sm font-semibold text-foreground">
                  {item.extracted_json.summary}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-muted-foreground">
                {item.transcript ?? "Sin transcripción"}
              </p>
            </li>
          ))}
          {(interactions ?? []).length === 0 ? (
            <div className="surface flex flex-col items-center gap-2 px-4 py-10 text-center">
              <MessageSquare className="size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Todavía no hay interacciones.
              </p>
            </div>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
