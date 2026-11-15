"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Database, FileUp, History, LayoutDashboard, Menu, Settings, Swords, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lutadores", label: "Lutadores", icon: Users },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/analyzer", label: "Fight Analyzer", icon: Swords, highlight: true },
  { href: "/historico", label: "Histórico", icon: History },
];
const NAV_DATA = [
  { href: "/importar", label: "Importar CSV", icon: FileUp },
  { href: "/fontes", label: "Fontes de dados", icon: Database },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-blood-600 shadow-[0_0_24px_-4px_rgb(224_30_45/0.7)]">
        <span className="text-[13px] font-black tracking-tighter text-white">IQ</span>
      </div>
      <div className="leading-none">
        <p className="text-[17px] font-black tracking-tight text-white">
          FIGHT <span className="text-blood-500">IQ</span>
        </p>
        <p className="mt-1 text-[8.5px] font-semibold tracking-[0.18em] text-ink-400">MMA ANALYTICS & FIGHT INTELLIGENCE</p>
      </div>
    </Link>
  );
}

export function Sidebar({ status }: { status: { backend: string; ai: string; aiConfigured: boolean; showDemo: boolean } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const renderLinks = (items: typeof NAV) =>
    items.map(({ href, label, icon: Icon, ...rest }) => (
      <Link
        key={href}
        href={href}
        className={cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
          isActive(href) ? "bg-blood-600/15 text-white ring-1 ring-blood-600/40" : "text-ink-300 hover:bg-ink-800 hover:text-white",
        )}
      >
        <Icon className={cn("h-4 w-4", isActive(href) ? "text-blood-500" : "text-ink-400 group-hover:text-ink-200")} />
        <span className="flex-1">{label}</span>
        {"highlight" in rest && rest.highlight && <span className="h-1.5 w-1.5 rounded-full bg-blood-500" />}
      </Link>
    ));

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 scrollbar-thin">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.2em] text-ink-500 uppercase">Análise</p>
          {renderLinks(NAV)}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.2em] text-ink-500 uppercase">Dados</p>
          {renderLinks(NAV_DATA)}
        </div>
      </nav>
      <div className="m-3 space-y-1.5 rounded-lg border border-ink-700 bg-ink-900 p-3 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-ink-400">Banco</span>
          <span className="font-medium text-ink-200">{status.backend}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-400">IA</span>
          <span className={cn("flex items-center gap-1.5 font-medium", status.aiConfigured ? "text-emerald-300" : "text-ink-300")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", status.aiConfigured ? "bg-emerald-400" : "bg-ink-500")} />
            {status.ai}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-400">Demonstração</span>
          <span className="font-medium text-ink-200">{status.showDemo ? "visível" : "oculta"}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button type="button" aria-label="Abrir menu" onClick={() => setOpen(true)} className="rounded-md p-2 text-ink-200 hover:bg-ink-800">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-ink-700 bg-ink-900 lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-700 bg-ink-900">
            <button type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-md p-2 text-ink-300 hover:bg-ink-800">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
