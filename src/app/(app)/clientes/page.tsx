import Link from "next/link";
import { exigirEquipe } from "@/lib/auth";
import { MODALIDADES, STATUS_CLIENTE, linkWhatsApp, soDigitos } from "@/lib/format";

type Busca = { q?: string; status?: string; modalidade?: string; bairro?: string };

export default async function Clientes({ searchParams }: { searchParams: Promise<Busca> }) {
  const { supabase } = await exigirEquipe();
  const { q, status, modalidade, bairro } = await searchParams;

  let query = supabase
    .from("clientes")
    .select("id, nome, sobrenome, whatsapp, bairro, status, assinaturas(status, planos(modalidade, paes_por_semana))")
    .order("nome")
    .limit(500);
  if (status) query = query.eq("status", status);
  if (bairro) query = query.ilike("bairro", `%${bairro.replace(/[%,()]/g, "")}%`);
  if (q) {
    const t = q.replace(/[%,()*]/g, "").trim();
    const d = soDigitos(t);
    const partes = [`nome.ilike.%${t}%`, `sobrenome.ilike.%${t}%`];
    if (d.length >= 3) partes.push(`whatsapp.ilike.%${d}%`);
    query = query.or(partes.join(","));
  }
  const { data } = await query;

  type Linha = NonNullable<typeof data>[number];
  const plano = (c: Linha) => {
    const a = (c.assinaturas as unknown as { status: string; planos: { modalidade: keyof typeof MODALIDADES; paes_por_semana: number } | null }[]).find((x) => x.status !== "cancelada" && x.status !== "encerrada");
    return a?.planos ?? null;
  };
  const lista = (data ?? []).filter((c) => !modalidade || plano(c)?.modalidade === modalidade);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes <span className="text-base font-normal text-stone-500">({lista.length})</span></h1>
        <Link href="/clientes/novo" className="btn">Novo cliente</Link>
      </div>
      <form className="cartao grid gap-3 sm:grid-cols-5">
        <input className="campo sm:col-span-2" name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" />
        <select className="campo" name="status" defaultValue={status ?? ""}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="campo" name="modalidade" defaultValue={modalidade ?? ""}>
          <option value="">Todas as modalidades</option>
          {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="campo" name="bairro" defaultValue={bairro} placeholder="Bairro" />
        <button className="btn sm:col-span-5 sm:justify-self-start">Filtrar</button>
      </form>
      <ul className="cartao divide-y divide-stone-100 p-0">
        {!lista.length && <li className="p-4 text-stone-500">Nenhum cliente encontrado.</li>}
        {lista.map((c) => {
          const p = plano(c);
          const wa = linkWhatsApp(c.whatsapp);
          return (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.nome} {c.sobrenome}</div>
                <div className="truncate text-sm text-stone-600">
                  {p ? `${MODALIDADES[p.modalidade]} · ${p.paes_por_semana} pão/sem` : "Sem assinatura ativa"}
                  {c.bairro && ` · ${c.bairro}`}
                </div>
              </Link>
              <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "ativo" ? "bg-green-100 text-green-800" : c.status === "pausado" ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-700"}`}>
                {STATUS_CLIENTE[c.status as keyof typeof STATUS_CLIENTE]}
              </span>
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-sec px-3 py-1.5 text-sm">WhatsApp</a>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
