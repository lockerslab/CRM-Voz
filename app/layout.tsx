import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Tipografía de la Variante A (Pulso): redondeada, amigable, muy legible en celular.
const font = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "crm-voz",
  description: "Tu CRM por voz: contale a la app cómo te fue y ella carga todo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className={`${font.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
