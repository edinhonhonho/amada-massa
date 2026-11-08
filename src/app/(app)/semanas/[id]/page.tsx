import { Bell, Check, ClipboardList, Lock, LockOpen, Moon, PackageCheck, Printer, RefreshCw, Rocket, SkipForward, Truck, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR } from "@/lib/format";
import { STATUS_ENTREGA, STATUS_SEMANA } from "@/lib/semana";
import { abrirSemana, alternarListaFechada, alternarPulo, alternarSemProducao, avisarSaborMembros, excluirSemana, salvarSemana } from "../actions";

export default async function Semana({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ avisados?: string; erro?: string }> }) {
  const { id } = await params;
  const { avisados, erro } = await searchParams;
  const { supabase } = await exigirEquipe();
  const { data: s } = await supabase.from("semanas").select("*").eq("id", id).single();
  if (!s) notFound();

  const [{ data: entregas }, { data: assinaturas }, { data: pulos }] = await Promise.all([
    supabase.from("entregas").select("id, assinatura_id, status, qtd_prevista, rota_nome, ponto_nome, clientes(nome, sobrenome)").eq("semana_id", id),
    supabase.from("assinaturas").select("id, clientes(nome, sobrenome), planos(paes_por_semana)").eq("status", "ativa"),
    supabase.from("pulos_semana").select("assinatura_id").eq("semana_id", id),
  ]);
  const pulou = new Set((pulos ?? []).map((p) => p.assinatura_id));
  const contagem: Record<string, number> = {};
  let paes = 0;
  for (const e of entregas ?? []) {
    contagem[e.status] = (contagem[e.status] ?? 0) + 1;
    if (!["pulada", "suspensa_atraso"].includes(e.status)) paes += e.qtd_prevista;
  }
  const suspensas = (entregas ?? []).filter((e) => e.status === "suspensa_atraso");
  const aberta = (entregas?.length ?? 0) > 0;
  const hist = (entregas ?? []).some((e) => ["entregue", "retirada", "nao_entregue"].includes(e.status));

  const passos = [
    { n: 1, titulo: "Definir o sabor", feito: !!s.sabor || s.sem_producao },
    { n: 2, titulo: "Abrir a semana", feito: aberta || s.sem_producao },
    { n: 3, titulo: "Produzir e imprimir listas", feito: aberta && s.lista_fechada },
    { n: 4, titulo: "Fechar a lista do dia", feito: s.lista_fechada },
  ];

  return (
    <>
      <PageHeader
        voltar={{ href: "/semanas", rotulo: "Semanas" }}
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
      {erro === "sabor" && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Defina o sabor antes de avisar.</p>}

      <div className="mb-5 grid grid-cols-4 gap-3">
        <Stat rotulo="Pães a produzir" valor={paes} icone={PackageCheck} tom="ambar" />
        <Stat rotulo="Entregas programadas" valor={(contagem.programada ?? 0) + (contagem.reagendada ?? 0)} icone={Truck} tom="azul" />
        <Stat rotulo="Entregues" valor={(contagem.entregue ?? 0) + (contagem.retirada ?? 0)} icone={Check} tom="verde" />
        <Stat rotulo="Suspensas por atraso" valor={suspensas.length} icone={SkipForward} tom={suspensas.length ? "vermelho" : "neutro"} detalhe={suspensas.length ? suspensas.map((e) => nomeCompleto(um(e.clientes as never)).split(" ")[0]).join(", ") : undefined} />
      </div>

      <div className="grid grid-cols-[1fr_380px] items-start gap-5">
        <section className="cartao">
          <div className="cartao-titulo">Sabor e detalhes</div>
          <form action={salvarSemana} className="grid grid-cols-2 gap-4">
            <input type="hidden" name="id" value={id} />
            <div><label className="rotulo">Sabor</label><input className="campo" name="sabor" defaultValue={s.sabor ?? ""} placeholder="Ex.: Centeio com sementes" /></div>
            <div><label className="rotulo">Situação da semana</label>
              <select className="campo" name="status" defaultValue={s.status}>{Object.entries(STATUS_SEMANA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="col-span-2"><label className="rotulo">Descrição curta</label><input className="campo" name="descricao" defaultValue={s.descricao ?? ""} /></div>
            <div><label className="rotulo">Ingredientes</label><input className="campo" name="ingredientes" defaultValue={s.ingredientes ?? ""} /></div>
            <div><label className="rotulo">Alérgenos</label><input className="campo" name="alergenos" defaultValue={s.alergenos ?? ""} /></div>
            <div className="col-span-2"><label className="rotulo">Observação</label><input className="campo" name="observacao" defaultValue={s.observacao ?? ""} /></div>
            <div className="col-span-2 flex justify-end"><SubmitButton>Salvar</SubmitButton></div>
          </form>
          {!hist && (
            <form action={excluirSemana} className="mt-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="id" value={id} />
              <button className="text-sm text-stone-400 underline hover:text-red-700">Excluir esta semana</button>
            </form>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section className="cartao">
            <div className="cartao-titulo">Ações da semana</div>
            <div className="flex flex-col gap-2">
              <form action={abrirSemana}><input type="hidden" name="id" value={id} />
                <SubmitButton className="btn w-full">{aberta ? <><RefreshCw size={16} />Atualizar entregas</> : <><Rocket size={16} />Abrir semana (gerar entregas)</>}</SubmitButton></form>
              <form action={avisarSaborMembros}><input type="hidden" name="id" value={id} />
                <SubmitButton className="btn-sec w-full"><Bell size={16} />Avisar sabor aos membros</SubmitButton></form>
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
      {aberta && <p className="mt-6 text-center text-xs text-stone-400"><Printer size={12} className="mr-1 inline" />Status das entregas: {Object.entries(contagem).map(([k, v]) => `${v} ${STATUS_ENTREGA[k].toLowerCase()}`).join(" · ")}</p>}
    </>
  );
}
