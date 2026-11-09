import type { Metadata } from "next";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "Amada Massa — Entregador",
  manifest: "/entregador.webmanifest",
  appleWebApp: { capable: true, title: "Entregas", statusBarStyle: "default" },
};

export default function EntregadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        <RegistrarSW arquivo="/sw-entregador.js" escopo="/entregador" />
        {children}
      </div>
    </div>
  );
}
