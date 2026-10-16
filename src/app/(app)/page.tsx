import Link from "next/link";
import { usuarioAtual } from "@/lib/auth";
import { redirect } from "next/navigation";
import { dataBR, hojeISO } from "@/lib/format";

export default async function Inicio() {
  const { supabase, usuario } = await usuarioAtual();
  if (usuario.perfil === "entregador") redirect("/entregas");

  const [{ count: ativos }, { count: pausados }, { count: cancelados }, { data: retornos }] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "pausado"),
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "cancelado"),
    supabase
      .from("contatos")
      .select("id, proximo_passo, proximo_passo_em, cliente_id, clientes(nome, sobrenome)")
      .eq("concluido", false)
      .not("proximo_passo_em", "is", null)
      .lte("proximo_passo_em", hojeISO())
      .order("proximo_passo_em")
      .limit(20),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Início</h1>
      <div className="grid grid-cols-3 gap-3">
        {[["Ativos", ativos], ["Pausados", pausados], ["Cancelados", cancelados]].map(([t, n]) => (
          <div key={t as string} className="cartao text-center">
            <div className="text-3xl font-bold text-amber-800">{n ?? 0}</div>
            <div className="text-sm text-stone-600">{t}</div>
          </div>
        ))}
      </div>
      <section className="cartao">
        <h2 className="mb-2 font-semibold">Contatos com próximo passo vencido</h2>
        {!retornos?.length && <p className="text-stone-500">Nada pendente.</p>}
        <ul className="divide-y divide-stone-100">
          {retornos?.map((c) => {
            const cli = c.clientes as unknown as { nome: string; sobrenome: string } | null;
            return (
              <li key={c.id} className="py-2">
                <Link href={`/clientes/${c.cliente_id}`} className="font-medium hover:underline">
                  {cli?.nome} {cli?.sobrenome}
                </Link>
                <span className="text-stone-600"> — {c.proximo_passo} ({dataBR(c.proximo_passo_em)})</span>
              </li>
            );
          })}
        </ul>
      </section>
      <Link href="/clientes/novo" className="btn self-start">Novo cliente</Link>
    </div>
  );
}
