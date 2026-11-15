import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl border border-ink-700 bg-ink-850/80 shadow-[0_1px_0_0_rgb(255_255_255/0.03)_inset]", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-700 px-5 py-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-blood-500">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide text-ink-100 uppercase">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

type Tone = "neutral" | "red" | "blue" | "green" | "amber" | "demo";
const toneClasses: Record<Tone, string> = {
  neutral: "bg-ink-700 text-ink-200 border-ink-600",
  red: "bg-blood-600/15 text-blood-300 border-blood-600/40",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  demo: "bg-amber-400 text-black border-amber-300 font-bold tracking-wider",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none whitespace-nowrap", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <Badge tone="demo" title="Dado fictício para demonstração — não representa informação real.">
      DEMONSTRAÇÃO
    </Badge>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variantClasses: Record<Variant, string> = {
  primary: "bg-blood-600 text-white hover:bg-blood-500 border-blood-500 shadow-[0_0_0_1px_rgb(224_30_45/0.3),0_8px_24px_-8px_rgb(224_30_45/0.5)]",
  secondary: "bg-ink-700 text-ink-100 hover:bg-ink-600 border-ink-600",
  ghost: "bg-transparent text-ink-200 hover:bg-ink-700 border-transparent",
  danger: "bg-transparent text-blood-300 hover:bg-blood-600/15 border-blood-600/40",
};

export function buttonClasses(variant: Variant = "primary", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
    variantClasses[variant],
  );
}

export function Button({ variant = "primary", size = "md", className, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button className={cn(buttonClasses(variant, size), className)} {...rest} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link className={cn(buttonClasses(variant, size), className)} {...rest} />;
}

export function PageHeader({ title, eyebrow, description, actions }: { title: ReactNode; eyebrow?: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-blood-500 uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-600 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <p className="text-sm font-medium text-ink-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, icon, accent }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; accent?: boolean }) {
  return (
    <Card className={cn("relative overflow-hidden p-4", accent && "border-blood-600/40")}>
      {accent && <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-blood-600/20 blur-2xl" />}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{label}</p>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <p className="tabular mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}

export function Field({ label, error, hint, children, className, required }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
        {required && <span className="ml-0.5 text-blood-400">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-blood-300">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | "success"; title?: ReactNode; children: ReactNode }) {
  const tones = {
    info: "border-ink-600 bg-ink-800 text-ink-200",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    danger: "border-blood-600/50 bg-blood-600/10 text-blood-300",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-[13px] leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

export function Avatar({ name, corner, size = "md" }: { name: string; corner?: "red" | "blue"; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const sizes = { sm: "h-8 w-8 text-[11px]", md: "h-11 w-11 text-sm", lg: "h-20 w-20 text-2xl" };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border font-bold text-white",
        sizes[size],
        corner === "blue" ? "border-blue-500/50 bg-gradient-to-br from-blue-600/40 to-ink-800" : corner === "red" ? "border-blood-500/50 bg-gradient-to-br from-blood-600/40 to-ink-800" : "border-ink-600 bg-gradient-to-br from-ink-600 to-ink-800",
      )}
    >
      {initials}
    </div>
  );
}
