import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Tipografía de la Variante B (Calle): títulos Space Grotesk (con carácter),
// texto DM Sans (limpio y legible en celular).
const body = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "crm-voz",
  description: "Tu CRM por voz: contale a la app cómo te fue y ella carga todo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffd23f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className={`${body.variable} ${display.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
