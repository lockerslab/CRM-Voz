import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition-all duration-200">
        <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
          CRM por voz
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
          crm-voz
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
          Grabá notas de voz, extraé datos del CRM y mové deals desde el
          celular.
        </p>
        <div className="mt-8 flex flex-col gap-2.5">
          <Button
            size="lg"
            className="h-11 w-full rounded-xl bg-[#6D28D9] text-base transition-all duration-200 hover:bg-[#5b21b6]"
            render={<Link href="/login" />}
          >
            Entrar
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 w-full rounded-xl transition-all duration-200"
            render={<Link href="/register" />}
          >
            Crear cuenta
          </Button>
        </div>
      </div>
    </main>
  );
}
