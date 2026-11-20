"use client";

import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { ContactCard } from "@/components/pipeline/ContactCard";
import { useContactsRealtime } from "@/lib/hooks/useContactsRealtime";
import type { Contact, PipelineStage, Task } from "@/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types";
import { Mic2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";

type PipelineBoardProps = {
  initialContacts?: Contact[];
  tasks?: Task[];
  now?: Date;
  timezone?: string;
};

function pickNextTask(tasks: Task[], contactId: string): Task | null {
  const open = tasks
    .filter((t) => t.contact_id === contactId && !t.completed)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  return open[0] ?? null;
}

export function PipelineBoard({
  initialContacts = [],
  tasks = [],
  now,
  timezone,
}: PipelineBoardProps) {
  const { contacts, setContacts, ready } = useContactsRealtime(initialContacts);
  const [activeStage, setActiveStage] = useState<PipelineStage>("cold_lead");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  function showNotice(kind: "ok" | "error", text: string) {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), kind === "ok" ? 2500 : 5000);
  }

  const byStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = contacts
        .filter((c) => c.stage === stage)
        .sort((a, b) => a.position - b.position);
      return acc;
    },
    {} as Record<PipelineStage, Contact[]>,
  );

  /**
   * Mueve un contacto a otra etapa (desde el menú ⋮ o arrastrando).
   * Se ve al instante; si el guardado falla, vuelve a donde estaba y avisa.
   */
  async function onStageChange(contactId: string, stage: PipelineStage) {
    setDraggingId(null);
    const current = contacts.find((c) => c.id === contactId);
    if (!current || current.stage === stage) return;
    const previous = current.stage;

    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, stage } : c)));

    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .update({ stage })
      .eq("id", contactId)
      .eq("user_id", current.user_id);

    if (error) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, stage: previous } : c)),
      );
      showNotice("error", `No se pudo mover a ${PIPELINE_STAGE_LABELS[stage]}. Probá de nuevo.`);
      return;
    }
    showNotice("ok", `${current.name} pasó a ${PIPELINE_STAGE_LABELS[stage]}`);
  }

  const nextTaskFor = (contactId: string) => pickNextTask(tasks, contactId);

  if (ready && contacts.length === 0) {
    return (
      <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <div className="hero-card flex size-14 items-center justify-center rounded-2xl">
          <Mic2 className="size-7" />
        </div>
        <p className="display text-lg text-foreground">Todavía no hay contactos</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tocá el micrófono y contame con quién hablaste. Yo armo la ficha y la tarea.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!ready ? (
        <p className="text-sm text-muted-foreground">Cargando pipeline…</p>
      ) : null}
      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`surface px-4 py-2.5 text-sm font-semibold ${
            notice.kind === "error" ? "text-destructive" : "text-foreground"
          }`}
        >
          {notice.kind === "ok" ? "✓ " : ""}
          {notice.text}
        </p>
      ) : null}

      {/* Celular: una etapa por vez, con chips para cambiar */}
      <div className="md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
          {PIPELINE_STAGES.map((stage) => {
            const count = byStage[stage].length;
            const active = activeStage === stage;
            return (
              <button
                key={stage}
                type="button"
                data-stage={stage}
                onClick={() => setActiveStage(stage)}
                aria-pressed={active}
                className={`chip min-h-10 shrink-0 px-3.5 text-sm transition-all duration-150 ${
                  active ? "stage-solid text-[color:var(--on-solid)] shadow-md" : "stage-chip"
                }`}
              >
                {PIPELINE_STAGE_LABELS[stage]}
                <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/25" : "bg-white/60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {byStage[activeStage].map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              showStageMenu
              onStageChange={onStageChange}
              nextTask={nextTaskFor(contact.id)}
              now={now}
              timezone={timezone}
            />
          ))}
          {byStage[activeStage].length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users className="size-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No hay nadie en {PIPELINE_STAGE_LABELS[activeStage].toLowerCase()}.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Compu: tablero con todas las columnas */}
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            contacts={byStage[stage]}
            showStageMenu
            onStageChange={onStageChange}
            nextTaskFor={nextTaskFor}
            now={now}
            timezone={timezone}
            draggingId={draggingId}
            onDragStartCard={setDraggingId}
            onDragEndCard={() => setDraggingId(null)}
          />
        ))}
      </div>
    </div>
  );
}
