"use client";

import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { useNow } from "@/lib/hooks/useNow";
import { getUrgency } from "@/lib/urgency";
import type { Contact, Task } from "@/types";
import { Mic } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

type DashboardViewProps = {
  contacts: Contact[];
  /** Tareas abiertas (no completadas) */
  tasks: Task[];
  initials: string;
  firstName: string | null;
  email?: string;
  /** Hora del servidor (ISO), para que servidor y navegador coincidan */
  nowIso: string;
  timezone?: string;
};

function greeting(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buen día";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardView({
  contacts,
  tasks,
  initials,
  firstName,
  email,
  nowIso,
  timezone = DEFAULT_TIMEZONE,
}: DashboardViewProps) {
  const now = useNow(nowIso);

  const contactNames = useMemo(
    () => Object.fromEntries(contacts.map((c) => [c.id, c.name])),
    [contacts],
  );

  const { overdue, today } = useMemo(() => {
    let overdue = 0;
    let today = 0;
    for (const t of tasks) {
      const u = getUrgency(t.due_date, now, timezone);
      if (u === "overdue") overdue += 1;
      else if (u === "today") today += 1;
    }
    return { overdue, today };
  }, [tasks, now, timezone]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 pt-5 pb-40 sm:px-6 md:pb-10">
      {/* Cabecera */}
      <header className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="hero-card flex size-10 items-center justify-center rounded-2xl">
            <Mic className="size-5" />
          </span>
          <span className="display text-xl text-foreground">crm-voz</span>
        </Link>
        <Link
          href="/login"
          title={email ?? "Cuenta"}
          className="surface flex size-11 items-center justify-center rounded-full text-sm font-extrabold text-primary"
        >
          {initials}
        </Link>
      </header>

      {/* Saludo + resumen del día */}
      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {greeting(now, timezone)}
            {firstName ? `, ${firstName}` : ""} 👋
          </p>
          <h1 className="display text-[1.65rem] leading-tight text-foreground sm:text-3xl">
            {overdue + today === 0
              ? "Hoy vas tranquilo"
              : `Tenés ${overdue + today} ${overdue + today === 1 ? "cosa" : "cosas"} para hoy`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {overdue > 0 ? (
            <span className="chip" style={{ background: "var(--u-overdue-bg)", color: "var(--u-overdue-fg)" }}>
              {overdue} {overdue === 1 ? "atrasada" : "atrasadas"}
            </span>
          ) : null}
          <span className="chip" style={{ background: "var(--u-today-bg)", color: "var(--u-today-fg)" }}>
            {today} para hoy
          </span>
          <span className="chip" style={{ background: "var(--u-later-bg)", color: "var(--u-later-fg)" }}>
            {contacts.length} {contacts.length === 1 ? "contacto" : "contactos"}
          </span>
        </div>
      </section>

      {/* Compu: grabar + tareas lado a lado. Celu: primero las tareas. */}
      <section className="grid gap-5 md:grid-cols-5">
        <div className="hidden md:col-span-2 md:block [&>*]:h-full">
          <VoiceRecorder contacts={contacts} layout="hero" />
        </div>
        <div className="space-y-3 md:col-span-3 md:max-h-[26rem] md:overflow-y-auto md:pr-1">
          <h2 className="display text-lg text-foreground">Tus tareas</h2>
          <TaskList
            tasks={tasks}
            now={now}
            timezone={timezone}
            contactNames={contactNames}
            previewLimit={2}
          />
        </div>
      </section>

      {/* Pipeline */}
      <section className="space-y-3">
        <h2 className="display text-lg text-foreground">Pipeline</h2>
        <PipelineBoard
          initialContacts={contacts}
          tasks={tasks}
          now={now}
          timezone={timezone}
        />
      </section>

      {/* Celu: botón de grabar flotante */}
      <VoiceRecorder contacts={contacts} floating />
    </main>
  );
}
