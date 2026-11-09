import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAIXAS_PADRAO, type Faixas } from "@/lib/pagamentos";

/**
 * Configurações mudam raramente e são lidas em quase toda tela (faixas de atraso).
 * Ficam em cache no servidor por 5 minutos e são renovadas na hora quando alguém as altera.
 * Lê com a chave de serviço porque o cache é compartilhado entre usuários; só leva números de configuração.
 */
export const faixasEmCache = unstable_cache(
  async (): Promise<Faixas> => {
    const { data } = await createAdminClient().from("configuracoes").select("chave, valor");
    const m = Object.fromEntries((data ?? []).map((c) => [c.chave, c.valor as number]));
    return {
      aVencerDias: m.a_vencer_dias ?? FAIXAS_PADRAO.aVencerDias,
      atrasoCriticoDias: m.atraso_critico_dias ?? FAIXAS_PADRAO.atrasoCriticoDias,
      carenciaDias: m.carencia_dias ?? FAIXAS_PADRAO.carenciaDias,
    };
  },
  ["faixas-de-atraso"],
  { tags: ["configuracoes"], revalidate: 300 },
);

export const renovarConfiguracoes = () => revalidateTag("configuracoes");
