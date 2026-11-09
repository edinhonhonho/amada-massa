import { MapPin, Pencil, Phone, Plus, Store, User } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { DIAS_CURTO, ORDEM_DIAS, type Janela } from "@/lib/horarios";
import PontoForm, { type Ponto } from "./PontoForm";

const cepFmt = (c: string | null) => (c ? c.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null);

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
        subtitulo="Onde os clientes retiram o pão: a padaria e os pontos parceiros."
        acoes={<Modal titulo="Novo ponto de coleta" gatilho={<><Plus size={16} />Novo ponto</>} gatilhoClasse="btn" largo><PontoForm temPadaria={temPadaria} /></Modal>}
      />
      {erro && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">{erro}</p>}

      {!pontos.length ? (
        <div className="cartao"><Vazio icone={MapPin} titulo="Nenhum ponto cadastrado" texto="Cadastre a padaria e os pontos de retirada para poder criar clientes de coleta." /></div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-5">
          {pontos.map((p) => {
            const h = (p.horarios ?? []) as Janela[];
            const padaria = p.tipo === "padaria";
            return (
              <article key={p.id} className={`cartao overflow-hidden !p-0 transition hover:shadow-lg ${p.ativo ? "" : "opacity-60"}`}>
                <header className={`flex items-start gap-3 px-5 py-4 ${padaria ? "bg-gradient-to-r from-rose-50 to-white" : "bg-gradient-to-r from-teal-50 to-white"}`}>
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${padaria ? "bg-rose-100 text-rose-800" : "bg-teal-100 text-teal-800"}`}>{padaria ? <Store size={20} /> : <MapPin size={20} />}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[17px] font-semibold leading-tight tracking-tight">{p.nome}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tom={padaria ? "vermelho" : "verde"}>{padaria ? "Padaria" : "Ponto de retirada"}</Badge>
                      {!p.ativo && <Badge>Inativo</Badge>}
                    </div>
                  </div>
                  <Modal titulo="Editar ponto de coleta" gatilho={<Pencil size={15} />} gatilhoClasse="btn-ghost !p-2" largo><PontoForm p={p} temPadaria={temPadaria} /></Modal>
                </header>

                <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-stone-400" />
                    <div>
                      <div className="text-stone-800">{[p.logradouro && `${p.logradouro}${p.numero ? `, ${p.numero}` : ""}`, p.complemento].filter(Boolean).join(" - ") || p.endereco}</div>
                      <div className="text-stone-500">{[p.bairro, p.cidade].filter(Boolean).join(", ")}{cepFmt(p.cep) ? ` · CEP ${cepFmt(p.cep)}` : ""}</div>
                      {p.referencia && <div className="text-xs text-stone-400">Ref.: {p.referencia}</div>}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs font-medium text-stone-500">Funcionamento</div>
                    {h.length ? (
                      <div className="grid grid-cols-7 gap-1.5">
                        {ORDEM_DIAS.map((d) => {
                          const js = h.filter((j) => j.dia === d).sort((a, b) => a.abre.localeCompare(b.abre));
                          return (
                            <div key={d} className={`rounded-lg px-1 py-1.5 text-center ${js.length ? "bg-emerald-50 shadow-sm" : "bg-stone-50"}`}>
                              <div className={`text-[11px] font-semibold ${js.length ? "text-emerald-800" : "text-stone-400"}`}>{DIAS_CURTO[d]}</div>
                              {js.length ? js.map((j, i) => <div key={i} className="text-[10.5px] leading-tight text-emerald-900"><div>{j.abre}</div><div className="text-emerald-700/70">{j.fecha}</div></div>) : <div className="text-xs text-stone-300">—</div>}
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-sm text-stone-400">Horário não informado.</p>}
                  </div>

                  {(p.responsavel || p.telefone) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-stone-100 pt-3 text-sm text-stone-600">
                      {p.responsavel && <span className="flex items-center gap-1.5"><User size={14} className="text-stone-400" />{p.responsavel}</span>}
                      {p.telefone && <span className="flex items-center gap-1.5"><Phone size={14} className="text-stone-400" />{p.telefone}</span>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
