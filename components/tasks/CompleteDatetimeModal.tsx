"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

type CompleteDatetimeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string | null;
  onConfirm: (dueDate: string, dueTime: string) => void;
};

/** Stub modal shown when extraction implies a task but date/time is missing. */
export function CompleteDatetimeModal({
  open,
  onOpenChange,
  taskTitle,
  onConfirm,
}: CompleteDatetimeModalProps) {
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete due date</DialogTitle>
          <DialogDescription>
            {taskTitle
              ? `Set a date and time for “${taskTitle}”.`
              : "This note needs a follow-up date and time."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="due-date">Date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="due-time">Time</Label>
            <Input
              id="due-time"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button
            type="button"
            disabled={!dueDate}
            onClick={() => {
              onConfirm(dueDate, dueTime);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
