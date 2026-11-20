"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_TIMEZONE, zonedTimeToIso } from "@/lib/dates";
import type { Contact, NoteProposal, PipelineStage, SaveNotePayload } from "@/types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/types";
import { useEffect, useMemo, useState } from "react";

type NoteReviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: NoteProposal | null;
  transcript: string;
  audioPath: string;
  contacts: Contact[];
  /** Zona horaria del usuario (IANA). Por defecto, Buenos Aires. */
  timezone?: string;
  onSaved?: (result: { contact_id: string }) => void;
};

function splitDueAt(dueAt: string | null): { date: string; time: string } {
  if (!dueAt) return { date: "", time: "" };
  // Accept 2026-11-20T10:00:00-03:00 or Z
  const match = dueAt.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/,
  );
  if (!match) return { date: "", time: "" };
  return { date: match[1]!, time: match[2]! };
}

function joinDueAt(date: string, time: string, timezone: string): string | null {
  if (!date) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time || "09:00");
  if (!dateMatch || !timeMatch) return null;
  // Offset real de la zona del usuario (no más -03:00 fijo).
  return zonedTimeToIso(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    timezone,
  );
}

export function NoteReviewSheet({
  open,
  onOpenChange,
  proposal,
  transcript,
  audioPath,
  contacts,
  timezone = DEFAULT_TIMEZONE,
  onSaved,
}: NoteReviewSheetProps) {
  const [mode, setMode] = useState<"create" | "update">("create");
  const [contactId, setContactId] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [stage, setStage] = useState<PipelineStage>("cold_lead");
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proposal || !open) return;
    setError(null);

    const existing =
      proposal.action === "update" && proposal.contact_id
        ? contacts.find((c) => c.id === proposal.contact_id)
        : undefined;

    if (existing) {
      // Preload existing contact, then overlay only non-null proposal fields.
      setMode("update");
      setContactId(existing.id);
      setContactName(
        proposal.contact_name != null ? proposal.contact_name : existing.name,
      );
      setCompany(
        proposal.company != null ? proposal.company : (existing.company ?? ""),
      );
      setStage(proposal.stage != null ? proposal.stage : existing.stage);
      setNotes(existing.notes ?? "");
      setSummary(proposal.summary != null ? proposal.summary : "");
      setTaskTitle(proposal.task_title != null ? proposal.task_title : "");
      if (proposal.due_at != null) {
        const { date, time } = splitDueAt(proposal.due_at);
        setDueDate(date);
        setDueTime(time);
      } else {
        setDueDate("");
        setDueTime("");
      }
      return;
    }

    setMode(proposal.action === "update" && proposal.contact_id ? "update" : "create");
    setContactId(proposal.contact_id ?? "");
    setContactName(proposal.contact_name ?? "");
    setCompany(proposal.company ?? "");
    setStage(proposal.stage ?? "cold_lead");
    setNotes("");
    setSummary(proposal.summary ?? "");
    setTaskTitle(proposal.task_title ?? "");
    const { date, time } = splitDueAt(proposal.due_at);
    setDueDate(date);
    setDueTime(time);
  }, [proposal, open, contacts]);

  const dueRequired = Boolean(taskTitle.trim()) && !dueDate;
  const canSave = Boolean(contactName.trim()) && !dueRequired && !saving;

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [contacts],
  );

  function onSelectExisting(id: string | null) {
    if (!id) {
      setMode("create");
      setContactId("");
      return;
    }
    const found = contacts.find((c) => c.id === id);
    setMode("update");
    setContactId(id);
    if (found) {
      setContactName(found.name);
      setCompany(found.company ?? "");
      setStage(found.stage);
      setNotes(found.notes ?? "");
    }
  }

  async function handleConfirm() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const payload: SaveNotePayload = {
      action: mode,
      contact_id: mode === "update" ? contactId || null : null,
      contact_name: contactName.trim(),
      company: company.trim() || null,
      email: proposal?.email ?? null,
      phone: proposal?.phone ?? null,
      stage,
      channels: proposal?.channels ?? [],
      product_interest: proposal?.product_interest ?? null,
      notes: notes.trim() || null,
      summary: summary.trim() || null,
      transcript,
      audioPath,
      task_title: taskTitle.trim() || null,
      due_at: taskTitle.trim() ? joinDueAt(dueDate, dueTime, timezone) : null,
    };

    try {
      const res = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        contact_id?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la nota");
        setSaving(false);
        return;
      }
      onOpenChange(false);
      if (data.contact_id) onSaved?.({ contact_id: data.contact_id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-2xl border-slate-200 bg-white sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">Revisar nota de voz</SheetTitle>
          <SheetDescription>
            Confirmá o editá los datos antes de guardar en el CRM.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 pb-2">
          <div className="grid gap-2">
            <Label>Contacto</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "create" ? "default" : "outline"}
                onClick={() => {
                  setMode("create");
                  setContactId("");
                }}
              >
                Nuevo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "update" ? "default" : "outline"}
                onClick={() => setMode("update")}
              >
                Existente
              </Button>
            </div>
            {mode === "update" ? (
              <Select
                value={contactId || undefined}
                items={sortedContacts.map((c) => ({
                  value: c.id,
                  label: c.company ? `${c.name} · ${c.company}` : c.name,
                }))}
                onValueChange={(v) => onSelectExisting(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un contacto" />
                </SelectTrigger>
                <SelectContent>
                  {sortedContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` · ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nombre del contacto"
            />
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Empresa (opcional)"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Etapa</Label>
            <Select
              value={stage}
              items={PIPELINE_STAGES.map((s) => ({
                value: s,
                label: PIPELINE_STAGE_LABELS[s],
              }))}
              onValueChange={(v) => {
                if (v && (PIPELINE_STAGES as readonly string[]).includes(v)) {
                  setStage(v as PipelineStage);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PIPELINE_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="review-summary">Resumen</Label>
            <Textarea
              id="review-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="review-notes">Notas</Label>
            <Textarea
              id="review-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notas del contacto"
            />
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <Label htmlFor="review-task">Tarea</Label>
            <Input
              id="review-task"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Título de la tarea (opcional)"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label
                  htmlFor="review-due-date"
                  className={dueRequired ? "text-destructive" : undefined}
                >
                  Fecha{dueRequired ? " *" : ""}
                </Label>
                <Input
                  id="review-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-invalid={dueRequired}
                  className={
                    dueRequired
                      ? "border-destructive ring-2 ring-destructive/30"
                      : undefined
                  }
                  required={Boolean(taskTitle.trim())}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="review-due-time">Hora</Label>
                <Input
                  id="review-due-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
            {dueRequired ? (
              <p className="text-xs text-destructive">
                Hay una tarea: la fecha es obligatoria para guardar.
              </p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-[#6D28D9] transition-all duration-200 hover:bg-[#5b21b6]"
            onClick={() => void handleConfirm()}
            disabled={!canSave}
          >
            {saving ? "Guardando…" : "Confirmar y guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
