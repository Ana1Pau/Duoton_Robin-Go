import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Katerbot — despensa agéntica con Reap",
  description: "Katerbot: agente que administra tu despensa y gasto de comida y compra con Reap Agentic Payments.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#15803d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <I18nProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-3 pb-16 pt-4 sm:px-6">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
