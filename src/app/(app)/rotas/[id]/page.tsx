import { AlertTriangle, ArrowDown, ArrowUp, Clock, Pencil, UserMinus, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { DIAS_SEMANA, bairroAtendido, nomeCompleto, um } from "@/lib/dados";
import { reais } from "@/lib/format";
import { atribuirClientes, moverParada, removerDaRota } from "../actions";
import RotaForm from "../RotaForm";

export default async function Rota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirEquipe();
  const { data: rota } = await supabase.from("rotas").select("*").eq("id", id).single();
  if (!rota) notFound();

  const [{ data: membros }, { data: candidatos }, { data: todas }, { data: usuarios }] = await Promise.all([
    supabase.from("atribuicoes_rota").select("id, ordem, cliente_id, clientes(nome, sobrenome, bairro, logradouro, numero, instrucoes_entrega, assinaturas(status, valor_centavos, planos(paes_por_semana, modalidade)))").eq("rota_id", id).is("fim", null).order("ordem"),
    supabase.from("assinaturas").select("cliente_id, clientes(nome, sobrenome, bairro, status), planos!inner(modalidade)").eq("status", "ativa").eq("planos.modalidade", "entrega"),
    supabase.from("atribuicoes_rota").select("cliente_id, rota_id, rotas(nome)").is("fim", null),
    supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const rotaAtual = new Map((todas ?? []).map((t) => [t.cliente_id, (um(t.rotas as never) as { nome: string } | null)?.nome]));
  const nestaRota = new Set((membros ?? []).map((m) => m.cliente_id));
  const unicos = new Map<string, { id: string; c: { nome: string; sobrenome: string; bairro: string | null; status: string } }>();
  for (const a of candidatos ?? []) {
    const c = um(a.clientes as never) as { nome: string; sobrenome: string; bairro: string | null; status: string } | null;
    if (c && c.status === "ativo" && !nestaRota.has(a.cliente_id)) unicos.set(a.cliente_id, { id: a.cliente_id, c });
  }
  const lista = [...unicos.values()].sort((x, y) => Number(!!rotaAtual.get(x.id)) - Number(!!rotaAtual.get(y.id)) || x.c.nome.localeCompare(y.c.nome));

  let paes = 0, valor = 0;
  for (const m of membros ?? []) {
    const c = um(m.clientes as never) as { assinaturas: { status: string; valor_centavos: number; planos: { paes_por_semana: number; modalidade: string } | null }[] } | null;
    for (const a of c?.assinaturas ?? []) {
      const pl = um(a.planos as never) as { paes_por_semana: number; modalidade: string } | null;
      if (a.status === "ativa" && pl?.modalidade === "entrega") { paes += pl.paes_por_semana; valor += a.valor_centavos; }
    }
  }
  const entregador = usuarios?.find((u) => u.id === rota.entregador_id);
  const cap = rota.capacidade_paes as number | null;

  return (
    <>
      <PageHeader
        voltar={{ href: "/rotas", rotulo: "Rotas" }}
        titulo={<span className="flex items-center gap-3"><span className="size-4 rounded-full" style={{ background: rota.cor }} />{rota.nome}</span>}
        etiqueta={!rota.ativa ? <Badge>Inativa</Badge> : undefined}
        subtitulo={<span className="flex items-center gap-1.5"><Clock size={14} />{rota.dia_semana != null ? DIAS_SEMANA[rota.dia_semana] : "Sem dia definido"}{rota.janela_inicio && ` · ${rota.janela_inicio.slice(0, 5)}–${rota.janela_fim?.slice(0, 5) ?? ""}`}{rota.descricao && ` · ${rota.descricao}`}</span>}
        acoes={
          <Modal titulo="Editar rota" gatilho={<><Pencil size={15} />Editar rota</>} largo>
            <RotaForm rota={rota} entregadores={usuarios ?? []} />
          </Modal>
        }
      />

      <div className="mb-5 grid grid-cols-4 gap-3">
        <Stat rotulo="Paradas" valor={membros?.length ?? 0} />
        <Stat rotulo="Pães por semana" valor={cap ? `${paes} / ${cap}` : paes} detalhe={cap && paes > cap ? <span className="text-red-700">Acima da capacidade</span> : undefined} tom={cap && paes > cap ? "vermelho" : "neutro"} />
        <Stat rotulo="Receita mensal" valor={reais(valor)} />
        <div className="cartao !p-4">
          <div className="text-[13px] text-stone-500">Entregador</div>
          {entregador ? <div className="mt-1 flex items-center gap-2 font-semibold"><Avatar nome={entregador.nome} tamanho={26} />{entregador.nome}</div>
            : <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-amber-800"><AlertTriangle size={15} />Defina em “Editar rota”</div>}
        </div>
      </div>

      <section className="cartao overflow-hidden !p-0">
        <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
          <h2 className="font-semibold">Paradas <span className="font-normal text-stone-400">na ordem de entrega</span></h2>
          <div className="ml-auto">
            <Modal titulo="Adicionar clientes à rota" descricao="Clientes de entrega ativos. Quem já está em outra rota é movido para esta." gatilho={<><UserPlus size={16} />Adicionar clientes</>} gatilhoClasse="btn" largo>
              <form action={atribuirClientes} className="flex flex-col gap-4">
                <input type="hidden" name="rota_id" value={id} />
                <div className="max-h-80 overflow-y-auto rounded-xl border border-stone-200">
                  {lista.map(({ id: cid, c }) => (
                    <label key={cid} className="flex cursor-pointer items-center gap-3 border-b border-stone-100 px-3 py-2.5 last:border-0 hover:bg-amber-50/50">
                      <input type="checkbox" name="cliente_id" value={cid} className="size-4 accent-amber-700" />
                      <Avatar nome={nomeCompleto(c)} tamanho={28} />
                      <span className="flex-1"><span className="font-medium">{nomeCompleto(c)}</span><span className="ml-2 text-sm text-stone-500">{c.bairro}</span></span>
                      {rotaAtual.get(cid) ? <Badge tom="cinza">hoje: {rotaAtual.get(cid)}</Badge> : <Badge tom="ambar">sem rota</Badge>}
                    </label>
                  ))}
                  {!lista.length && <p className="p-4 text-sm text-stone-500">Todos os clientes de entrega já estão nesta rota.</p>}
                </div>
                <div className="flex justify-end"><SubmitButton>Adicionar à rota</SubmitButton></div>
              </form>
            </Modal>
          </div>
        </header>
        {!membros?.length ? (
          <Vazio titulo="Nenhuma parada" texto="Adicione clientes de entrega a esta rota." />
        ) : (
          <ol className="divide-y divide-stone-100">
            {membros.map((m, i) => {
              const c = um(m.clientes as never) as { nome: string; sobrenome: string; bairro: string | null; logradouro: string | null; numero: string | null; instrucoes_entrega: string | null } | null;
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50/60">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: rota.cor }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/clientes/${m.cliente_id}`} className="font-medium hover:underline">{nomeCompleto(c)}</Link>
                    <div className="truncate text-sm text-stone-500">{[c?.logradouro && `${c.logradouro} ${c.numero ?? ""}`.trim(), c?.bairro].filter(Boolean).join(" · ")}{c?.instrucoes_entrega && ` · ${c.instrucoes_entrega}`}</div>
                    {!bairroAtendido(c?.bairro) && <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-800"><AlertTriangle size={12} />Bairro fora da lista atendida pela bike</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {(["cima", "baixo"] as const).map((dir) => (
                      <form key={dir} action={moverParada}>
                        <input type="hidden" name="rota_id" value={id} /><input type="hidden" name="atribuicao_id" value={m.id} /><input type="hidden" name="dir" value={dir} />
                        <SubmitButton className="btn-ghost !p-2"><span className="sr-only">Mover para {dir}</span>{dir === "cima" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</SubmitButton>
                      </form>
                    ))}
                    <form action={removerDaRota}>
                      <input type="hidden" name="rota_id" value={id} /><input type="hidden" name="atribuicao_id" value={m.id} />
                      <SubmitButton className="btn-ghost !p-2 hover:!bg-red-50 hover:!text-red-700"><span className="sr-only">Remover da rota</span><UserMinus size={16} /></SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
