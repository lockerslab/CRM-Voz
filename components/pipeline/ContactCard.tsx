"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { Contact, PipelineStage, Task } from "@/types";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_LABELS,
} from "@/types";
import { CalendarClock, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type ContactCardProps = {
  contact: Contact;
  showStageMenu?: boolean;
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
  nextTask?: Task | null;
};

export function ContactCard({
  contact,
  showStageMenu = false,
  onStageChange,
  nextTask = null,
}: ContactCardProps) {
  const [moving, setMoving] = useState(false);
  const colors = PIPELINE_STAGE_COLORS[contact.stage];

  async function moveToStage(stage: PipelineStage) {
    if (stage === contact.stage || moving) return;
    setMoving(true);
    onStageChange?.(contact.id, stage);
    const supabase = createClient();
    await supabase
      .from("contacts")
      .update({ stage })
      .eq("id", contact.id)
      .eq("user_id", contact.user_id);
    setMoving(false);
  }

  return (
    <div
      className={`relative rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${colors.border}`}
    >
      <Link
        href={`/contact/${contact.id}`}
        className="block p-4 pr-11 transition-all duration-200"
      >
        <p className="text-[15px] font-bold leading-tight text-slate-900">
          {contact.name}
        </p>
        {contact.company ? (
          <p className="mt-1 text-sm text-slate-500">{contact.company}</p>
        ) : null}
        {nextTask ? (
          <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
            <span className="min-w-0">
              <span className="font-medium text-slate-700">{nextTask.title}</span>
              {nextTask.due_date ? (
                <span className="block text-slate-400">
                  {new Date(nextTask.due_date).toLocaleString("es-AR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </Link>

      {showStageMenu ? (
        <div className="absolute top-2.5 right-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-slate-400 transition-all duration-200 hover:text-slate-700"
                  aria-label="Mover de etapa"
                  disabled={moving}
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuLabel>Mover a</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PIPELINE_STAGES.map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  disabled={stage === contact.stage}
                  onClick={() => void moveToStage(stage)}
                  className="transition-all duration-200"
                >
                  <span
                    className={`mr-2 inline-block size-2 rounded-full ${PIPELINE_STAGE_COLORS[stage].chip.split(" ")[0]}`}
                  />
                  {PIPELINE_STAGE_LABELS[stage]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
