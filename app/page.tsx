import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#dbeafe_0%,_transparent_55%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)]"
      />
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">
          CRM por voz
        </p>
        <h1 className="font-[family-name:var(--font-source-serif)] text-5xl tracking-tight text-slate-900 sm:text-6xl">
          crm-voz
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Grabá notas de voz, extraé datos del CRM con Groq y mové deals en un
          pipeline en vivo con Supabase.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" render={<Link href="/login" />}>
            Entrar
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/register" />}>
            Crear cuenta
          </Button>
        </div>
      </div>
    </main>
  );
}
