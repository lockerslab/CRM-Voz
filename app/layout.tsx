import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { DM_Sans, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { THEME_COOKIE, THEME_INFO, parseTheme } from "@/lib/theme";

// Tipografías de los tres temas. Todas quedan definidas como variables, pero el
// navegador solo baja los archivos de las que el tema activo realmente usa:
//   Calle: DM Sans (texto) + Space Grotesk (títulos)
//   Claro: Inter
//   Tech:  Inter (texto) + JetBrains Mono (títulos)
// preload: false -> Next no "precarga" las cuatro a la fuerza (se bajarían 145 KB
// en todos los temas). El navegador pide solo las del tema activo; mientras llegan
// se usa una fuente de reemplazo de tamaño ajustado, así casi no hay saltos.
const dm = DM_Sans({ variable: "--font-dm", subsets: ["latin"], preload: false });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], preload: false });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });
const jetbrains = JetBrains_Mono({ variable: "--font-jb", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "crm-voz",
  description: "Tu CRM por voz: contale a la app cómo te fue y ella carga todo.",
};

export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: THEME_INFO[theme].metaColor,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El tema viene de una cookie, así la página llega ya con los colores
  // correctos (sin parpadeo).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="es-AR"
      data-theme={theme}
      className={`${dm.variable} ${space.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
