"use client";

import { Badge } from "@/components/ui/badge";
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
import type { Contact, PipelineStage } from "@/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types";
import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type ContactCardProps = {
  contact: Contact;
  showStageMenu?: boolean;
  onStageChange?: (contactId: string, stage: PipelineStage) => void;
};

export function ContactCard({
  contact,
  showStageMenu = false,
  onStageChange,
}: ContactCardProps) {
  const [moving, setMoving] = useState(false);

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
    <div className="relative rounded-lg border bg-card transition-shadow hover:shadow-md">
      <Link href={`/contact/${contact.id}`} className="block p-3 pr-10">
        <p className="text-sm font-medium leading-tight">{contact.name}</p>
        {contact.company ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{contact.company}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {contact.email ? (
            <Badge variant="secondary" className="max-w-full truncate text-[10px]">
              {contact.email}
            </Badge>
          ) : null}
          {contact.phone ? (
            <Badge variant="outline" className="text-[10px]">
              {contact.phone}
            </Badge>
          ) : null}
          {contact.product_interest ? (
            <Badge variant="outline" className="text-[10px]">
              {contact.product_interest}
            </Badge>
          ) : null}
        </div>
      </Link>

      {showStageMenu ? (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
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
                >
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
