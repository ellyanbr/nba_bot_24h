"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-blood-500 uppercase">Erro</p>
      <h1 className="mt-2 text-xl font-bold text-white">Não foi possível carregar esta página.</h1>
      <p className="mt-2 text-sm text-ink-300">{error.message}</p>
      <Button className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
