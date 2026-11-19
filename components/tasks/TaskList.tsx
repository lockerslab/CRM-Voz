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
      <p className="text-sm text-muted-foreground">No tasks yet.</p>
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
                  Due {new Date(task.due_date).toLocaleString()}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  No due date
                </Badge>
              )}
              {task.completed ? (
                <Badge className="text-[10px]">Done</Badge>
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
              {task.completed ? "Undo" : "Complete"}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
