import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CircleCheck, FileDown, Lock, LockOpen, MapPin, Moon, MoreHorizontal, PackageCheck, Plus, RotateCcw, SkipForward, Store, Trash2, Truck, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BuscaTabela from "@/components/BuscaTabela";
import ChipsBairro from "@/components/ChipsBairro";
import EscolherPaes from "@/components/semana/EscolherPaes";
import DestinosSemana from "@/components/semana/DestinosSemana";
import MapaSemana from "@/components/semana/MapaSemana";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { dataBR } from "@/lib/format";
import { organizarRotasDaSemana } from "@/lib/rota-semanal";
import { semAcento } from "@/lib/dados";
import { carregarSemanaCompleta, estaAtiva, type Grupo, type PaoSemana } from "@/lib/planejamento";
import { ETAPAS, estadoEtapas, etapaAtual, type EstadoEtapa } from "@/lib/etapas";
import { STATUS_SEMANA } from "@/lib/semana";
import {
  alternarListaFechada, alternarPuloLinha, alternarSemProducao, avisarSaborMembros, excluirSemana,
  marcarRetirada, moverClientes, restaurarDivisao, salvarQuantidades, salvarSemana,
} from "../../planejamento/actions";

const slug = (chave: string) => chave.replace(/[^a-z0-9]+/gi, "-");
const pdfHref = (semana: string, chave: string) => `/semana/${semana}/pdf/${slug(chave).replace(/^rota-sem$/, "rota-sem")}`;

function BadgeSituacao({ status }: { status: string }) {
  if (status === "pulada") return <Badge tom="cinza">Pulou a semana</Badge>;
  if (status === "suspensa_atraso") return <Badge tom="laranja">Suspenso por atraso</Badge>;
  if (status === "entregue" || status === "retirada") return <Badge tom="verde" ponto>{status === "entregue" ? "Entregue" : "Retirou"}</Badge>;
  if (status === "nao_entregue") return <Badge tom="vermelho">Não entregue</Badge>;
  return null;
}

