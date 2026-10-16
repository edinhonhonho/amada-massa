import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirEquipe } from "@/lib/auth";
import { CANAIS, STATUS_CLIENTE, dataBR, hojeISO, linkWhatsApp, reais } from "@/lib/format";
import { concluirContato, excluirCliente, mudarStatus, registrarContato, trocarPlano } from "../actions";

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, usuario } = await exigirEquipe();

  const [{ data: c }, { data: assinaturas }, { data: contatos }, { data: planos }, { data: pontos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("assinaturas").select("*, planos(nome, modalidade), pontos_coleta(nome)").eq("cliente_id", id).order("inicio", { ascending: false }),
    supabase.from("contatos").select("*").eq("cliente_id", id).order("data", { ascending: false }).order("criado_em", { ascending: false }),
    supabase.from("planos").select("id, nome, valor_centavos").eq("ativo", true).order("modalidade").order("paes_por_semana"),
    supabase.from("pontos_coleta").select("id, nome").eq("ativo", true),
  ]);
  if (!c) notFound();

  const atual = assinaturas?.find((a) => a.status === "ativa" || a.status === "pausada");
  const wa = linkWhatsApp(c.whatsapp);
  const endereco = [c.logradouro && `${c.logradouro}${c.numero ? ", " + c.numero : ""}`, c.complemento, c.bairro, c.cidade, c.cep].filter(Boolean).join(" · ");

  type Evento = { data: string; texto: string };
  const eventos: Evento[] = [
    ...(contatos ?? []).map((k) => ({ data: k.data, texto: `${CANAIS[k.canal as keyof typeof CANAIS]}: ${k.resumo}` })),
    ...(assinaturas ?? []).flatMap((a) => {
      const p = a.planos as { nome: string } | null;
      const e = [{ data: a.inicio, texto: `Assinatura iniciada — ${p?.nome} (${reais(a.valor_centavos)})` }];
      if (a.fim) e.push({ data: a.fim, texto: `Assinatura ${a.status === "encerrada" ? "encerrada" : a.status}${a.motivo_cancelamento ? ` — ${a.motivo_cancelamento}` : ""}` });
      return e;
    }),
  ].sort((x, y) => y.data.localeCompare(x.data));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{c.nome} {c.sobrenome}</h1>
          <p className="text-stone-600">
            {STATUS_CLIENTE[c.status as keyof typeof STATUS_CLIENTE]}
            {c.status === "pausado" && c.pausa_retorno_previsto && ` · retorno previsto ${dataBR(c.pausa_retorno_previsto)}`}
            {c.status === "cancelado" && ` · ${dataBR(c.cancelado_em)} — ${c.motivo_cancelamento}`}
          </p>
        </div>
        {wa && <a className="btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        <Link className="btn-sec" href={`/clientes/${id}/editar`}>Editar</Link>
      </header>

      <section className="cartao grid gap-2 sm:grid-cols-2">
        <p><b>WhatsApp:</b> {c.whatsapp ?? "—"}</p>
        <p><b>E-mail:</b> {c.email ?? "—"}</p>
        <p className="sm:col-span-2"><b>Endereço:</b> {endereco || "—"}</p>
        {c.referencia_portaria && <p><b>Portaria:</b> {c.referencia_portaria}</p>}
        {c.instrucoes_entrega && <p><b>Instruções:</b> {c.instrucoes_entrega}</p>}
        <p><b>Origem:</b> {c.origem ?? "—"} · confirmou em {dataBR(c.confirmado_em)}</p>
        {c.restricoes_alimentares && <p><b>Restrições:</b> {c.restricoes_alimentares}</p>}
        {c.observacoes && <p className="sm:col-span-2"><b>Obs.:</b> {c.observacoes}</p>}
      </section>

      <section className="cartao flex flex-col gap-3">
        <h2 className="font-semibold">Assinatura</h2>
        {atual ? (
          <p>
            {(atual.planos as { nome: string }).nome} — <b>{reais(atual.valor_centavos)}</b>/mês, vence todo dia {atual.dia_vencimento}
            {atual.pontos_coleta && ` · ${(atual.pontos_coleta as { nome: string }).nome}`}
            {atual.justificativa_valor && <span className="text-stone-500"> ({atual.justificativa_valor})</span>}
          </p>
        ) : <p className="text-stone-500">Sem assinatura ativa.</p>}
        {atual && (
          <details>
            <summary className="cursor-pointer text-amber-800 underline">Trocar de plano</summary>
            <form action={trocarPlano} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="cliente_id" value={id} />
              <input type="hidden" name="assinatura_id" value={atual.id} />
              <select className="campo" name="plano_id" required>
                {planos?.map((p) => <option key={p.id} value={p.id}>{p.nome} — {reais(p.valor_centavos)}</option>)}
              </select>
              <select className="campo" name="ponto_coleta_id" defaultValue={atual.ponto_coleta_id ?? ""}>
                <option value="">Ponto de coleta (se coleta)</option>
                {pontos?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <input className="campo" type="date" name="inicio" defaultValue={hojeISO()} />
              <input className="campo" name="valor" placeholder="Valor personalizado (opcional)" />
              <input className="campo sm:col-span-2" name="justificativa_valor" placeholder="Justificativa, se valor diferente" />
              <button className="btn sm:justify-self-start">Trocar plano</button>
            </form>
          </details>
        )}
        {assinaturas && assinaturas.length > 1 && (
          <ul className="text-sm text-stone-600">
            {assinaturas.filter((a) => a !== atual).map((a) => (
              <li key={a.id}>{(a.planos as { nome: string }).nome} · {dataBR(a.inicio)} → {dataBR(a.fim)} ({a.status})</li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao flex flex-col gap-3">
        <h2 className="font-semibold">Situação</h2>
        {c.status === "ativo" && (
          <div className="flex flex-wrap gap-3">
            <form action={mudarStatus} className="flex gap-2">
              <input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="pausar" />
              <input className="campo" type="date" name="retorno" aria-label="Retorno previsto" />
              <button className="btn-sec">Pausar</button>
            </form>
          </div>
        )}
        {c.status !== "cancelado" && (
          <form action={mudarStatus} className="flex flex-wrap gap-2">
            <input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="cancelar" />
            <input className="campo flex-1" name="motivo" list="motivos" placeholder="Motivo do cancelamento" required />
            <datalist id="motivos">{["preço", "mudança de cidade", "sabor", "logística", "outro"].map((m) => <option key={m} value={m} />)}</datalist>
            <button className="btn-sec">Cancelar assinatura</button>
          </form>
        )}
        {c.status !== "ativo" && (
          <form action={mudarStatus}>
            <input type="hidden" name="cliente_id" value={id} /><input type="hidden" name="acao" value="reativar" />
            <button className="btn">Reativar cliente</button>
          </form>
        )}
      </section>

      <section className="cartao flex flex-col gap-3">
        <h2 className="font-semibold">Registrar contato</h2>
        <form action={registrarContato} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="cliente_id" value={id} />
          <select className="campo" name="canal">{Object.entries(CANAIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className="campo" type="date" name="data" defaultValue={hojeISO()} />
          <textarea className="campo sm:col-span-2" name="resumo" rows={2} placeholder="Resumo do contato" required />
          <input className="campo" name="proximo_passo" placeholder="Próximo passo" />
          <input className="campo" type="date" name="proximo_passo_em" />
          <button className="btn sm:justify-self-start">Salvar contato</button>
        </form>
      </section>

      <section className="cartao">
        <h2 className="mb-2 font-semibold">Linha do tempo</h2>
        <ul className="divide-y divide-stone-100">
          {eventos.map((e, i) => (
            <li key={i} className="py-2"><span className="text-sm text-stone-500">{dataBR(e.data)}</span> {e.texto}</li>
          ))}
        </ul>
        {contatos?.filter((k) => k.proximo_passo && !k.concluido).map((k) => (
          <form key={k.id} action={concluirContato} className="mt-3 flex items-center gap-3 rounded-lg bg-amber-50 p-2">
            <input type="hidden" name="id" value={k.id} /><input type="hidden" name="cliente_id" value={id} />
            <span className="flex-1">Próximo passo: {k.proximo_passo} {k.proximo_passo_em && `(${dataBR(k.proximo_passo_em)})`}</span>
            <button className="btn-sec px-3 py-1.5 text-sm">Concluir</button>
          </form>
        ))}
      </section>

      {usuario.perfil === "admin" && (
        <section className="cartao flex flex-col gap-3 border-red-200">
          <h2 className="font-semibold text-red-800">LGPD (administrador)</h2>
          <a className="btn-sec self-start" href={`/clientes/${id}/exportar`}>Exportar dados do cliente (JSON)</a>
          <form action={excluirCliente} className="flex flex-wrap gap-2">
            <input type="hidden" name="cliente_id" value={id} />
            <input className="campo flex-1" name="confirmacao" placeholder='Digite EXCLUIR para apagar definitivamente' />
            <button className="btn-sec text-red-800">Excluir definitivamente</button>
          </form>
        </section>
      )}
    </div>
  );
}
