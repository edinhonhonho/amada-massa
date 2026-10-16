import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amada Massa — Clube do Pão",
  description: "Gestão interna do Clube de Pães Amada Massa",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
