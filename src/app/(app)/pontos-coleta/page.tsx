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
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          {pontos.map((p) => {
            const h = (p.horarios ?? []) as Janela[];
            const padaria = p.tipo === "padaria";
            const cor = padaria ? { tile: "bg-rose-100 text-rose-700", dia: "text-rose-700" } : { tile: "bg-teal-100 text-teal-700", dia: "text-teal-700" };
            return (
              <article key={p.id} className={`flex flex-col gap-5 rounded-[24px] bg-painel p-5 ring-1 ring-stone-900/[0.04] transition hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,.35)] hover:ring-stone-900/10 ${p.ativo ? "" : "opacity-60"}`}>
                <header className="flex items-start gap-3.5">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${cor.tile}`}>{padaria ? <Store size={20} /> : <MapPin size={20} />}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[17px] font-semibold leading-tight tracking-tight">{p.nome}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tom={padaria ? "vermelho" : "verde"}>{padaria ? "Padaria" : "Ponto de retirada"}</Badge>
                      {!p.ativo && <Badge>Inativo</Badge>}
                    </div>
                  </div>
                  <Modal titulo="Editar ponto de coleta" gatilho={<Pencil size={15} />} gatilhoClasse="btn-ghost !p-2" largo><PontoForm p={p} temPadaria={temPadaria} /></Modal>
                </header>

                <div className="flex items-start gap-3 text-sm">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-stone-400" />
                  <div className="min-w-0">
                    <div className="font-medium text-stone-800">{[p.logradouro && `${p.logradouro}${p.numero ? `, ${p.numero}` : ""}`, p.complemento].filter(Boolean).join(" - ") || p.endereco}</div>
                    <div className="text-stone-500">{[p.bairro, p.cidade].filter(Boolean).join(", ")}{cepFmt(p.cep) ? ` · CEP ${cepFmt(p.cep)}` : ""}</div>
                    {p.referencia && <div className="mt-0.5 text-xs text-stone-400">Ref.: {p.referencia}</div>}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-stone-400">Funcionamento</div>
                  {h.length ? (
                    <div className="grid grid-cols-7 gap-1.5">
                      {ORDEM_DIAS.map((d) => {
                        const js = h.filter((j) => j.dia === d).sort((a, b) => a.abre.localeCompare(b.abre));
                        return js.length ? (
                          <div key={d} className="cartao-branco px-1 py-2 text-center">
                            <div className={`text-[11px] font-semibold ${cor.dia}`}>{DIAS_CURTO[d]}</div>
                            {js.map((j, i) => <div key={i} className="mt-1 text-[10.5px] leading-tight text-stone-700"><div>{j.abre}</div><div className="text-stone-400">{j.fecha}</div></div>)}
                          </div>
                        ) : (
                          <div key={d} className="px-1 py-2 text-center"><div className="text-[11px] font-medium text-stone-300">{DIAS_CURTO[d]}</div><div className="mt-1 text-xs text-stone-300">—</div></div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-stone-400">Horário não informado.</p>}
                </div>

                {(p.responsavel || p.telefone) && (
                  <div className="flex flex-wrap gap-2">
                    {p.responsavel && <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] text-stone-600 shadow-[0_0_0_1px_rgba(28,25,23,.06)]"><User size={13} className="text-stone-400" />{p.responsavel}</span>}
                    {p.telefone && <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] text-stone-600 shadow-[0_0_0_1px_rgba(28,25,23,.06)]"><Phone size={13} className="text-stone-400" />{p.telefone}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
