import type { Metadata } from "next";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "Amada Massa — Entregador",
  manifest: "/entregador.webmanifest",
  appleWebApp: { capable: true, title: "Entregas", statusBarStyle: "default" },
};

export default function EntregadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md px-3 pb-24">
      <RegistrarSW arquivo="/sw-entregador.js" escopo="/entregador" />
      {children}
    </div>
  );
}
