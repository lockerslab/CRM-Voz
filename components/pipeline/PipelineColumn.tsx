"use client";

import { ContactCard } from "@/components/pipeline/ContactCard";
import type { Contact, PipelineStage } from "@/types";
import { PIPELINE_STAGE_LABELS } from "@/types";

type PipelineColumnProps = {
  stage: PipelineStage;
  contacts: Contact[];
  showStageMenu?: boolean;
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
};

export function PipelineColumn({
  stage,
  contacts,
  showStageMenu = false,
  onStageChange,
}: PipelineColumnProps) {
  return (
    <section className="flex min-w-[220px] flex-1 flex-col gap-2 rounded-lg border bg-muted/30 p-2">
      <header className="flex items-center justify-between px-1 py-1">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {PIPELINE_STAGE_LABELS[stage]}
        </h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {contacts.length}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            showStageMenu={showStageMenu}
            onStageChange={onStageChange}
          />
        ))}
        {contacts.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">
            Sin contactos
          </p>
        ) : null}
      </div>
    </section>
  );
}
