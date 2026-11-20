import { DashboardView } from "@/components/dashboard/DashboardView";
import { createClient } from "@/lib/supabase/server";
import { THEMES, type Theme } from "@/lib/theme";
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

  const [{ data: contacts }, { data: tasks }, { data: profile }] = await Promise.all([
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
    // Diseño guardado en el perfil. Si la columna todavía no existe (migración
    // pendiente), devuelve error y simplemente se ignora.
    supabase.from("profiles").select("theme").eq("id", user.id).maybeSingle(),
  ]);

  const savedTheme = (profile as { theme?: string | null } | null)?.theme;
  const profileTheme: Theme | null = (THEMES as readonly string[]).includes(savedTheme ?? "")
    ? (savedTheme as Theme)
    : null;

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
      profileTheme={profileTheme}
    />
  );
}
