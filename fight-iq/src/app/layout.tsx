import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { getAIStatus } from "@/lib/ai";
import { getBackendStatus } from "@/lib/data";
import { getShowDemo } from "@/lib/services/preferences";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "FIGHT IQ — MMA Analytics & Fight Intelligence", template: "%s · FIGHT IQ" },
  description: "Plataforma de inteligência esportiva para análise técnica de confrontos de MMA.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const backend = getBackendStatus();
  const ai = getAIStatus();
  const showDemo = await getShowDemo();
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Sidebar
          status={{
            backend: backend.backend === "local" ? "Local (JSON)" : backend.configured ? "Supabase" : "Supabase (não configurado)",
            ai: ai.configured ? ai.label : "Não configurada",
            aiConfigured: ai.configured,
            showDemo,
          }}
        />
        <div className="bg-grid min-h-screen lg:pl-64">
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
