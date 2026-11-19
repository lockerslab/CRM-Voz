"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Revisá tu email para confirmar la cuenta y después entrá.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 bg-white shadow-sm transition-all duration-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            crm-voz
          </CardTitle>
          <CardDescription>Creá tu cuenta</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void onSubmit(e)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="h-10 rounded-xl transition-all duration-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="h-10 rounded-xl transition-all duration-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? (
              <p className="text-sm text-slate-500">{message}</p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-3 bg-transparent">
            <Button
              type="submit"
              disabled={loading}
              className="h-11 rounded-xl bg-[#6D28D9] transition-all duration-200 hover:bg-[#5b21b6]"
            >
              {loading ? "Creando…" : "Registrarme"}
            </Button>
            <p className="text-center text-sm text-slate-500">
              ¿Ya tenés cuenta?{" "}
              <Link
                href="/login"
                className="font-medium text-violet-700 underline-offset-4 transition-all duration-200 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
