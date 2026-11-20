"use client";

import { ContactCard } from "@/components/pipeline/ContactCard";
import type { Contact, PipelineStage, Task } from "@/types";
import { PIPELINE_STAGE_LABELS } from "@/types";
import { Users } from "lucide-react";
import { useState } from "react";

type PipelineColumnProps = {
  stage: PipelineStage;
  contacts: Contact[];
  showStageMenu?: boolean;
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
  nextTaskFor?: (contactId: string) => Task | null;
  now?: Date;
  timezone?: string;
  /** id del contacto que se está arrastrando (si hay alguno) */
  draggingId?: string | null;
  onDragStartCard?: (contactId: string) => void;
  onDragEndCard?: () => void;
};

export function PipelineColumn({
  stage,
  contacts,
  showStageMenu = false,
  onStageChange,
  nextTaskFor,
  now,
  timezone,
  draggingId = null,
  onDragStartCard,
  onDragEndCard,
}: PipelineColumnProps) {
  // La columna se "ilumina" cuando se arrastra una tarjeta por encima.
  const [over, setOver] = useState(false);

  return (
    <section
      data-stage={stage}
      data-over={over}
      className="column flex min-w-[190px] flex-1 flex-col gap-2.5 p-2.5 transition-all duration-150"
      onDragOver={(e) => {
        if (!draggingId) return;
        e.preventDefault(); // necesario para poder soltar acá
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // ignorar cuando solo pasa de un hijo a otro dentro de la misma columna
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain") || draggingId;
        if (id) onStageChange?.(id, stage);
        onDragEndCard?.();
      }}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="stage-solid size-2.5 rounded-full" aria-hidden />
          {PIPELINE_STAGE_LABELS[stage]}
        </h2>
        <span className="chip stage-chip">{contacts.length}</span>
      </header>
      <div className="flex min-h-16 flex-col gap-2.5">
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            showStageMenu={showStageMenu}
            onStageChange={onStageChange}
            nextTask={nextTaskFor?.(contact.id) ?? null}
            now={now}
            timezone={timezone}
            draggable
            isDragging={draggingId === contact.id}
            onDragStartCard={onDragStartCard}
            onDragEndCard={onDragEndCard}
          />
        ))}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center">
            <Users className="size-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              {draggingId ? "Soltá acá" : "Nadie por acá"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
