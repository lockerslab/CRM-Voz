// Temas visuales de la app. Cada tema es un bloque de variables CSS en
// app/globals.css ([data-theme="…"]); acá solo vive la lista y las utilidades.

export const THEMES = ["calle", "claro", "tech"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "calle";
export const THEME_COOKIE = "crmvoz_theme";

export const THEME_INFO: Record<
  Theme,
  { label: string; description: string; swatch: [string, string, string]; metaColor: string }
> = {
  calle: {
    label: "Calle",
    description: "Con onda: amarillo, bordes negros",
    swatch: ["#ffd23f", "#5b2eff", "#111111"],
    metaColor: "#ffd23f",
  },
  claro: {
    label: "Claro",
    description: "Minimalista y sobrio",
    swatch: ["#ffffff", "#1d4ed8", "#0f172a"],
    metaColor: "#f7f8fa",
  },
  tech: {
    label: "Tech",
    description: "Oscuro, con acentos neón",
    swatch: ["#0a0e14", "#22d3ee", "#a855f7"],
    metaColor: "#0a0e14",
  },
};

export function parseTheme(value: string | null | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : DEFAULT_THEME;
}

/** Aplica el tema en el navegador y lo recuerda (cookie de 1 año). */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_INFO[theme].metaColor);
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return parseTheme(document.documentElement.dataset.theme);
}
