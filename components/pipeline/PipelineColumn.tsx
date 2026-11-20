"use client";

import { ContactCard } from "@/components/pipeline/ContactCard";
import type { Contact, PipelineStage, Task } from "@/types";
import { PIPELINE_STAGE_LABELS } from "@/types";
import { Users } from "lucide-react";

type PipelineColumnProps = {
  stage: PipelineStage;
  contacts: Contact[];
  showStageMenu?: boolean;
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
  nextTaskFor?: (contactId: string) => Task | null;
  now?: Date;
  timezone?: string;
};

export function PipelineColumn({
  stage,
  contacts,
  showStageMenu = false,
  onStageChange,
  nextTaskFor,
  now,
  timezone,
}: PipelineColumnProps) {
  return (
    <section
      data-stage={stage}
      className="column flex min-w-[190px] flex-1 flex-col gap-2.5 p-2.5"
    >
      <header className="flex items-center justify-between px-1 py-1">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="stage-solid size-2.5 rounded-full" aria-hidden />
          {PIPELINE_STAGE_LABELS[stage]}
        </h2>
        <span className="chip stage-chip">{contacts.length}</span>
      </header>
      <div className="flex flex-col gap-2.5">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            showStageMenu={showStageMenu}
            onStageChange={onStageChange}
            nextTask={nextTaskFor?.(contact.id) ?? null}
            now={now}
            timezone={timezone}
          />
        ))}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center">
            <Users className="size-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Nadie por acá</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
