"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { getUrgency, urgencyLabel } from "@/lib/urgency";
import type { Contact, PipelineStage, Task } from "@/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types";
import { CalendarClock, MoreVertical } from "lucide-react";
import Link from "next/link";

type ContactCardProps = {
  contact: Contact;
  showStageMenu?: boolean;
  /** Pide mover el contacto a otra etapa. Quien lo recibe se encarga de guardar. */
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
  nextTask?: Task | null;
  now?: Date;
  timezone?: string;
  /** Se puede arrastrar a otra columna (compu) */
  draggable?: boolean;
  isDragging?: boolean;
  onDragStartCard?: (contactId: string) => void;
  onDragEndCard?: () => void;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function ContactCard({
  contact,
  showStageMenu = false,
  onStageChange,
  nextTask = null,
  now,
  timezone = DEFAULT_TIMEZONE,
  draggable = false,
  isDragging = false,
  onDragStartCard,
  onDragEndCard,
}: ContactCardProps) {
  const clock = now ?? new Date();

  return (
    <div
      data-stage={contact.stage}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData("text/plain", contact.id);
              e.dataTransfer.effectAllowed = "move";
              onDragStartCard?.(contact.id);
            }
          : undefined
      }
      onDragEnd={draggable ? () => onDragEndCard?.() : undefined}
      className={`surface surface-lift relative ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <Link
        href={`/contact/${contact.id}`}
        draggable={false}
        className="flex items-start gap-3 p-3.5"
      >
        <span
          className="stage-solid display flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--surface-border)] text-sm text-[color:var(--on-solid)]"
          aria-hidden
        >
          {initialsOf(contact.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block pr-8 text-[15px] leading-tight font-bold text-foreground">
            {contact.name}
          </span>
          {contact.company ? (
            <span className="mt-0.5 block truncate pr-8 text-sm text-muted-foreground">
              {contact.company}
            </span>
          ) : null}
          {contact.product_interest ? (
            <span className="chip stage-chip mt-1.5 max-w-full !rounded-lg !whitespace-normal leading-tight">{contact.product_interest}</span>
          ) : null}
          {nextTask ? (
            <span
              className="mt-2 block space-y-1"
              data-urgency={getUrgency(nextTask.due_date, clock, timezone)}
            >
              <span className="flex items-start gap-1.5">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2 min-w-0 text-xs font-medium text-foreground/80">
                  {nextTask.title}
                </span>
              </span>
              {nextTask.due_date ? (
                <span className="chip urgency-chip max-w-full !rounded-lg !whitespace-normal leading-tight">
                  {urgencyLabel(nextTask.due_date, clock, timezone, true)}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </Link>

      {showStageMenu ? (
        <div className="absolute top-2 right-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-10 text-muted-foreground transition-all duration-200 hover:text-foreground"
                  aria-label="Mover de etapa"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Mover a</DropdownMenuLabel>
                {PIPELINE_STAGES.map((stage) => (
                  <DropdownMenuItem
                    key={stage}
                    disabled={stage === contact.stage}
                    onClick={() => onStageChange?.(contact.id, stage)}
                    className="transition-all duration-200"
                  >
                    <span
                      data-stage={stage}
                      className="stage-solid mr-2 inline-block size-2.5 rounded-full"
                    />
                    {PIPELINE_STAGE_LABELS[stage]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
