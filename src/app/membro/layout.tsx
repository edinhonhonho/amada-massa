import type { Metadata } from "next";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "Amada Massa",
  description: "Central de avisos do Clube do Pão",
  manifest: "/membro.webmanifest",
  appleWebApp: { capable: true, title: "Amada Massa", statusBarStyle: "default" },
};

export default function MembroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-50">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-16">
        <RegistrarSW arquivo="/sw-membro.js" escopo="/membro" />
        {children}
      </div>
    </div>
  );
}
