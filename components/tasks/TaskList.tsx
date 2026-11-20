"use client";

import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { getUrgency, groupTasks, urgencyLabel, type TaskGroupKey } from "@/lib/urgency";
import type { Task } from "@/types";
import { Check, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type TaskListProps = {
  tasks: Task[];
  /** "Ahora" estable (viene del servidor). Si falta, usa la hora del navegador. */
  now?: Date;
  timezone?: string;
  /** id de contacto -> nombre, para mostrar de quién es la tarea */
  contactNames?: Record<string, string>;
  /** Mensaje cuando no hay nada */
  emptyText?: string;
  /** Cuántas tareas mostrar en "Próximas" y "Sin fecha" antes de plegar (resto: "Ver N más") */
  previewLimit?: number;
};

const GROUP_TONE: Record<TaskGroupKey, string> = {
  overdue: "text-[var(--u-overdue-fg)]",
  today: "text-foreground",
  upcoming: "text-muted-foreground",
  none: "text-muted-foreground",
};

export function TaskList({
  tasks,
  now,
  timezone = DEFAULT_TIMEZONE,
  contactNames,
  emptyText = "Todo al día. ¡Bien ahí!",
  previewLimit,
}: TaskListProps) {
  const router = useRouter();
  // Estado "optimista": la tarea se tilda al instante y se confirma en segundo plano.
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const clock = now ?? new Date();

  const isDone = (t: Task) => done[t.id] ?? t.completed;

  async function toggle(task: Task) {
    const next = !isDone(task);
    setError(null);
    setDone((d) => ({ ...d, [task.id]: next }));
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ completed: next })
      .eq("id", task.id)
      .eq("user_id", task.user_id);
    if (updateError) {
      setDone((d) => ({ ...d, [task.id]: !next }));
      setError("No se pudo actualizar la tarea. Probá de nuevo.");
      return;
    }
    router.refresh();
  }

  const collapsible = (k: TaskGroupKey) => k === "upcoming" || k === "none";
  const open = tasks.filter((t) => !t.completed);
  const finished = tasks.filter((t) => t.completed);

  if (tasks.length === 0) {
    return (
      <div className="surface flex flex-col items-center gap-2 px-4 py-9 text-center">
        <PartyPopper className="size-7 text-primary" />
        <p className="text-sm font-medium text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const groups = groupTasks(open, clock, timezone);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <h3
            className={`flex items-center gap-2 px-1 text-xs font-bold tracking-wider uppercase ${GROUP_TONE[group.key]}`}
          >
            {group.title}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {group.tasks.length}
            </span>
          </h3>
          <ul className="space-y-2">
            {(collapsible(group.key) && !expanded[group.key] && previewLimit !== undefined
              ? group.tasks.slice(0, previewLimit)
              : group.tasks
            ).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                done={isDone(task)}
                now={clock}
                timezone={timezone}
                contactName={task.contact_id ? contactNames?.[task.contact_id] : undefined}
                onToggle={() => void toggle(task)}
              />
            ))}
          </ul>
          {collapsible(group.key) &&
          previewLimit !== undefined &&
          !expanded[group.key] &&
          group.tasks.length > previewLimit ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [group.key]: true }))}
              className="w-full rounded-xl py-2 text-sm font-bold text-primary hover:bg-accent"
            >
              Ver {group.tasks.length - previewLimit} más
            </button>
          ) : null}
        </section>
      ))}

      {finished.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Hechas
          </h3>
          <ul className="space-y-2">
            {finished.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                done={isDone(task)}
                now={clock}
                timezone={timezone}
                contactName={task.contact_id ? contactNames?.[task.contact_id] : undefined}
                onToggle={() => void toggle(task)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function TaskRow({
  task,
  done,
  now,
  timezone,
  contactName,
  onToggle,
}: {
  task: Task;
  done: boolean;
  now: Date;
  timezone: string;
  contactName?: string;
  onToggle: () => void;
}) {
  const urgency = getUrgency(task.due_date, now, timezone);
  return (
    <li className="surface flex items-center gap-3 px-3 py-2.5" data-urgency={done ? "none" : urgency}>
      <button
        type="button"
        className="check-btn"
        data-done={done}
        onClick={onToggle}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        aria-pressed={done}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] leading-snug font-semibold ${
            done ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {task.title}
        </p>
        {contactName && task.contact_id && !task.title.toLowerCase().includes(contactName.toLowerCase()) ? (
          <Link
            href={`/contact/${task.contact_id}`}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {contactName}
          </Link>
        ) : null}
      </div>
      {!done ? (
        <span className="chip urgency-chip shrink-0">{urgencyLabel(task.due_date, now, timezone)}</span>
      ) : null}
    </li>
  );
}
