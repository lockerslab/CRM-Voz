"use client";

import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { ContactCard } from "@/components/pipeline/ContactCard";
import { Button } from "@/components/ui/button";
import { useContactsRealtime } from "@/lib/hooks/useContactsRealtime";
import type { Contact, PipelineStage, Task } from "@/types";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_LABELS,
} from "@/types";
import { Mic2, Users } from "lucide-react";
import { useState } from "react";

type PipelineBoardProps = {
  initialContacts?: Contact[];
  tasks?: Task[];
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Mic2 className="size-6" />
        </div>
        <p className="max-w-xs text-sm text-slate-500">
          Todavía no hay contactos. Grabá tu primera nota.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!ready ? (
        <p className="text-sm text-slate-400">Cargando pipeline…</p>
      ) : null}

      {/* Mobile: tabs per stage */}
      <div className="md:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = byStage[stage].length;
            const active = activeStage === stage;
            const colors = PIPELINE_STAGE_COLORS[stage];
            return (
              <Button
                key={stage}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className={`shrink-0 rounded-full transition-all duration-200 ${
                  active
                    ? ""
                    : `border bg-white ${colors.border} ${colors.chip}`
                }`}
                onClick={() => setActiveStage(stage)}
              >
                {PIPELINE_STAGE_LABELS[stage]}
                <span className="ml-1 opacity-70">({count})</span>
              </Button>
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
            />
          ))}
          {byStage[activeStage].length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Users className="size-6 text-slate-300" />
              <p className="text-sm text-slate-400">
                No hay contactos en{" "}
                {PIPELINE_STAGE_LABELS[activeStage].toLowerCase()}.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Desktop: Kanban */}
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            contacts={byStage[stage]}
            showStageMenu
            onStageChange={onStageChange}
            nextTaskFor={nextTaskFor}
          />
        ))}
      </div>
    </div>
  );
}
