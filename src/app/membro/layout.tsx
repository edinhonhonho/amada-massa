import type { Metadata } from "next";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "Amada Massa — Clube do Pão",
  manifest: "/membro.webmanifest",
  appleWebApp: { capable: true, title: "Amada Massa", statusBarStyle: "default" },
};

export default function MembroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-16">
      <RegistrarSW arquivo="/sw-membro.js" escopo="/membro" />
      {children}
    </div>
  );
}
