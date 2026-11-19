"use client";

import { PipelineColumn } from "@/components/pipeline/PipelineColumn";
import { useContactsRealtime } from "@/lib/hooks/useContactsRealtime";
import type { Contact, PipelineStage } from "@/types";
import { PIPELINE_STAGES } from "@/types";

type PipelineBoardProps = {
  initialContacts?: Contact[];
};

export function PipelineBoard({ initialContacts = [] }: PipelineBoardProps) {
  const { contacts, ready } = useContactsRealtime(initialContacts);

  const byStage = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = contacts.filter((c) => c.stage === stage);
      return acc;
    },
    {} as Record<PipelineStage, Contact[]>,
  );

  return (
    <div className="space-y-3">
      {!ready ? (
        <p className="text-sm text-muted-foreground">Loading pipeline…</p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => (
          <PipelineColumn key={stage} stage={stage} contacts={byStage[stage]} />
        ))}
      </div>
    </div>
  );
}
