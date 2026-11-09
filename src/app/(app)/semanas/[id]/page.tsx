import { Bell, Check, ClipboardList, Lock, LockOpen, Moon, PackageCheck, Pencil, Plus, RefreshCw, Rocket, SkipForward, Trash2, Truck, Undo2, Wheat } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR } from "@/lib/format";
import { STATUS_SEMANA } from "@/lib/semana";
import { abrirSemana, alternarListaFechada, alternarPulo, alternarSemProducao, avisarSaborMembros, excluirPao, excluirSemana, salvarPao, salvarSemana } from "../actions";

type Pao = { id: string; nome: string; descricao: string | null; ingredientes: string | null; alergenos: string | null };

function FormPao({ semanaId, pao }: { semanaId: string; pao?: Pao }) {
  return (
    <form action={salvarPao} className="flex flex-col gap-4">
      <input type="hidden" name="semana_id" value={semanaId} />
      {pao && <input type="hidden" name="id" value={pao.id} />}
      <div><label className="rotulo">Nome do pão <span className="text-red-500">*</span></label><input className="campo" name="nome" defaultValue={pao?.nome} required placeholder="Ex.: Centeio com sementes" /></div>
      <div><label className="rotulo">Descrição curta</label><input className="campo" name="descricao" defaultValue={pao?.descricao ?? ""} placeholder="Ex.: casca crocante, miolo úmido" /></div>
      <div><label className="rotulo">Ingredientes</label><textarea className="campo" name="ingredientes" rows={3} defaultValue={pao?.ingredientes ?? ""} placeholder="Farinha de centeio, água, sal, sementes de girassol…" /></div>
      <div><label className="rotulo">Alérgenos</label><input className="campo" name="alergenos" defaultValue={pao?.alergenos ?? ""} placeholder="Separe por vírgula. Ex.: glúten, gergelim" /></div>
      <div className="flex justify-end"><SubmitButton>{pao ? "Salvar pão" : "Adicionar pão"}</SubmitButton></div>
    </form>
  );
}

