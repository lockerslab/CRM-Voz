"use client";

import { ContactCard } from "@/components/pipeline/ContactCard";
import type { Contact, PipelineStage, Task } from "@/types";
import { PIPELINE_STAGE_COLORS, PIPELINE_STAGE_LABELS } from "@/types";
import { Users } from "lucide-react";

type PipelineColumnProps = {
  stage: PipelineStage;
  contacts: Contact[];
  showStageMenu?: boolean;
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
  nextTaskFor?: (contactId: string) => Task | null;
};

export function PipelineColumn({
  stage,
  contacts,
  showStageMenu = false,
  onStageChange,
  nextTaskFor,
}: PipelineColumnProps) {
  const colors = PIPELINE_STAGE_COLORS[stage];

  return (
    <section
      className={`flex min-w-[240px] flex-1 flex-col gap-2.5 rounded-2xl border-t-4 border bg-white/80 p-2.5 shadow-sm transition-all duration-200 ${colors.border} ${colors.soft}`}
    >
      <header className="flex items-center justify-between px-1.5 py-1">
        <h2
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${colors.chip}`}
        >
          {PIPELINE_STAGE_LABELS[stage]}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-100">
          {contacts.length}
        </span>
      </header>
      <div className="flex flex-col gap-2.5">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            showStageMenu={showStageMenu}
            onStageChange={onStageChange}
            nextTask={nextTaskFor?.(contact.id) ?? null}
          />
        ))}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <Users className="size-5 text-slate-300" />
            <p className="text-xs text-slate-400">Sin contactos acá</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
