import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Interaction, Task } from "@/types";
import { PIPELINE_STAGE_COLORS, PIPELINE_STAGE_LABELS } from "@/types";
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

  const stageColors = PIPELINE_STAGE_COLORS[typedContact.stage];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="transition-all duration-200"
          render={<Link href="/dashboard" />}
        >
          ← Pipeline
        </Button>
        <Badge className={`border-0 ${stageColors.chip}`}>
          {PIPELINE_STAGE_LABELS[typedContact.stage]}
        </Badge>
      </div>

      <header className="space-y-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {typedContact.name}
        </h1>
        {typedContact.company ? (
          <p className="text-slate-500">{typedContact.company}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2 text-sm text-slate-500">
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
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {typedContact.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">
          Agregar nota de voz
        </h2>
        <VoiceRecorder contacts={(allContacts as Contact[]) ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Tareas</h2>
        <TaskList tasks={(tasks as Task[]) ?? []} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Interacciones</h2>
        <ul className="space-y-2">
          {((interactions as Interaction[]) ?? []).map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant="outline">{item.type}</Badge>
                <time className="text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleString("es-AR")}
                </time>
              </div>
              {item.extracted_json?.summary ? (
                <p className="mb-1 text-sm font-medium text-slate-800">
                  {item.extracted_json.summary}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-slate-500">
                {item.transcript ?? "Sin transcripción"}
              </p>
            </li>
          ))}
          {(interactions ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
              <MessageSquare className="size-6 text-slate-300" />
              <p className="text-sm text-slate-400">
                Todavía no hay interacciones.
              </p>
            </div>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
