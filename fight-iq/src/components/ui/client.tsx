"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClasses } from "./index";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, pendingText = "Salvando…", variant = "primary", className }: { children: ReactNode; pendingText?: string; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonClasses(variant), className)}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Botão que executa uma server action após confirmação.
 * A action pode retornar { ok, message } para exibir erro.
 */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "secondary",
  size = "sm",
  className,
  title,
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        title={title}
        disabled={pending}
        className={cn(buttonClasses(variant, size), className)}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            try {
              const res = (await action()) as { ok?: boolean; message?: string } | undefined;
              if (res && res.ok === false && res.message) setError(res.message);
            } catch (e) {
              // redirect() lança um erro especial que o Next trata; repassamos.
              if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
              setError((e as Error).message);
            }
          });
        }}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
      {error && <span className="mt-1 max-w-xs text-xs text-blood-300">{error}</span>}
    </span>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p role="status" className={cn("rounded-md border px-3 py-2 text-sm", state.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-blood-600/50 bg-blood-600/10 text-blood-300")}>
      {state.message}
    </p>
  );
}
