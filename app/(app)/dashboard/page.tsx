import { DashboardView } from "@/components/dashboard/DashboardView";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Task } from "@/types";

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function firstNameFromEmail(email: string | undefined): string | null {
  const local = email?.split("@")[0]?.split(/[._+\-\d]+/)[0];
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirects if unauthenticated; user is guaranteed here.
  if (!user) return null;

  const [{ data: contacts }, { data: tasks }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true }),
  ]);

  const contactList = (contacts as Contact[]) ?? [];
  const taskList = (tasks as Task[]) ?? [];

  return (
    <DashboardView
      contacts={contactList}
      tasks={taskList}
      initials={initialsFromEmail(user.email)}
      firstName={firstNameFromEmail(user.email)}
      email={user.email}
      nowIso={new Date().toISOString()}
    />
  );
}
