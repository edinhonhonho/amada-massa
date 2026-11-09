import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Telas já vistas (ou pré-carregadas pelo menu) abrem na hora por 2 minutos.
    // Salvar qualquer coisa pelo sistema renova o cache; mudanças feitas por outras pessoas aparecem em até 2 min.
    staleTimes: { dynamic: 120, static: 300 },
  },
  async redirects() {
    // "Semanas" virou "Planejamento": mantém links antigos funcionando.
    return [
      { source: "/semanas", destination: "/planejamento", permanent: true },
      { source: "/semanas/:path*", destination: "/semana/:path*", permanent: true },
      // endereços antigos da semana e do catálogo de pães
      { source: "/planejamento/paes", destination: "/paes", permanent: true },
      { source: "/planejamento/:id([0-9a-f-]{36})/:resto*", destination: "/semana/:id/:resto*", permanent: true },
    ];
  },
};

export default nextConfig;
