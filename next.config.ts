import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Voltar a uma tela já vista nos últimos 30 s é instantâneo. Salvar algo revalida o cache.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
