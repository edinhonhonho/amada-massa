import Link from "next/link";
import { exigirEquipe } from "@/lib/auth";
import { dataBR } from "@/lib/format";
import { STATUS_SEMANA } from "@/lib/semana";

export default async function Semanas() {
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("semanas").select("id, inicio, fim, sabor, status, sem_producao").order("inicio", { ascending: false }).limit(60);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Semanas</h1>
        <Link href="/semanas/nova" className="btn">Nova semana</Link>
      </div>
      <ul className="cartao divide-y divide-stone-100 p-0">
        {data?.map((s) => (
          <li key={s.id}>
            <Link href={`/semanas/${s.id}`} className="flex items-center gap-3 p-3 hover:bg-stone-50">
              <div className="flex-1">
                <div className="font-medium">{dataBR(s.inicio)} a {dataBR(s.fim)}</div>
                <div className="text-sm text-stone-600">{s.sem_producao ? "Sem produção" : (s.sabor ?? "Sabor a definir")}</div>
              </div>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{STATUS_SEMANA[s.status]}</span>
            </Link>
          </li>
        ))}
        {!data?.length && <li className="p-4 text-stone-500">Nenhuma semana criada.</li>}
      </ul>
    </div>
  );
}
