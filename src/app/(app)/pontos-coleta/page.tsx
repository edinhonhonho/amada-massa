import { Clock, MapPin, Pencil, Phone, Plus, Store, User } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import { DIAS_CURTO, ORDEM_DIAS, type Janela } from "@/lib/horarios";
import PontoForm, { type Ponto } from "./PontoForm";

export default async function Pontos({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { supabase } = await exigirEquipe();
  const { erro } = await searchParams;
  const { data } = await supabase.from("pontos_coleta").select("*").order("tipo").order("nome");
  const pontos = (data ?? []) as Ponto[];
  const temPadaria = pontos.some((p) => p.tipo === "padaria");

  return (
    <>
      <PageHeader
        titulo="Pontos de coleta"
        subtitulo="Onde os clientes de coleta retiram o pão. A coleta na padaria usa sempre a Padaria; a coleta em ponto usa um ponto de retirada."
        acoes={<Modal titulo="Novo ponto de coleta" gatilho={<><Plus size={16} />Novo ponto</>} gatilhoClasse="btn" largo><PontoForm temPadaria={temPadaria} /></Modal>}
      />
      {erro && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      <div className="grid grid-cols-2 gap-4">
        {pontos.map((p) => {
          const h = (p.horarios ?? []) as Janela[];
          return (
            <article key={p.id} className={`cartao flex flex-col gap-3 ${p.ativo ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">{p.tipo === "padaria" ? <Store size={18} /> : <MapPin size={18} />}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold leading-tight">{p.nome}</h2>
                  <p className="text-sm text-stone-500">{p.endereco}{p.cep ? ` · CEP ${p.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : ""}</p>
                </div>
                <Badge tom={p.tipo === "padaria" ? "ambar" : "cinza"}>{p.tipo === "padaria" ? "Padaria" : "Ponto de retirada"}</Badge>
                {!p.ativo && <Badge>Inativo</Badge>}
              </div>
              {h.length > 0 ? (
                <div className="rounded-xl bg-stone-50 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400"><Clock size={12} />Funcionamento</div>
                  <ul className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    {ORDEM_DIAS.filter((d) => h.some((j) => j.dia === d)).map((d) => (
                      <li key={d} className="contents">
                        <span className="font-medium text-stone-700">{DIAS_CURTO[d]}</span>
                        <span className="text-stone-600">{h.filter((j) => j.dia === d).sort((a, b) => a.abre.localeCompare(b.abre)).map((j) => `${j.abre}–${j.fecha}`).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="text-sm text-stone-400">Horário não informado.</p>}
              {(p.responsavel || p.telefone || p.referencia) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                  {p.responsavel && <span className="flex items-center gap-1.5"><User size={13} />{p.responsavel}</span>}
                  {p.telefone && <span className="flex items-center gap-1.5"><Phone size={13} />{p.telefone}</span>}
                  {p.referencia && <span>Ref.: {p.referencia}</span>}
                </div>
              )}
              <div className="mt-auto pt-1">
                <Modal titulo="Editar ponto de coleta" gatilho={<><Pencil size={14} />Editar</>} gatilhoClasse="btn-sec btn-pequeno" largo><PontoForm p={p} temPadaria={temPadaria} /></Modal>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
