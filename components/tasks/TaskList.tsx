"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Task } from "@/types";

type TaskListProps = {
  tasks: Task[];
  onToggleComplete?: (task: Task) => void;
};

export function TaskList({ tasks, onToggleComplete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No hay tareas pendientes.</p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-start justify-between gap-3 px-3 py-2"
        >
          <div className="min-w-0 space-y-1">
            <p
              className={`text-sm ${task.completed ? "text-muted-foreground line-through" : ""}`}
            >
              {task.title}
            </p>
            <div className="flex flex-wrap gap-1">
              {task.due_date ? (
                <Badge variant="secondary" className="text-[10px]">
                  Vence {new Date(task.due_date).toLocaleString("es-AR")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Sin fecha
                </Badge>
              )}
              {task.completed ? (
                <Badge className="text-[10px]">Hecha</Badge>
              ) : null}
            </div>
          </div>
          {onToggleComplete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onToggleComplete(task)}
            >
              {task.completed ? "Deshacer" : "Completar"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
