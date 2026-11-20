"use client";

import { useEffect, useState } from "react";

/**
 * "Ahora" para pantallas que dependen de la hora (urgencias).
 * Arranca con el valor que mandó el servidor (así no hay diferencias entre el
 * HTML del servidor y el del navegador) y se actualiza cada minuto.
 */
export function useNow(initialIso: string): Date {
  const [now, setNow] = useState(() => new Date(initialIso));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
