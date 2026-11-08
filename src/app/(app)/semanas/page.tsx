import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import Badge, { type Tom } from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { dataBR, hojeISO } from "@/lib/format";
import { STATUS_SEMANA } from "@/lib/semana";

const TOM: Record<string, Tom> = { planejada: "cinza", em_producao: "azul", entregue: "verde", encerrada: "cinza" };

export default async function Semanas() {
  const { supabase } = await exigirEquipe();
  const hoje = hojeISO();
  const { data } = await supabase.from("semanas").select("id, inicio, fim, sabor, status, sem_producao").order("inicio", { ascending: false }).limit(60);
  return (
    <>
      <PageHeader
        titulo="Semanas"
        etiqueta={<Badge tom="cinza">Passo 2 · Planejar</Badge>}
        subtitulo="Cada semana tem um sabor, as entregas geradas a partir das assinaturas e as listas de produção, entrega e coleta."
        acoes={<Link href="/semanas/nova" className="btn"><Plus size={16} />Nova semana</Link>}
      />
      <div className="cartao overflow-hidden !p-0">
        {!data?.length ? (
          <Vazio icone={CalendarDays} titulo="Nenhuma semana criada" texto="Crie a primeira semana para definir o sabor e gerar as entregas." acao={<Link href="/semanas/nova" className="btn"><Plus size={16} />Nova semana</Link>} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.map((s) => {
              const atual = s.inicio <= hoje && hoje <= s.fim;
              return (
                <li key={s.id}>
                  <Link href={`/semanas/${s.id}`} className={`flex items-center gap-4 px-5 py-4 transition hover:bg-amber-50/40 ${atual ? "bg-amber-50/30" : ""}`}>
                    <span className={`flex size-11 flex-col items-center justify-center rounded-xl text-xs leading-tight ${atual ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"}`}>
                      <b className="text-base">{s.inicio.slice(8, 10)}</b>{new Date(`${s.inicio}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" })}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{s.sem_producao ? "Sem produção" : (s.sabor ?? <span className="text-stone-400">Sabor a definir</span>)}</div>
                      <div className="text-sm text-stone-500">{dataBR(s.inicio)} a {dataBR(s.fim)}</div>
                    </div>
                    {atual && <Badge tom="ambar" ponto>Esta semana</Badge>}
                    <Badge tom={TOM[s.status]}>{STATUS_SEMANA[s.status]}</Badge>
                    <ChevronRight size={18} className="text-stone-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
