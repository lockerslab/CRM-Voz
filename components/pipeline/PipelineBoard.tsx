"use client";

import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { ContactCard } from "@/components/pipeline/ContactCard";
import { useContactsRealtime } from "@/lib/hooks/useContactsRealtime";
import type { Contact, PipelineStage, Task } from "@/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types";
import { Mic2, Users } from "lucide-react";
import { useState } from "react";

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

  const byStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = contacts
        .filter((c) => c.stage === stage)
        .sort((a, b) => a.position - b.position);
      return acc;
    },
    {} as Record<PipelineStage, Contact[]>,
  );

  function onStageChange(contactId: string, stage: PipelineStage) {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, stage } : c)),
    );
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
                  active ? "stage-solid text-white shadow-md" : "stage-chip"
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
          />
        ))}
      </div>
    </div>
  );
}