function CartaoGrupo({ g, paes, semanaId, rotas, mapa }: { g: Grupo; paes: PaoSemana[]; semanaId: string; rotas: { id: string; nome: string }[]; mapa?: React.ReactNode }) {
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
          <p className="text-sm text-stone-500"><b className="text-stone-800">{g.ativos}</b> cliente{g.ativos === 1 ? "" : "s"} · <b className="text-stone-800">{g.totalPaes}</b> {g.totalPaes === 1 ? "pão" : "pães"}
            {paes.length > 0 && <span className="text-stone-400"> — {paes.map((p) => `${g.totais[p.id] ?? 0} ${p.nome}`).join(" · ")}</span>}</p>
        </div>
                {!entrega && <a href={pdfHref(semanaId, g.chave)} target="_blank" className="btn-sec btn-pequeno"><FileDown size={14} />PDF</a>}
      </header>
      {semRota && <p className="bg-amber-50 px-5 py-2 text-sm text-amber-900">Estes clientes moram em bairros que nenhuma rota cobre. Marque-os abaixo e mova para uma rota, ou inclua o bairro em <Link href="/rotas" className="font-medium underline">Rotas</Link>.</p>}
      {mapa && <div className="p-3 pb-0">{mapa}</div>}

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
                {entrega && !semRota && <th className="w-10 text-center">#</th>}
                <th>Cliente</th>
                {entrega && <th className="min-w-44">Endereço</th>}
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
                    {entrega && !semRota && <td className="text-center">{ativa ? <span className="inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: g.cor ?? "#b45309" }}>{l.ordem}</span> : null}</td>}
                    <td><Link href={`/clientes/${l.cliente_id}`} className="font-medium hover:underline">{l.nome}</Link></td>
                    {entrega && <td className="text-sm text-stone-600">{l.endereco || "—"}<span className="block text-xs text-stone-400">{l.bairro}</span></td>}
                    <td className="text-sm text-stone-600">{l.paesPlano} {l.paesPlano > 1 ? "pães" : "pão"}/sem</td>
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
                      <BadgeSituacao status={l.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50/70 text-sm font-semibold">
                <td colSpan={entrega ? (semRota ? 4 : 5) : 2} className="px-4 py-2.5">Total</td>
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

function Checklist({ id, itens }: { id: string; itens: { ok: boolean; texto: string; etapa: string }[] }) {
  return (
    <ul className="cartao mb-5 flex flex-col gap-1 !p-3" aria-label="Antes de enviar">
      {itens.map((i) => (
        <li key={i.texto}>
          <Link href={`/semana/${id}?etapa=${i.etapa}`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-stone-50">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${i.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{i.ok ? <Check size={14} /> : <AlertTriangle size={13} />}</span>
            <span className={i.ok ? "text-stone-600" : "font-medium text-stone-900"}>{i.texto}</span>
            {!i.ok && <ArrowRight size={14} className="ml-auto text-stone-400" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Etapa 2: todos que recebem na semana, com o destino de cada um e a opção de pular. */
function ListaClientes({ grupos, semanaId }: { grupos: Grupo[]; semanaId: string }) {
  const linhas = grupos.flatMap((g) => g.linhas.map((l) => ({ l, g }))).sort((a, b) => a.l.nome.localeCompare(b.l.nome, "pt-BR"));
  if (!linhas.length) return <div className="cartao"><Vazio icone={Users} titulo="Nenhum cliente com assinatura ativa" texto="Clientes com assinatura ativa entram sozinhos na semana. Cadastre ou reative um cliente para ele aparecer aqui." /></div>;
  const conta = (f: (s: string) => boolean) => linhas.filter(({ l }) => f(l.status)).length;
  const recebem = conta(estaAtiva), pulados = conta((x) => x === "pulada"), suspensos = conta((x) => x === "suspensa_atraso");
  return (
    <section id="lista-semana" className="cartao overflow-hidden !p-0">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-stone-100 px-5 py-3.5">
        <h2 className="font-semibold">Quem recebe nesta semana</h2>
        <span className="text-sm text-stone-500"><b className="text-stone-800">{recebem}</b> recebem</span>
        {pulados > 0 && <span className="text-sm text-stone-500"><b className="text-stone-800">{pulados}</b> pularam</span>}
        {suspensos > 0 && <span className="text-sm text-amber-800"><b>{suspensos}</b> suspensos por atraso</span>}
        <span className="ml-auto"><BuscaTabela alvo="#lista-semana" placeholder="Buscar cliente ou destino" /></span>
        <Link href="/clientes/novo" className="btn-sec btn-pequeno"><Plus size={14} />Novo cliente</Link>
      </header>
      <p className="border-b border-stone-100 bg-stone-50/60 px-5 py-2.5 text-xs text-stone-500">Quem tem assinatura ativa entra sozinho. Quem estiver em atraso fica suspenso até pagar. Use “Pular” para quem não recebe só nesta semana.</p>
      <table className="tabela">
        <thead><tr><th>Cliente</th><th>Plano</th><th>Destino</th><th className="text-center">Pães</th><th>Situação</th><th /></tr></thead>
        <tbody>
          {linhas.map(({ l, g }) => (
            <tr key={l.id} data-busca={semAcento(`${l.nome} ${g.chave === "rota:sem" ? "sem rota" : g.nome} ${l.bairro ?? ""}`)} className={estaAtiva(l.status) ? "" : "opacity-65"}>
              <td><Link href={`/clientes/${l.cliente_id}`} className="font-medium hover:underline">{l.nome}</Link></td>
              <td className="text-sm text-stone-600">{l.paesPlano} {l.paesPlano > 1 ? "pães" : "pão"}/sem</td>
              <td className="text-sm text-stone-600">{g.chave === "rota:sem" ? <span className="text-amber-800">Sem rota</span> : g.nome}<span className="ml-1.5 text-xs text-stone-400">{g.tipo === "entrega" ? "entrega" : g.tipo === "padaria" ? "padaria" : "ponto"}</span></td>
              <td className="text-center font-semibold">{l.qtd}</td>
              <td><BadgeSituacao status={l.status} />{estaAtiva(l.status) && !["entregue", "retirada", "nao_entregue"].includes(l.status) && <span className="text-xs text-stone-400">Recebe</span>}</td>
              <td className="text-right">
                {(l.status === "programada" || l.status === "reagendada") && <form action={alternarPuloLinha.bind(null, semanaId, l.assinatura_id)}><SubmitButton className="btn-ghost !px-2 !py-1 text-xs"><SkipForward size={13} />Pular</SubmitButton></form>}
                {l.status === "pulada" && <form action={alternarPuloLinha.bind(null, semanaId, l.assinatura_id)}><SubmitButton className="btn-ghost !px-2 !py-1 text-xs"><Undo2 size={13} />Voltar</SubmitButton></form>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Etapas({ semanaId, estados, atual }: { semanaId: string; estados: EstadoEtapa[]; atual: string }) {
  const indice = estados.findIndex((e) => e.id === atual);
  const ativa = estados[indice];
  const proxima = estados[indice + 1];
  return (
    <nav className="mb-6 overflow-hidden rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(28,25,23,.06)]" aria-label="Etapas da semana">
      <ol className="grid grid-cols-5 px-2 pt-5 sm:px-4">
        {estados.map((e, i) => {
          const eAtiva = e.id === atual;
          const ultima = i === estados.length - 1;
          return (
            <li key={e.id} className="relative">
              {!ultima && <span aria-hidden className={`absolute left-1/2 top-[17px] h-0.5 w-full ${e.feita && estados[i + 1].feita ? "bg-emerald-300" : e.feita ? "bg-gradient-to-r from-emerald-300 to-stone-200" : "bg-stone-200"}`} />}
              <Link href={`/semana/${semanaId}?etapa=${e.id}`} aria-current={eAtiva ? "step" : undefined} className="group relative flex flex-col items-center gap-1 px-0.5 pb-4 text-center">
                <span className={`flex size-[35px] items-center justify-center rounded-full text-sm font-semibold ring-4 ring-white transition ${eAtiva ? "bg-amber-700 text-white shadow-[0_6px_16px_-4px_rgba(180,83,9,.6)]" : e.feita ? "bg-emerald-500 text-white" : "bg-stone-100 text-stone-500 group-hover:bg-stone-200"}`}>
                  {e.feita && !eAtiva ? <Check size={17} strokeWidth={3} /> : i + 1}
                </span>
                <span className={`mt-1 text-[13px] font-semibold leading-tight ${eAtiva ? "text-stone-900" : "hidden text-stone-600 group-hover:text-stone-900 sm:block"}`}>{e.rotulo}</span>
                <span className="hidden text-xs leading-tight text-stone-500 sm:block">{e.detalhe}</span>
                {e.alerta && <span className="hidden items-center gap-1 rounded-full bg-amber-50 sm:flex px-2 py-0.5 text-[11px] font-medium text-amber-800"><AlertTriangle size={11} />{e.alerta}</span>}
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 bg-stone-50/70 px-5 py-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-stone-600"><b className="text-stone-900">Etapa {indice + 1} de {estados.length}.</b> {ativa.curto}.</p>
        {proxima && <Link href={`/semana/${semanaId}?etapa=${proxima.id}`} className="btn-sec btn-pequeno">{proxima.rotulo}<ArrowRight size={14} /></Link>}
      </div>
    </nav>
  );
}

/** Etapa 4: como anda cada destino na semana, e o que precisa de atenção. */
function Acompanhamento({ grupos, semanaId }: { grupos: Grupo[]; semanaId: string }) {
  if (!grupos.length) return <div className="cartao"><Vazio icone={Truck} titulo="Nada para acompanhar" texto="Quando houver clientes na semana, o andamento de cada rota e ponto aparece aqui." /></div>;
  const feitas = (g: Grupo) => g.linhas.filter((l) => l.status === "entregue" || l.status === "retirada").length;
  const falhas = grupos.flatMap((g) => g.linhas.filter((l) => l.status === "nao_entregue" || l.status === "suspensa_atraso").map((l) => ({ l, g })));
  return (
    <div className="flex flex-col gap-5">
      {falhas.length > 0 && (
        <section className="cartao !p-0">
          <header className="flex items-center gap-2 border-b border-stone-100 px-5 py-3.5 font-semibold"><AlertTriangle size={16} className="text-amber-700" />Precisam de atenção <span className="font-normal text-stone-400">{falhas.length}</span></header>
          <ul className="divide-y divide-stone-100">
            {falhas.map(({ l, g }) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Link href={`/clientes/${l.cliente_id}`} className="font-medium hover:underline">{l.nome}</Link>
                <span className="text-stone-400">{g.chave === "rota:sem" ? "Sem rota" : g.nome}</span>
                <span className="ml-auto"><BadgeSituacao status={l.status} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-4">
        {grupos.map((g) => {
          const ok = feitas(g);
          const pct = g.ativos ? Math.round((ok / g.ativos) * 100) : 0;
          const falta = g.linhas.filter((l) => l.status === "programada" || l.status === "reagendada");
          const Icone = g.tipo === "entrega" ? Truck : g.tipo === "padaria" ? Store : MapPin;
          return (
            <section key={g.chave} className="cartao !p-4">
              <div className="flex items-center gap-2.5">
                <Icone size={16} className="text-stone-400" />
                <h3 className="flex-1 font-semibold leading-tight">{g.chave === "rota:sem" ? "Entrega sem rota" : g.nome}</h3>
                {pct === 100 && g.ativos > 0 ? <span className="selo selo-verde"><CircleCheck size={13} />Concluída</span> : <span className="text-sm tabular-nums text-stone-500">{ok} de {g.ativos}</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${pct}% concluído`}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>
              {g.tipo === "entrega" && falta.length > 0 && <p className="mt-2.5 text-xs text-stone-500">Falta: {falta.slice(0, 4).map((l) => l.nome.split(" ")[0]).join(", ")}{falta.length > 4 ? ` e mais ${falta.length - 4}` : ""}</p>}
              {g.tipo !== "entrega" && falta.length > 0 && (
                <ul className="mt-3 divide-y divide-stone-100 text-sm">
                  {falta.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 py-1.5">
                      <span className="flex-1 truncate">{l.nome}</span>
                      <form action={marcarRetirada.bind(null, semanaId, l.id)}><SubmitButton className="btn-ghost !px-2 !py-1 text-xs"><Check size={13} />Retirou</SubmitButton></form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-sm text-stone-500">As entregas em casa são marcadas pelo entregador no app; as retiradas, aqui. Veja semanas passadas em <Link className="link" href="/entregas/historico">Histórico de entregas</Link>.</p>
    </div>
  );
}

export default async function Semana({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ avisados?: string; erro?: string; etapa?: string; destino?: string }> }) {
  const { id } = await params;
  const { avisados, erro, etapa: etapaPedida, destino: destinoPedido } = await searchParams;
  const { supabase } = await exigirEquipe();

  // Ao abrir a semana, quem tem assinatura ativa entra sozinho (idempotente): não existe mais "abrir semana".
  await supabase.rpc("preparar_semana", { p_semana: id });
  // com a lista ainda aberta, a ordem das paradas e o caminho de cada rota seguem quem está na semana
  const { data: aberta } = await supabase.from("semanas").select("lista_fechada").eq("id", id).maybeSingle();
  if (aberta && !aberta.lista_fechada && ["alocar", "consolidar", "acompanhar"].includes(etapaPedida ?? "alocar")) await organizarRotasDaSemana(supabase, id);
  const [dados, { data: catalogo }, { data: rotas }] = await Promise.all([
    carregarSemanaCompleta(supabase, id),
    supabase.from("paes").select("id, nome, descricao, ingredientes, alergenos").eq("ativo", true).order("nome"),
    supabase.from("rotas").select("id, nome, cor, entregador_id, dia_semana, janela_inicio, janela_fim, trajeto, distancia_m, duracao_s, entregador:usuarios!rotas_entregador_id_fkey(nome), origem:pontos_coleta!rotas_origem_ponto_id_fkey(nome, lat, lng)").eq("ativa", true).order("nome"),
  ]);
  if (!dados) notFound();
  const { semana: s, paes, grupos, totalPaes, totaisPorPao, clientes } = dados;

  const doTipo = (t: Grupo["tipo"]) => grupos.filter((g) => g.tipo === t);
  const somaTipo = (t: Grupo["tipo"]) => doTipo(t).reduce((a, g) => ({ c: a.c + g.ativos, p: a.p + g.totalPaes }), { c: 0, p: 0 });
  const entrega = somaTipo("entrega"), pontos = somaTipo("ponto"), padaria = somaTipo("padaria");
  const semAtribuir = grupos.find((g) => g.chave === "rota:sem")?.ativos ?? 0;

  const semEntregador = new Set((rotas ?? []).filter((r) => !r.entregador_id).map((r) => r.id));
  const rotasSemEntregador = grupos.filter((g) => g.tipo === "entrega" && g.refId && g.ativos > 0 && semEntregador.has(g.refId)).length;
  const concluidas = grupos.reduce((n, g) => n + g.linhas.filter((l) => l.status === "entregue" || l.status === "retirada").length, 0);
  const todas = grupos.flatMap((g) => g.linhas);
  const estados = estadoEtapas({
    paes: paes.length, totalPaes, semProducao: s.sem_producao, listaFechada: s.lista_fechada,
    ativos: grupos.reduce((n, g) => n + g.ativos, 0), suspensos: todas.filter((l) => l.status === "suspensa_atraso").length,
    pulados: todas.filter((l) => l.status === "pulada").length, concluidas, semRota: semAtribuir, rotasSemEntregador,
  });
  const etapa = etapaAtual(estados, etapaPedida);
  const indice = estados.findIndex((e) => e.id === etapa);
  const link = (e: string) => `/semana/${id}?etapa=${e}`;

  type RotaSemana = NonNullable<typeof rotas>[number] & { entregador?: { nome: string } | null; origem?: { nome: string; lat: number | null; lng: number | null } | null };
  const mapaRotas = new Map((rotas ?? [] as RotaSemana[]).map((r) => [r.id, r as unknown as RotaSemana]));
  const destino = grupos.find((g) => g.chave === destinoPedido) ?? grupos.find((g) => g.chave === "rota:sem") ?? grupos.find((g) => g.tipo === "entrega" && g.refId && !mapaRotas.get(g.refId)?.entregador_id) ?? grupos[0];
  const mapaPara = (g: Grupo) => {
    const rota = g.refId && g.tipo === "entrega" ? mapaRotas.get(g.refId) : undefined;
    if (!rota) return null;
    return (
      <MapaSemana
        semanaId={id} rotaId={rota.id} cor={rota.cor ?? "#b45309"} origem={rota.origem ?? null}
        trajeto={(rota.trajeto as [number, number][] | null) ?? null} distanciaM={rota.distancia_m ?? null} duracaoS={rota.duracao_s ?? null}
        paradas={g.linhas.map((l) => ({ id: l.id, clienteId: l.cliente_id, nome: l.nome, lat: l.lat, lng: l.lng, ativa: estaAtiva(l.status), rua: l.rua, numero: l.numero, bairro: l.bairro, cidade: l.cidade, cep: l.cep }))}
      />
    );
  };

  return (
    <>
      <PageHeader
        voltar={{ href: `/planejamento?ano=${s.inicio.slice(0, 4)}`, rotulo: `Calendário ${s.inicio.slice(0, 4)}` }}
        titulo={`Semana de ${dataBR(s.inicio)}`}
        etiqueta={<Badge tom={s.sem_producao ? "cinza" : "azul"} ponto>{s.sem_producao ? "Sem produção" : STATUS_SEMANA[s.status]}</Badge>}
        subtitulo={`${dataBR(s.inicio)} a ${dataBR(s.fim)}`}
        acoes={<>
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

      <Etapas semanaId={id} estados={estados} atual={etapa} />

      {etapa === "planejar" && (
        <EscolherPaes semanaId={id} paes={catalogo ?? []} selecionados={paes.map((p) => p.id)} totais={totaisPorPao} />
      )}

      {etapa === "consolidar" && (
        <>
      <Checklist id={id} itens={[
        { ok: s.sem_producao || paes.length > 0, texto: paes.length ? `${paes.length} ${paes.length === 1 ? "pão definido" : "pães definidos"} para a semana` : "Defina os pães da semana", etapa: "planejar" },
        { ok: s.sem_producao || semAtribuir === 0, texto: semAtribuir ? `${semAtribuir} ${semAtribuir === 1 ? "entrega" : "entregas"} sem rota` : "Todos os clientes alocados em rota, ponto ou padaria", etapa: "alocar" },
        { ok: s.sem_producao || rotasSemEntregador === 0, texto: rotasSemEntregador ? `${rotasSemEntregador} ${rotasSemEntregador === 1 ? "rota" : "rotas"} sem entregador` : "Todas as rotas têm entregador", etapa: "alocar" },
        { ok: s.lista_fechada, texto: s.lista_fechada ? "Lista da semana fechada" : "Lista ainda aberta: feche para valer os números acima", etapa: "consolidar" },
      ]} />
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {paes.length > 0 && <form action={avisarSaborMembros}><input type="hidden" name="id" value={id} /><SubmitButton className="btn-sec"><Bell size={16} />Avisar os clientes sobre os pães</SubmitButton></form>}
        <a href={`/semana/${id}/pdf/producao`} target="_blank" className="btn-sec"><FileDown size={16} />PDF da produção</a>
        <form action={alternarListaFechada}><input type="hidden" name="id" value={id} /><input type="hidden" name="fechar" value={s.lista_fechada ? "0" : "1"} />
          <SubmitButton className={s.lista_fechada ? "btn-sec" : "btn"}>{s.lista_fechada ? <><LockOpen size={16} />Reabrir lista</> : <><Lock size={16} />Fechar a lista da semana</>}</SubmitButton></form>
      </div>
      <section className="cartao mb-6">
        <div className="cartao-titulo">Resumo da semana</div>
      <div className="grid grid-cols-4 gap-3">
        <Stat rotulo="Pães a produzir" valor={totalPaes} icone={PackageCheck} tom="ambar" detalhe={paes.length ? paes.map((p) => `${totaisPorPao[p.id] ?? 0} ${p.nome}`).join(" · ") : "Defina os pães da semana"} />
        <Stat rotulo="Clientes na semana" valor={clientes} icone={Users} tom="azul" detalhe={semAtribuir ? `${semAtribuir} entrega(s) sem rota` : undefined} />
        <Stat rotulo="Entrega em casa" valor={`${entrega.p} pães`} icone={Truck} tom="verde" detalhe={`${entrega.c} cliente(s)`} />
        <Stat rotulo="Retirada" valor={`${pontos.p + padaria.p} pães`} icone={Store} tom="neutro" detalhe={`${pontos.c + padaria.c} cliente(s) · ${doTipo("ponto").length} ponto(s) e padaria`} />
      </div>
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
                  <td className="text-right">{g.tipo !== "entrega" && <a href={pdfHref(id, g.chave)} target="_blank" className="btn-ghost !px-2 !py-1 text-xs"><FileDown size={13} />PDF</a>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-stone-50/70 font-semibold"><td className="px-4 py-2.5">Total</td><td className="px-4 py-2.5">{clientes}</td>{paes.map((p) => <td key={p.id} className="px-4 py-2.5 text-center">{totaisPorPao[p.id] ?? 0}</td>)}<td className="px-4 py-2.5 text-center">{totalPaes}</td><td /></tr></tfoot>
          </table>
        </section>
      )}
        </>
      )}

      {etapa === "alocar" && (
        <>
          {rotasSemEntregador > 0 && (
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 shadow-sm"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {rotasSemEntregador} {rotasSemEntregador === 1 ? "rota está" : "rotas estão"} sem entregador. Defina em <Link href="/rotas" className="font-medium underline">Rotas</Link> quem faz cada uma.</p>
          )}
      {!s.sem_producao && (
        grupos.length === 0 ? (
          <div className="cartao"><Vazio icone={Users} titulo="Nenhum cliente com assinatura ativa" texto="Quando houver clientes com assinatura ativa, eles aparecem aqui nesta semana, agrupados por entrega, ponto de coleta e padaria." /></div>
        ) : (
          <DestinosSemana
            semanaId={id} inicial={destino.chave}
            categorias={(["entrega", "ponto", "padaria"] as const).filter((t) => doTipo(t).length > 0).map((t) => ({
              tipo: t, titulo: t === "entrega" ? "Entrega em casa" : t === "ponto" ? "Pontos de coleta" : "Padaria",
              destinos: doTipo(t).map((g) => {
                const rota = g.refId ? mapaRotas.get(g.refId) : undefined;
                const semResp = t === "entrega" && !!g.refId && !rota?.entregador_id;
                return {
                  chave: g.chave, nome: g.chave === "rota:sem" ? "Sem rota" : g.nome, ativos: g.ativos, paes: g.totalPaes,
                  cor: g.cor ?? (g.chave === "rota:sem" ? "#d97706" : t === "padaria" ? "#be123c" : t === "ponto" ? "#0f766e" : "#b45309"),
                  alerta: g.chave === "rota:sem" ? "Entregas sem rota" : semResp ? "Rota sem responsável" : null,
                };
              }),
            }))}
            paineis={Object.fromEntries(grupos.map((g) => [g.chave, <CartaoGrupo key={g.chave} g={g} paes={paes} semanaId={id} rotas={rotas ?? []} mapa={mapaPara(g)} />]))}
          />
        )
      )}
        </>
      )}

      {etapa === "clientes" && <ListaClientes grupos={grupos} semanaId={id} />}

      {etapa === "acompanhar" && <Acompanhamento grupos={grupos} semanaId={id} />}

      <nav className="mt-8 flex items-center justify-between border-t border-stone-200/70 pt-5" aria-label="Etapas da semana">
        {indice > 0 ? <Link href={link(ETAPAS[indice - 1].id)} className="btn-sec"><ArrowLeft size={16} />{ETAPAS[indice - 1].rotulo}</Link> : <span />}
        {indice < ETAPAS.length - 1 && <Link href={link(ETAPAS[indice + 1].id)} className="btn">Próxima etapa: {ETAPAS[indice + 1].rotulo}<ArrowRight size={16} /></Link>}
      </nav>
    </>
  );
}
