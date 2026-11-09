import { AlertTriangle, ArrowLeft, ArrowRight, Bell, ChevronDown, Check, CircleCheck, FileDown, Lock, LockOpen, MapPin, Moon, MoreHorizontal, PackageCheck, Plus, RotateCcw, Route as RouteIcon, SkipForward, Store, Trash2, Truck, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BuscaTabela from "@/components/BuscaTabela";
import ChipsBairro from "@/components/ChipsBairro";
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
  adicionarPaesSemana, alternarListaFechada, alternarPuloLinha, alternarSemProducao, avisarSaborMembros, excluirSemana,
  marcarRetirada, moverClientes, removerPaoSemana, restaurarDivisao, salvarQuantidades, salvarSemana,
} from "../../planejamento/actions";
import FormPao from "../../planejamento/FormPao";

const slug = (chave: string) => chave.replace(/[^a-z0-9]+/gi, "-");
const pdfHref = (semana: string, chave: string) => `/semana/${semana}/pdf/${slug(chave).replace(/^rota-sem$/, "rota-sem")}`;

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

      <details className="group/lista" open={semRota || g.linhas.length <= 8}>
      <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-stone-100 bg-stone-50/60 px-5 py-2 text-[13px] font-medium text-stone-500 marker:hidden hover:text-stone-800 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={14} className="transition group-open/lista:rotate-180" /><span className="group-open/lista:hidden">Mostrar os {g.linhas.length} clientes</span><span className="hidden group-open/lista:inline">Recolher a lista</span>
      </summary>
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
      </details>
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
  return (
    <ol className="mb-6 grid grid-cols-5 gap-3" aria-label="Etapas da semana">
      {estados.map((e, i) => {
        const ativa = e.id === atual;
        return (
          <li key={e.id}>
            <Link
              href={`/semana/${semanaId}?etapa=${e.id}`} aria-current={ativa ? "step" : undefined}
              className={`flex h-full items-start gap-3 rounded-2xl p-4 transition ${ativa ? "bg-white shadow-[0_10px_28px_-10px_rgba(28,25,23,.25)] ring-1 ring-stone-900/10" : "bg-painel ring-1 ring-stone-900/[0.04] hover:bg-white hover:shadow-md"}`}
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${e.feita ? "bg-emerald-100 text-emerald-700" : ativa ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-500"}`}>
                {e.feita ? <Check size={16} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold leading-tight ${ativa ? "text-stone-900" : "text-stone-700"}`}>{e.rotulo}</span>
                <span className="block truncate text-xs text-stone-500">{e.detalhe}</span>
                {e.alerta && <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800"><AlertTriangle size={12} />{e.alerta}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
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

export default async function Semana({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ avisados?: string; erro?: string; etapa?: string }> }) {
  const { id } = await params;
  const { avisados, erro, etapa: etapaPedida } = await searchParams;
  const { supabase } = await exigirEquipe();

  // Ao abrir a semana, quem tem assinatura ativa entra sozinho (idempotente): não existe mais "abrir semana".
  await supabase.rpc("preparar_semana", { p_semana: id });
  // com a lista ainda aberta, a ordem das paradas e o caminho de cada rota seguem quem está na semana
  const { data: aberta } = await supabase.from("semanas").select("lista_fechada").eq("id", id).maybeSingle();
  if (aberta && !aberta.lista_fechada && ["alocar", "consolidar", "acompanhar"].includes(etapaPedida ?? "alocar")) await organizarRotasDaSemana(supabase, id);
  const [dados, { data: catalogo }, { data: rotas }] = await Promise.all([
    carregarSemanaCompleta(supabase, id),
    supabase.from("paes").select("id, nome, descricao, ingredientes, alergenos, tradicional").eq("ativo", true).order("nome"),
    supabase.from("rotas").select("id, nome, entregador_id").eq("ativa", true).order("nome"),
  ]);
  if (!dados) notFound();
  const { semana: s, paes, grupos, totalPaes, totaisPorPao, clientes } = dados;

  const doTipo = (t: Grupo["tipo"]) => grupos.filter((g) => g.tipo === t);
  const somaTipo = (t: Grupo["tipo"]) => doTipo(t).reduce((a, g) => ({ c: a.c + g.ativos, p: a.p + g.totalPaes }), { c: 0, p: 0 });
  const entrega = somaTipo("entrega"), pontos = somaTipo("ponto"), padaria = somaTipo("padaria");
  const naSemana = new Set(paes.map((p) => p.id));
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
        <section>
          <header className="mb-4 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[17px] font-semibold tracking-tight">Quais pães saem nesta semana?</h2>
            <span className="text-sm text-stone-400">{paes.length} {paes.length === 1 ? "escolhido" : "escolhidos"} · toque num pão para escolher ou tirar</span>
          </header>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-stretch gap-3">
            {[...(catalogo ?? [])].sort((x, y) => Number(naSemana.has(y.id)) - Number(naSemana.has(x.id)) || x.nome.localeCompare(y.nome, "pt-BR")).map((p) => {
              const sel = naSemana.has(p.id);
              return (
                <form key={p.id} action={sel ? removerPaoSemana : adicionarPaesSemana} className="h-full">
                  <input type="hidden" name="semana_id" value={id} /><input type="hidden" name="pao_id" value={p.id} />
                  <button className={`flex h-full w-full flex-col gap-2 rounded-[22px] p-4 text-left transition active:scale-[.985] ${sel ? "bg-amber-50 shadow-[0_14px_30px_-18px_rgba(180,83,9,.6)]" : "bg-painel ring-1 ring-stone-900/[0.04] hover:bg-white hover:shadow-md"}`} aria-pressed={sel}>
                    <span className="flex items-start gap-2">
                      <b className="flex-1 leading-tight">{p.nome}</b>
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full transition ${sel ? "bg-amber-700 text-white" : "bg-white text-stone-400 shadow-[0_0_0_1px_rgba(28,25,23,.1)]"}`}>{sel ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}</span>
                    </span>
                    {p.tradicional && <span className="selo selo-ambar w-fit">Tradicional</span>}
                    {(p.descricao || p.ingredientes) && <span className="line-clamp-2 text-[13px] leading-snug text-stone-500">{p.descricao || p.ingredientes}</span>}
                    {sel && <span className="mt-auto pt-1 text-sm text-amber-900"><b className="text-lg font-semibold tabular-nums">{totaisPorPao[p.id] ?? 0}</b> a produzir</span>}
                  </button>
                </form>
              );
            })}
            <Modal titulo="Cadastrar pão novo" descricao="Ele entra no catálogo e já é escolhido para esta semana." gatilho={<><span className="flex size-10 items-center justify-center rounded-full bg-stone-100 transition group-hover:bg-amber-100"><Plus size={18} /></span><span className="font-semibold">Novo pão</span></>} gatilhoClasse="cartao-novo group !min-h-[120px] !rounded-[22px]" largo><FormPao semanaId={id} /></Modal>
          </div>
          {!(catalogo ?? []).length && <p className="mt-3 text-sm text-stone-500">O catálogo está vazio. Cadastre o primeiro pão no cartão acima.</p>}
          <p className="mt-5 text-xs leading-relaxed text-stone-400">O sistema divide os pães de cada plano entre os pães escolhidos, o tradicional inclusive. Os clientes com quantidade fixa de tradicionais recebem essa quantidade primeiro.</p>
        </section>
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
                  <td className="text-right"><a href={pdfHref(id, g.chave)} target="_blank" className="btn-ghost !px-2 !py-1 text-xs"><FileDown size={13} />PDF</a></td>
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