export default async function Semana({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ avisados?: string; erro?: string }> }) {
  const { id } = await params;
  const { avisados, erro } = await searchParams;
  const { supabase } = await exigirEquipe();

  const [{ data: s }, { data: entregas }, { data: assinaturas }, { data: pulos }, { data: paesLista }] = await Promise.all([
    supabase.from("semanas").select("*").eq("id", id).single(),
    supabase.from("entregas").select("id, assinatura_id, status, qtd_prevista, rota_nome, ponto_nome, clientes(nome, sobrenome)").eq("semana_id", id),
    supabase.from("assinaturas").select("id, clientes(nome, sobrenome), planos(paes_por_semana)").eq("status", "ativa"),
    supabase.from("pulos_semana").select("assinatura_id").eq("semana_id", id),
    supabase.from("paes_semana").select("*").eq("semana_id", id).order("ordem").order("criado_em"),
  ]);
  if (!s) notFound();
  const paes = (paesLista ?? []) as Pao[];

  const pulou = new Set((pulos ?? []).map((p) => p.assinatura_id));
  const contagem: Record<string, number> = {};
  let totalPaes = 0;
  for (const e of entregas ?? []) {
    contagem[e.status] = (contagem[e.status] ?? 0) + 1;
    if (!["pulada", "suspensa_atraso"].includes(e.status)) totalPaes += e.qtd_prevista;
  }
  const suspensas = (entregas ?? []).filter((e) => e.status === "suspensa_atraso");
  const aberta = (entregas?.length ?? 0) > 0;
  const hist = (entregas ?? []).some((e) => ["entregue", "retirada", "nao_entregue"].includes(e.status));

  const passos = [
    { n: 1, titulo: "Cadastrar os pães", feito: paes.length > 0 || s.sem_producao },
    { n: 2, titulo: "Abrir a semana", feito: aberta || s.sem_producao },
    { n: 3, titulo: "Produzir e imprimir listas", feito: aberta && s.lista_fechada },
    { n: 4, titulo: "Fechar a lista do dia", feito: s.lista_fechada },
  ];

  return (
    <>
      <PageHeader
        voltar={{ href: `/semanas?ano=${s.inicio.slice(0, 4)}`, rotulo: `Calendário ${s.inicio.slice(0, 4)}` }}
        titulo={`Semana de ${dataBR(s.inicio)}`}
        etiqueta={<Badge tom={s.sem_producao ? "cinza" : "azul"} ponto>{s.sem_producao ? "Sem produção" : STATUS_SEMANA[s.status]}</Badge>}
        subtitulo={`${dataBR(s.inicio)} a ${dataBR(s.fim)}${s.sabor ? ` · ${s.sabor}` : ""}`}
        acoes={aberta && !s.sem_producao ? (
          <>
            <Link className="btn-sec" href={`/semanas/${id}/listas/producao`}><ClipboardList size={16} />Produção</Link>
            <Link className="btn-sec" href={`/semanas/${id}/listas/entrega`}><Truck size={16} />Entrega</Link>
            <Link className="btn-sec" href={`/semanas/${id}/listas/coleta`}><PackageCheck size={16} />Coleta</Link>
          </>
        ) : undefined}
      />

      <ol className="mb-5 grid grid-cols-4 gap-3">
        {passos.map((p) => (
          <li key={p.n} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${p.feito ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-stone-200 bg-white text-stone-700"}`}>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${p.feito ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-600"}`}>{p.feito ? <Check size={14} /> : p.n}</span>
            {p.titulo}
          </li>
        ))}
      </ol>

      {avisados !== undefined && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Aviso enviado para {avisados} membro(s) com o app.</p>}
      {erro === "sabor" && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Cadastre ao menos um pão antes de avisar.</p>}

      <div className="mb-5 grid grid-cols-4 gap-3">
        <Stat rotulo="Pães a produzir" valor={totalPaes} icone={PackageCheck} tom="ambar" />
        <Stat rotulo="Entregas programadas" valor={(contagem.programada ?? 0) + (contagem.reagendada ?? 0)} icone={Truck} tom="azul" />
        <Stat rotulo="Entregues" valor={(contagem.entregue ?? 0) + (contagem.retirada ?? 0)} icone={Check} tom="verde" />
        <Stat rotulo="Suspensas por atraso" valor={suspensas.length} icone={SkipForward} tom={suspensas.length ? "vermelho" : "neutro"} detalhe={suspensas.length ? suspensas.map((e) => nomeCompleto(um(e.clientes as never)).split(" ")[0]).join(", ") : undefined} />
      </div>

      <div className="grid grid-cols-[1fr_380px] items-start gap-5">
        <div className="flex flex-col gap-5">
          <section className="cartao !p-0">
            <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
              <h2 className="flex items-center gap-2 font-semibold"><Wheat size={17} className="text-stone-400" />Pães da semana <span className="font-normal text-stone-400">{paes.length}</span></h2>
              <div className="ml-auto">
                <Modal titulo="Adicionar pão" descricao="Cada pão tem seus próprios ingredientes e alérgenos." gatilho={<><Plus size={16} />Adicionar pão</>} gatilhoClasse="btn" largo>
                  <FormPao semanaId={id} />
                </Modal>
              </div>
            </header>
            {!paes.length ? (
              <Vazio icone={Wheat} titulo="Nenhum pão cadastrado" texto="Adicione os pães desta semana. Pode haver mais de um sabor." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {paes.map((p, i) => (
                  <li key={p.id} className="flex items-start gap-4 px-5 py-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-900">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-tight">{p.nome}</div>
                      {p.descricao && <p className="text-sm text-stone-500">{p.descricao}</p>}
                      {p.ingredientes && <p className="mt-1.5 text-sm text-stone-700"><span className="text-stone-400">Ingredientes: </span>{p.ingredientes}</p>}
                      {p.alergenos && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-stone-400">Contém</span>
                          {p.alergenos.split(",").map((a) => a.trim()).filter(Boolean).map((a) => <span key={a} className="selo selo-laranja">{a}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Modal titulo="Editar pão" gatilho={<Pencil size={15} />} gatilhoClasse="btn-ghost !p-2" largo><FormPao semanaId={id} pao={p} /></Modal>
                      <form action={excluirPao}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="semana_id" value={id} />
                        <SubmitButton className="btn-ghost !p-2 hover:!bg-red-50 hover:!text-red-700"><span className="sr-only">Excluir pão</span><Trash2 size={15} /></SubmitButton></form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cartao">
            <div className="cartao-titulo">Situação da semana</div>
            <form action={salvarSemana} className="grid grid-cols-2 gap-4">
              <input type="hidden" name="id" value={id} />
              <div><label className="rotulo">Situação</label>
                <select className="campo" name="status" defaultValue={s.status}>{Object.entries(STATUS_SEMANA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="rotulo">Observação</label><input className="campo" name="observacao" defaultValue={s.observacao ?? ""} /></div>
              <div className="col-span-2 flex justify-end"><SubmitButton>Salvar</SubmitButton></div>
            </form>
            {!hist && (
              <form action={excluirSemana} className="mt-2 border-t border-stone-100 pt-3">
                <input type="hidden" name="id" value={id} />
                <button className="text-sm text-stone-400 underline hover:text-red-700">Excluir esta semana</button>
              </form>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="cartao">
            <div className="cartao-titulo">Ações da semana</div>
            <div className="flex flex-col gap-2">
              <form action={abrirSemana}><input type="hidden" name="id" value={id} />
                <SubmitButton className="btn w-full">{aberta ? <><RefreshCw size={16} />Atualizar entregas</> : <><Rocket size={16} />Abrir semana (gerar entregas)</>}</SubmitButton></form>
              <form action={avisarSaborMembros}><input type="hidden" name="id" value={id} />
                <SubmitButton className="btn-sec w-full"><Bell size={16} />Avisar os pães aos membros</SubmitButton></form>
              <form action={alternarListaFechada}><input type="hidden" name="id" value={id} /><input type="hidden" name="fechar" value={s.lista_fechada ? "0" : "1"} />
                <SubmitButton className="btn-sec w-full">{s.lista_fechada ? <><LockOpen size={16} />Reabrir lista</> : <><Lock size={16} />Fechar lista do dia</>}</SubmitButton></form>
              <form action={alternarSemProducao}><input type="hidden" name="id" value={id} /><input type="hidden" name="ligar" value={s.sem_producao ? "0" : "1"} />
                <SubmitButton className="btn-sec w-full">{s.sem_producao ? <><Undo2 size={16} />Voltar a produzir</> : <><Moon size={16} />Marcar sem produção</>}</SubmitButton></form>
            </div>
            <p className="ajuda mt-3">Fechar a lista congela quem entra no dia: pagamentos feitos depois não reativam a entrega.</p>
          </section>

          <section className="cartao !p-0">
            <div className="cartao-titulo !mb-0 px-5 pt-5">Pular esta semana <span className="text-xs font-normal text-stone-500">sem pausar a assinatura</span></div>
            <ul className="mt-2 max-h-80 divide-y divide-stone-100 overflow-y-auto">
              {assinaturas?.map((a) => {
                const p = pulou.has(a.id);
                return (
                  <li key={a.id}>
                    <form action={alternarPulo} className="flex items-center gap-2 px-5 py-2.5">
                      <input type="hidden" name="semana_id" value={id} /><input type="hidden" name="assinatura_id" value={a.id} /><input type="hidden" name="pular" value={p ? "0" : "1"} />
                      <span className="flex-1 text-sm font-medium">{nomeCompleto(um(a.clientes as never))}</span>
                      {!p && <input className="campo !w-32 !py-1 text-sm" name="motivo" placeholder="Motivo" />}
                      <SubmitButton className={p ? "btn btn-pequeno" : "btn-sec btn-pequeno"}>{p ? "Voltar" : "Pular"}</SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
