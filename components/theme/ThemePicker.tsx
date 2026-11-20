"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_INFO,
  applyTheme,
  currentTheme,
  type Theme,
} from "@/lib/theme";
import { Check, Palette } from "lucide-react";
import { useEffect, useState } from "react";

type ThemePickerProps = {
  /** Diseño guardado en el perfil (si lo hay): manda sobre el de este dispositivo. */
  profileTheme?: Theme | null;
};

export function ThemePicker({ profileTheme = null }: ThemePickerProps) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  // Al cargar: tomar el tema que ya tiene la página, o el del perfil si es otro
  // (así el diseño elegido en el celu aparece también en la compu).
  useEffect(() => {
    const now = currentTheme();
    if (profileTheme && profileTheme !== now) {
      applyTheme(profileTheme);
      setTheme(profileTheme);
    } else {
      setTheme(now);
    }
  }, [profileTheme]);

  async function choose(next: Theme) {
    if (next === theme) return;
    setTheme(next);
    applyTheme(next); // se ve y se recuerda en este dispositivo al instante
    // Guardarlo en el perfil para que acompañe al usuario. Si falla, igual
    // queda en este dispositivo.
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ theme: next }).eq("id", user.id);
    } catch {
      /* sin conexión: queda solo en este dispositivo */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="surface size-11 rounded-full text-foreground"
            aria-label="Cambiar diseño"
          />
        }
      >
        <Palette className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Diseño</DropdownMenuLabel>
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t}
              onClick={() => void choose(t)}
              className="gap-3 py-2"
              data-theme-option={t}
            >
              <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {THEME_INFO[t].swatch.map((c) => (
                  <span
                    key={c}
                    className="size-4 rounded-full ring-2 ring-[color:var(--popover)]"
                    style={{ background: c, boxShadow: "inset 0 0 0 1px rgb(128 128 128 / 40%)" }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{THEME_INFO[t].label}</span>
                <span className="block text-xs text-muted-foreground">
                  {THEME_INFO[t].description}
                </span>
              </span>
              {theme === t ? <Check className="size-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
