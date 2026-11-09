import { Bell, Check, FileDown, Lock, LockOpen, MapPin, Moon, MoreHorizontal, PackageCheck, Plus, RotateCcw, Route as RouteIcon, SkipForward, Store, Trash2, Truck, Undo2, Users, Wheat, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChipsBairro from "@/components/ChipsBairro";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { dataBR } from "@/lib/format";
import { carregarSemanaCompleta, estaAtiva, type Grupo, type PaoSemana } from "@/lib/planejamento";
import { STATUS_SEMANA } from "@/lib/semana";
import {
  adicionarPaesSemana, alternarListaFechada, alternarPuloLinha, alternarSemProducao, avisarSaborMembros, excluirSemana,
  marcarRetirada, moverClientes, removerPaoSemana, restaurarDivisao, salvarQuantidades, salvarSemana,
} from "../actions";
import FormPao from "../FormPao";

const slug = (chave: string) => chave.replace(/[^a-z0-9]+/gi, "-");
const pdfHref = (semana: string, chave: string) => `/planejamento/${semana}/pdf/${slug(chave).replace(/^rota-sem$/, "rota-sem")}`;

function BadgeSituacao({ status }: { status: string }) {
  if (status === "pulada") return <Badge tom="cinza">Pulou a semana</Badge>;
  if (status === "suspensa_atraso") return <Badge tom="laranja">Suspenso por atraso</Badge>;
  if (status === "entregue" || status === "retirada") return <Badge tom="verde" ponto>{status === "entregue" ? "Entregue" : "Retirou"}</Badge>;
  if (status === "nao_entregue") return <Badge tom="vermelho">Não entregue</Badge>;
  return null;
}

function CartaoGrupo({ g, paes, semanaId, rotas }: { g: Grupo; paes: PaoSemana[]; semanaId: string; rotas: { id: string; nome: string }[] }) {
  const formId = `g-${slug(g.chave)}`;
  const entrega = g.tipo === "entrega";
  const Icone = entrega ? Truck : g.tipo === "padaria" ? Store : MapPin;
  const bairros = [...g.linhas.filter((l) => estaAtiva(l.status)).reduce((m, l) => m.set(l.bairro ?? "Sem bairro", (m.get(l.bairro ?? "Sem bairro") ?? 0) + 1), new Map<string, number>())].map(([nome, n]) => ({ nome, n }));
  const semRota = g.chave === "rota:sem";

  return (
    <section className="cartao overflow-hidden !p-0">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: g.cor ?? (semRota ? "#d97706" : g.tipo === "padaria" ? "#be123c" : g.tipo === "ponto" ? "#0f766e" : "#b45309") }}><Icone size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{semRota ? "Entrega sem rota definida" : g.nome}</h3>
          <p className="text-sm text-stone-500"><b className="text-stone-800">{g.ativos}</b> cliente{g.ativos === 1 ? "" : "s"} · <b className="text-stone-800">{g.totalPaes}</b> pães
            {paes.length > 0 && <span className="text-stone-400"> — {paes.map((p) => `${g.totais[p.id] ?? 0} ${p.nome}`).join(" · ")}</span>}</p>
        </div>
        {entrega && g.refId && <Link href={`/rotas/${g.refId}`} className="btn-sec btn-pequeno"><RouteIcon size={14} />Rota no mapa</Link>}
        <a href={pdfHref(semanaId, g.chave)} target="_blank" className="btn-sec btn-pequeno"><FileDown size={14} />PDF</a>
      </header>
      {semRota && <p className="bg-amber-50 px-5 py-2 text-sm text-amber-900">Estes clientes de entrega ainda não estão em nenhuma rota. Marque-os abaixo e mova para uma rota.</p>}

      <form id={formId} action={salvarQuantidades}>
        <input type="hidden" name="semana_id" value={semanaId} />
        <button type="submit" tabIndex={-1} className="sr-only" aria-hidden>Salvar</button>

        {entrega && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-100 bg-stone-50/60 px-5 py-2.5">
            <ChipsBairro formId={formId} bairros={bairros} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select name="destino" className="campo !w-auto !py-1.5 text-sm" defaultValue="" aria-label="Mover os marcados para">
                <option value="">Mover marcados para…</option>
                {rotas.filter((r) => r.id !== g.refId).map((r) => <option key={r.id} value={`rota:${r.id}`}>{r.nome}</option>)}
                <option value="nova">＋ Nova rota…</option>
              </select>
              <input name="nova_rota" className="campo !w-36 !py-1.5 text-sm" placeholder="Nome da nova rota" aria-label="Nome da nova rota" />
              <label className="flex items-center gap-1.5 text-xs text-stone-600"><input type="checkbox" name="permanente" className="size-3.5 accent-amber-700" />manter nas próximas semanas</label>
              <button type="submit" formAction={moverClientes} className="btn-sec btn-pequeno">Mover</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                {entrega && <th className="w-10" />}
                <th>Cliente</th>
                {entrega && <th>Endereço</th>}
                <th>Plano</th>
                {paes.map((p) => <th key={p.id} className="text-center">{p.nome}</th>)}
                <th className="text-center">Pães</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {g.linhas.map((l) => {
                const ativa = estaAtiva(l.status);
                const editavel = ativa && l.status !== "entregue" && l.status !== "retirada";
                return (
                  <tr key={l.id} className={ativa ? "" : "opacity-60"}>
                    {entrega && <td><input type="checkbox" name="entrega_id" value={l.id} data-bairro={l.bairro ?? "Sem bairro"} className="size-4 accent-amber-700" aria-label={`Selecionar ${l.nome}`} /></td>}
                    <td><Link href={`/clientes/${l.cliente_id}`} className="font-medium hover:underline">{l.nome}</Link></td>
                    {entrega && <td className="text-sm text-stone-600">{l.endereco || "—"}<span className="block text-xs text-stone-400">{l.bairro}</span></td>}
                    <td className="text-sm text-stone-600">{l.paesPlano} pão{l.paesPlano > 1 ? "es" : ""}/sem</td>
                    {paes.map((p) => {
                      const q = l.quantidades[p.id] ?? 0;
                      return (
                        <td key={p.id} className="text-center">
                          {editavel
                            ? <input key={`${l.id}-${p.id}-${q}`} type="number" min={0} max={99} inputMode="numeric" name={`q__${l.id}__${p.id}`} defaultValue={q} className="campo !w-16 !px-2 !py-1.5 text-center" aria-label={`${p.nome} para ${l.nome}`} />
                            : <span className="text-stone-500">{q}</span>}
                        </td>
                      );
                    })}
                    <td className="text-center">
                      <b className={l.manual ? "text-amber-800" : ""} title={l.manual ? "Quantidade ajustada à mão" : undefined}>{l.qtd}</b>
                      {paes.length > 0 && ativa && l.qtd !== l.paesPlano && <span className="block text-[11px] text-stone-400">plano: {l.paesPlano}</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <BadgeSituacao status={l.status} />
                        {(l.status === "programada" || l.status === "reagendada") && l.modalidade !== "entrega" && (
                          <button type="submit" formAction={marcarRetirada.bind(null, semanaId, l.id)} className="btn-ghost !px-2 !py-1 text-xs" title="Marcar que o cliente retirou"><Check size={13} />Retirou</button>
                        )}
                        {(l.status === "programada" || l.status === "reagendada") && (
                          <button type="submit" formAction={alternarPuloLinha.bind(null, semanaId, l.assinatura_id)} className="btn-ghost !px-2 !py-1 text-xs" title="Não receberá nesta semana"><SkipForward size={13} />Pular</button>
                        )}
                        {l.status === "pulada" && (
                          <button type="submit" formAction={alternarPuloLinha.bind(null, semanaId, l.assinatura_id)} className="btn-ghost !px-2 !py-1 text-xs"><Undo2 size={13} />Voltar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50/70 text-sm font-semibold">
                <td colSpan={entrega ? 4 : 2} className="px-4 py-2.5">Total</td>
                {paes.map((p) => <td key={p.id} className="px-4 py-2.5 text-center">{g.totais[p.id] ?? 0}</td>)}
                <td className="px-4 py-2.5 text-center">{g.totalPaes}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {paes.length > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-stone-100 px-5 py-3">
            <span className="text-xs text-stone-500">Altere as quantidades e salve.</span>
            <SubmitButton className="btn btn-pequeno">Salvar quantidades</SubmitButton>
          </div>
        )}
      </form>
    </section>
  );
}

export default async function Semana({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ avisados?: string; erro?: string }> }) {
  const { id } = await params;
  const { avisados, erro } = await searchParams;
  const { supabase } = await exigirEquipe();

  // Ao abrir a semana, quem tem assinatura ativa entra sozinho (idempotente): não existe mais "abrir semana".
  await supabase.rpc("preparar_semana", { p_semana: id });
  const [dados, { data: catalogo }, { data: rotas }] = await Promise.all([
    carregarSemanaCompleta(supabase, id),
    supabase.from("paes").select("id, nome, ingredientes, alergenos").eq("ativo", true).order("nome"),
    supabase.from("rotas").select("id, nome").eq("ativa", true).order("nome"),
  ]);
  if (!dados) notFound();
  const { semana: s, paes, grupos, totalPaes, totaisPorPao, clientes } = dados;

  const doTipo = (t: Grupo["tipo"]) => grupos.filter((g) => g.tipo === t);
  const somaTipo = (t: Grupo["tipo"]) => doTipo(t).reduce((a, g) => ({ c: a.c + g.ativos, p: a.p + g.totalPaes }), { c: 0, p: 0 });
  const entrega = somaTipo("entrega"), pontos = somaTipo("ponto"), padaria = somaTipo("padaria");
  const naSemana = new Set(paes.map((p) => p.id));
  const disponiveis = (catalogo ?? []).filter((p) => !naSemana.has(p.id));
  const semAtribuir = grupos.find((g) => g.chave === "rota:sem")?.ativos ?? 0;

  return (
    <>
      <PageHeader
        voltar={{ href: `/planejamento?ano=${s.inicio.slice(0, 4)}`, rotulo: `Planejamento ${s.inicio.slice(0, 4)}` }}
        titulo={`Semana de ${dataBR(s.inicio)}`}
        etiqueta={<Badge tom={s.sem_producao ? "cinza" : "azul"} ponto>{s.sem_producao ? "Sem produção" : STATUS_SEMANA[s.status]}</Badge>}
        subtitulo={`${dataBR(s.inicio)} a ${dataBR(s.fim)}`}
        acoes={<>
          <a href={`/planejamento/${id}/pdf/producao`} target="_blank" className="btn-sec"><FileDown size={16} />PDF da produção</a>
          <form action={avisarSaborMembros}><input type="hidden" name="id" value={id} /><SubmitButton className="btn-sec"><Bell size={16} />Avisar os pães</SubmitButton></form>
          <form action={alternarListaFechada}><input type="hidden" name="id" value={id} /><input type="hidden" name="fechar" value={s.lista_fechada ? "0" : "1"} />
            <SubmitButton className="btn-sec">{s.lista_fechada ? <><LockOpen size={16} />Reabrir lista</> : <><Lock size={16} />Fechar lista</>}</SubmitButton></form>
          <Modal titulo="Mais opções da semana" gatilho={<MoreHorizontal size={18} />} gatilhoClasse="btn-sec !px-3">
            <div className="flex flex-col gap-5">
              <form action={salvarSemana} className="grid grid-cols-2 gap-3">
                <input type="hidden" name="id" value={id} />
                <div><label className="rotulo">Situação</label><select className="campo" name="status" defaultValue={s.status}>{Object.entries(STATUS_SEMANA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="rotulo">Observação</label><input className="campo" name="observacao" defaultValue={s.observacao ?? ""} /></div>
                <div className="col-span-2 flex justify-end"><SubmitButton>Salvar</SubmitButton></div>
              </form>
              <form action={alternarSemProducao} className="border-t border-stone-100 pt-4"><input type="hidden" name="id" value={id} /><input type="hidden" name="ligar" value={s.sem_producao ? "0" : "1"} />
                <SubmitButton className="btn-sec w-full">{s.sem_producao ? <><Undo2 size={16} />Voltar a produzir</> : <><Moon size={16} />Marcar semana sem produção (feriado)</>}</SubmitButton></form>
              <form action={restaurarDivisao}><input type="hidden" name="semana_id" value={id} />
                <SubmitButton className="btn-sec w-full"><RotateCcw size={16} />Restaurar a divisão padrão dos pães</SubmitButton>
                <p className="ajuda mt-1.5">Desfaz os ajustes manuais e volta a dividir os pães igualmente entre os clientes.</p></form>
              <form action={excluirSemana} className="border-t border-stone-100 pt-3"><input type="hidden" name="id" value={id} />
                <button className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-700"><Trash2 size={14} />Excluir esta semana</button></form>
            </div>
          </Modal>
        </>}
      />

      {avisados !== undefined && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 shadow-sm">Aviso enviado para {avisados} membro(s) com o app.</p>}
      {erro && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">{erro}</p>}
      {s.lista_fechada && <p className="mb-4 flex items-center gap-2 rounded-xl bg-stone-100 p-3 text-sm text-stone-700 shadow-sm"><Lock size={15} />Lista fechada: novos clientes e pagamentos não alteram esta semana. As quantidades ainda podem ser ajustadas.</p>}
      {s.sem_producao && <p className="mb-4 rounded-xl bg-stone-100 p-3 text-sm text-stone-700 shadow-sm">Semana sem produção: ninguém recebe pães.</p>}

      <div className="mb-6 grid grid-cols-4 gap-3">
        <Stat rotulo="Pães a produzir" valor={totalPaes} icone={PackageCheck} tom="ambar" detalhe={paes.length ? paes.map((p) => `${totaisPorPao[p.id] ?? 0} ${p.nome}`).join(" · ") : "Defina os pães da semana"} />
        <Stat rotulo="Clientes na semana" valor={clientes} icone={Users} tom="azul" detalhe={semAtribuir ? `${semAtribuir} entrega(s) sem rota` : undefined} />
        <Stat rotulo="Entrega em casa" valor={`${entrega.p} pães`} icone={Truck} tom="verde" detalhe={`${entrega.c} cliente(s)`} />
        <Stat rotulo="Retirada" valor={`${pontos.p + padaria.p} pães`} icone={Store} tom="neutro" detalhe={`${pontos.c + padaria.c} cliente(s) · ${doTipo("ponto").length} ponto(s) e padaria`} />
      </div>

      <section className="cartao mb-6 !p-0">
        <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-semibold"><Wheat size={17} className="text-stone-400" />Pães da semana <span className="font-normal text-stone-400">{paes.length}</span></h2>
          <div className="ml-auto">
            <Modal titulo="Adicionar pão à semana" descricao="Escolha um pão já cadastrado ou cadastre um novo. O pão fica no catálogo e pode ser usado em outras semanas." gatilho={<><Plus size={16} />Adicionar pão</>} gatilhoClasse="btn" largo>
              <div className="flex flex-col gap-6">
                {disponiveis.length > 0 && (
                  <form action={adicionarPaesSemana} className="flex flex-col gap-3">
                    <input type="hidden" name="semana_id" value={id} />
                    <div className="text-sm font-semibold">Do catálogo</div>
                    <ul className="max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-xl bg-stone-50/60 shadow-inner">
                      {disponiveis.map((p) => (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-amber-50/60">
                            <input type="checkbox" name="pao_id" value={p.id} className="mt-1 size-4 accent-amber-700" />
                            <span className="text-sm"><b className="font-medium">{p.nome}</b>{p.ingredientes && <span className="block text-xs text-stone-500">{p.ingredientes}</span>}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end"><SubmitButton className="btn-sec">Adicionar os marcados</SubmitButton></div>
                  </form>
                )}
                <div className={disponiveis.length ? "border-t border-stone-100 pt-5" : ""}>
                  <div className="mb-3 text-sm font-semibold">{disponiveis.length ? "Ou cadastre um pão novo" : "Cadastrar pão"}</div>
                  <FormPao semanaId={id} />
                </div>
              </div>
            </Modal>
          </div>
        </header>
        {!paes.length ? (
          <Vazio icone={Wheat} titulo="Nenhum pão nesta semana" texto="Adicione os pães: o sistema divide entre os clientes e calcula quanto produzir." />
        ) : (
          <ul className="grid grid-cols-3 gap-4 p-5">
            {paes.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5 rounded-xl bg-stone-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <b className="flex-1 leading-tight">{p.nome}{p.tradicional && <span className="selo selo-ambar ml-2 align-middle">Tradicional</span>}</b>
                  <form action={removerPaoSemana}><input type="hidden" name="semana_id" value={id} /><input type="hidden" name="pao_id" value={p.id} />
                    <SubmitButton className="btn-ghost !p-1 hover:!bg-red-50 hover:!text-red-700"><span className="sr-only">Tirar da semana</span><X size={15} /></SubmitButton></form>
                </div>
                <div className="text-2xl font-semibold tracking-tight">{totaisPorPao[p.id] ?? 0}<span className="ml-1 text-sm font-normal text-stone-500">a produzir</span></div>
                {p.ingredientes && <p className="text-xs text-stone-600">{p.ingredientes}</p>}
                {p.alergenos && <div className="flex flex-wrap gap-1">{p.alergenos.split(",").map((a) => a.trim()).filter(Boolean).map((a) => <span key={a} className="selo selo-laranja">{a}</span>)}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {grupos.length > 0 && !s.sem_producao && (
        <section className="cartao mb-6 overflow-hidden !p-0">
          <header className="border-b border-stone-100 px-5 py-3.5"><h2 className="font-semibold">Quanto produzir e para onde levar</h2></header>
          <table className="tabela">
            <thead><tr><th>Destino</th><th>Clientes</th>{paes.map((p) => <th key={p.id} className="text-center">{p.nome}</th>)}<th className="text-center">Total</th><th /></tr></thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.chave}>
                  <td className="font-medium"><span className="mr-2 text-xs font-normal text-stone-400">{g.tipo === "entrega" ? "Entrega" : g.tipo === "padaria" ? "Padaria" : "Ponto"}</span>{g.chave === "rota:sem" ? "Sem rota" : g.nome}</td>
                  <td>{g.ativos}</td>
                  {paes.map((p) => <td key={p.id} className="text-center">{g.totais[p.id] ?? 0}</td>)}
                  <td className="text-center font-semibold">{g.totalPaes}</td>
                  <td className="text-right"><a href={pdfHref(id, g.chave)} target="_blank" className="btn-ghost !px-2 !py-1 text-xs"><FileDown size={13} />PDF</a></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-stone-50/70 font-semibold"><td className="px-4 py-2.5">Total</td><td className="px-4 py-2.5">{clientes}</td>{paes.map((p) => <td key={p.id} className="px-4 py-2.5 text-center">{totaisPorPao[p.id] ?? 0}</td>)}<td className="px-4 py-2.5 text-center">{totalPaes}</td><td /></tr></tfoot>
          </table>
        </section>
      )}

      {!s.sem_producao && (
        grupos.length === 0 ? (
          <div className="cartao"><Vazio icone={Users} titulo="Nenhum cliente com assinatura ativa" texto="Quando houver clientes com assinatura ativa, eles aparecem aqui nesta semana, agrupados por entrega, ponto de coleta e padaria." /></div>
        ) : (
          <div className="flex flex-col gap-8">
            {(["entrega", "ponto", "padaria"] as const).map((t) => doTipo(t).length > 0 && (
              <div key={t} className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  {t === "entrega" ? <><Truck size={18} className="text-stone-400" />Entrega em casa</> : t === "ponto" ? <><MapPin size={18} className="text-stone-400" />Retirada nos pontos de coleta</> : <><Store size={18} className="text-stone-400" />Retirada na padaria</>}
                </h2>
                {doTipo(t).map((g) => <CartaoGrupo key={g.chave} g={g} paes={paes} semanaId={id} rotas={rotas ?? []} />)}
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
