import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR } from "@/lib/format";
import { STATUS_ENTREGA, STATUS_SEMANA } from "@/lib/semana";
import { abrirSemana, avisarSaborMembros, alternarListaFechada, alternarPulo, alternarSemProducao, excluirSemana, salvarSemana } from "../actions";

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

  return (
    <div className="flex flex-col gap-4">
      <Link href="/semanas" className="text-sm text-amber-800 underline">← Semanas</Link>
      <h1 className="text-2xl font-bold">Semana {dataBR(s.inicio)} a {dataBR(s.fim)}</h1>
      <p className="text-stone-600">{STATUS_SEMANA[s.status]}{s.sem_producao && " · sem produção"}{s.lista_fechada && " · lista fechada"}</p>

      <section className="cartao">
        <form action={salvarSemana} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={id} />
          <div><label className="rotulo">Sabor</label><input className="campo" name="sabor" defaultValue={s.sabor ?? ""} /></div>
          <div><label className="rotulo">Status</label>
            <select className="campo" name="status" defaultValue={s.status}>{Object.entries(STATUS_SEMANA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="rotulo">Descrição curta</label><input className="campo" name="descricao" defaultValue={s.descricao ?? ""} /></div>
          <div><label className="rotulo">Ingredientes</label><input className="campo" name="ingredientes" defaultValue={s.ingredientes ?? ""} /></div>
          <div><label className="rotulo">Alérgenos</label><input className="campo" name="alergenos" defaultValue={s.alergenos ?? ""} /></div>
          <div className="sm:col-span-2"><label className="rotulo">Observação</label><input className="campo" name="observacao" defaultValue={s.observacao ?? ""} /></div>
          <button className="btn sm:justify-self-start">Salvar</button>
        </form>
      </section>

      <section className="cartao flex flex-col gap-3">
        <h2 className="font-semibold">Planejamento</h2>
        <div className="flex flex-wrap gap-2">
          <form action={abrirSemana}><input type="hidden" name="id" value={id} />
            <button className="btn">{aberta ? "Atualizar entregas da semana" : "Abrir semana (gerar entregas)"}</button></form>
          <form action={alternarListaFechada}><input type="hidden" name="id" value={id} /><input type="hidden" name="fechar" value={s.lista_fechada ? "0" : "1"} />
            <button className="btn-sec">{s.lista_fechada ? "Reabrir lista" : "Fechar lista do dia"}</button></form>
          <form action={avisarSaborMembros}><input type="hidden" name="id" value={id} />
            <button className="btn-sec">Avisar sabor aos membros (app)</button></form>
          <form action={alternarSemProducao}><input type="hidden" name="id" value={id} /><input type="hidden" name="ligar" value={s.sem_producao ? "0" : "1"} />
            <button className="btn-sec">{s.sem_producao ? "Voltar a produzir" : "Marcar sem produção (feriado)"}</button></form>
        </div>
        {avisados !== undefined && <p className="rounded-lg bg-green-50 p-2 text-green-800">Aviso enviado para {avisados} membro(s) com o app.</p>}
        {erro === "sabor" && <p className="rounded-lg bg-red-50 p-2 text-red-800">Defina o sabor antes de avisar.</p>}
        {aberta && (
          <p className="text-stone-700">
            <b>{paes} pães</b> a produzir · {Object.entries(contagem).map(([k, v]) => `${v} ${STATUS_ENTREGA[k].toLowerCase()}`).join(" · ")}
          </p>
        )}
        {aberta && (
          <div className="flex flex-wrap gap-2">
            <Link className="btn-sec" href={`/semanas/${id}/listas/producao`}>Lista de produção</Link>
            <Link className="btn-sec" href={`/semanas/${id}/listas/entrega`}>Lista de entrega</Link>
            <Link className="btn-sec" href={`/semanas/${id}/listas/coleta`}>Lista de coleta</Link>
          </div>
        )}
        {suspensas.length > 0 && (
          <div className="rounded-lg bg-orange-50 p-3 text-sm">
            <b>Suspensas por atraso:</b> {suspensas.map((e) => nomeCompleto(um(e.clientes as never))).join(", ")}
          </div>
        )}
      </section>

      <section className="cartao">
        <h2 className="mb-2 font-semibold">Pular a semana (sem pausar a assinatura)</h2>
        <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
          {assinaturas?.map((a) => {
            const p = pulou.has(a.id);
            return (
              <li key={a.id}>
                <form action={alternarPulo} className="flex items-center gap-2 py-2">
                  <input type="hidden" name="semana_id" value={id} /><input type="hidden" name="assinatura_id" value={a.id} /><input type="hidden" name="pular" value={p ? "0" : "1"} />
                  <span className="flex-1">{nomeCompleto(um(a.clientes as never))}</span>
                  {!p && <input className="campo w-40 py-1.5 text-sm" name="motivo" placeholder="Motivo (viagem…)" />}
                  <button className={p ? "btn" : "btn-sec"}>{p ? "Voltar" : "Pular"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {!hist && (
        <form action={excluirSemana}><input type="hidden" name="id" value={id} /><button className="text-sm text-red-700 underline">Excluir semana</button></form>
      )}
    </div>
  );
}
