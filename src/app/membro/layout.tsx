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
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="mx-auto min-h-screen max-w-md px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <RegistrarSW arquivo="/sw-membro.js" escopo="/membro" />
        {children}
      </div>
    </div>
  );
}
