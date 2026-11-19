"use client";

import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { ContactCard } from "@/components/pipeline/ContactCard";
import { Button } from "@/components/ui/button";
import { useContactsRealtime } from "@/lib/hooks/useContactsRealtime";
import type { Contact, PipelineStage } from "@/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types";
import { useState } from "react";

type PipelineBoardProps = {
  initialContacts?: Contact[];
};

export function PipelineBoard({ initialContacts = [] }: PipelineBoardProps) {
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

  return (
    <div className="space-y-3">
      {!ready ? (
        <p className="text-sm text-muted-foreground">Cargando pipeline…</p>
      ) : null}

      {/* Mobile: tabs per stage */}
      <div className="md:hidden">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = byStage[stage].length;
            const active = activeStage === stage;
            return (
              <Button
                key={stage}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setActiveStage(stage)}
              >
                {PIPELINE_STAGE_LABELS[stage]}
                <span className="ml-1 opacity-70">({count})</span>
              </Button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {byStage[activeStage].map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              showStageMenu
              onStageChange={onStageChange}
            />
          ))}
          {byStage[activeStage].length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay contactos en {PIPELINE_STAGE_LABELS[activeStage].toLowerCase()}.
            </p>
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
          />
        ))}
      </div>
    </div>
  );
}
