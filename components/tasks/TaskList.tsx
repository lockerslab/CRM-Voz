"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDue } from "@/lib/dates";
import type { Task } from "@/types";
import { CheckCircle2, ClipboardList } from "lucide-react";

type TaskListProps = {
  tasks: Task[];
  onToggleComplete?: (task: Task) => void;
};

export function TaskList({ tasks, onToggleComplete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center shadow-sm">
        <ClipboardList className="size-6 text-slate-300" />
        <p className="text-sm text-slate-400">No hay tareas pendientes.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start justify-between gap-3 px-4 py-3 transition-all duration-200 hover:bg-slate-50/80"
        >
          <div className="min-w-0 space-y-1">
            <p
              className={`text-sm font-medium ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}
            >
              {task.title}
            </p>
            <div className="flex flex-wrap gap-1">
              {task.due_date ? (
                <Badge variant="secondary" className="text-[10px]">
                  Vence {formatDue(task.due_date)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Sin fecha
                </Badge>
              )}
              {task.completed ? (
                <Badge className="bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">
                  Hecha
                </Badge>
              ) : null}
            </div>
          </div>
          {onToggleComplete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="transition-all duration-200"
              onClick={() => onToggleComplete(task)}
            >
              <CheckCircle2 className="size-4" />
              {task.completed ? "Deshacer" : "Completar"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
