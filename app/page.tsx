import { Button } from "@/components/ui/button";
import { Mic, Sparkles, UserRoundCheck } from "lucide-react";
import Link from "next/link";

const STEPS = [
  { icon: Mic, title: "Hablás", text: "Grabás una nota de voz después de cada visita o llamada." },
  { icon: Sparkles, title: "Yo cargo", text: "Armo el contacto, la etapa y la tarea con fecha." },
  { icon: UserRoundCheck, title: "Vos vendés", text: "Revisás, confirmás y seguís con tu día." },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <section className="hero-card relative overflow-hidden px-7 py-10 text-center">
        <div
          className="pointer-events-none absolute -top-14 -right-12 size-52 rounded-full bg-white/15 blur-2xl"
          aria-hidden
        />
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-white/20 backdrop-blur">
          <Mic className="size-8" />
        </span>
        <p className="mt-5 text-xs font-bold tracking-[0.2em] uppercase opacity-90">CRM por voz</p>
        <h1 className="display mt-2 text-4xl leading-tight">Contale a tu CRM cómo te fue</h1>
        <p className="mt-3 text-[15px] leading-relaxed opacity-95">
          Para vendedores que están en la calle: hablá y listo. La ficha y el recordatorio se arman solos.
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="h-13 w-full rounded-2xl text-base font-bold"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Entrar
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-13 w-full rounded-2xl bg-card text-base font-bold"
          nativeButton={false}
          render={<Link href="/register" />}
        >
          Crear cuenta
        </Button>
      </div>

      <ul className="space-y-2.5">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="surface flex items-center gap-3.5 px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-foreground">{title}</span>
              <span className="block text-sm text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
