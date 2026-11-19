"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/types";

/**
 * Subscribes to realtime changes on `contacts` for the current user.
 * Returns the latest contacts list (initial fetch + live updates).
 */
export function useContactsRealtime(initial: Contact[] = []) {
  const [contacts, setContacts] = useState<Contact[]>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (!cancelled && data) {
        setContacts(data as Contact[]);
      }
      setReady(true);
    }

    void bootstrap();

    const channel = supabase
      .channel("contacts-pipeline")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        (payload) => {
          setContacts((prev) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Contact>;
              return prev.filter((c) => c.id !== oldRow.id);
            }

            const row = payload.new as Contact;
            const idx = prev.findIndex((c) => c.id === row.id);
            if (idx === -1) return [row, ...prev];
            const next = [...prev];
            next[idx] = row;
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { contacts, setContacts, ready };
}
