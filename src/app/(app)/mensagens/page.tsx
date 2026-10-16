import { revalidatePath } from "next/cache";
import { exigirEquipe } from "@/lib/auth";
import { carregarFaixas, nomeCompleto, um } from "@/lib/dados";
import { hojeISO } from "@/lib/format";
import { VARIAVEIS } from "@/lib/mensagens";
import { primeiroDoMes, situacaoCobranca } from "@/lib/pagamentos";

async function salvarModelo(f: FormData) {
  "use server";
  const { supabase } = await exigirEquipe();
  const texto = String(f.get("texto") ?? "").trim();
  if (!texto) return;
  await supabase.from("modelos_mensagem").update({ texto }).eq("id", String(f.get("id")));
  revalidatePath("/mensagens");
}

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ modelo?: string; segmento?: string }> }) {
  const { supabase } = await exigirEquipe();
  const b = await searchParams;
  const hoje = hojeISO();
  const [{ data: modelos }, { data: rotas }] = await Promise.all([
    supabase.from("modelos_mensagem").select("*").order("nome"),
    supabase.from("rotas").select("id, nome").order("nome"),
  ]);

  let destinatarios: { id: string; nome: string; whatsapp: string | null }[] = [];
  if (b.modelo && b.segmento) {
    let ids: string[] = [];
    if (b.segmento === "pendentes" || b.segmento === "atrasados") {
      const faixas = await carregarFaixas(supabase);
      let q = supabase.from("cobrancas").select("vencimento, status, assinaturas(cliente_id)").eq("status", "pendente");
      if (b.segmento === "pendentes") q = q.eq("competencia", primeiroDoMes(hoje));
      const { data } = await q;
      ids = (data ?? [])
        .filter((c) => b.segmento === "pendentes" || ["atrasado", "atraso_critico"].includes(situacaoCobranca(c, hoje, faixas)))
        .map((c) => (um(c.assinaturas as never) as { cliente_id: string } | null)?.cliente_id ?? "");
    } else if (b.segmento.startsWith("rota:")) {
      const { data } = await supabase.from("atribuicoes_rota").select("cliente_id").eq("rota_id", b.segmento.slice(5)).is("fim", null);
      ids = (data ?? []).map((x) => x.cliente_id);
    } else {
      const { data } = await supabase.from("clientes").select("id").eq("status", "ativo");
      ids = (data ?? []).map((x) => x.id);
    }
    ids = [...new Set(ids.filter(Boolean))];
    if (ids.length) {
      const { data } = await supabase.from("clientes").select("id, nome, sobrenome, whatsapp").in("id", ids).order("nome");
      destinatarios = (data ?? []).map((c) => ({ id: c.id, nome: nomeCompleto(c), whatsapp: c.whatsapp }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Mensagens</h1>

      <section className="cartao flex flex-col gap-3">
        <h2 className="font-semibold">Envio em lote</h2>
        <p className="text-sm text-stone-600">Cada clique abre o WhatsApp com o texto pronto; você confirma o envio. O contato fica registrado na linha do tempo.</p>
        <form className="grid gap-3 sm:grid-cols-3">
          <select className="campo" name="modelo" defaultValue={b.modelo} required>
            <option value="">Modelo…</option>{modelos?.map((m) => <option key={m.id} value={m.chave}>{m.nome}</option>)}
          </select>
          <select className="campo" name="segmento" defaultValue={b.segmento} required>
            <option value="">Quem recebe…</option>
            <option value="pendentes">Pendentes do mês</option>
            <option value="atrasados">Em atraso</option>
            <option value="ativos">Todos os ativos</option>
            {rotas?.map((r) => <option key={r.id} value={`rota:${r.id}`}>Rota {r.nome}</option>)}
          </select>
          <button className="btn">Listar</button>
        </form>
        {b.modelo && (
          <ul className="divide-y divide-stone-100">
            {destinatarios.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <span className="flex-1">{d.nome}</span>
                {d.whatsapp
                  ? <a className="btn-sec px-3 py-1.5 text-sm" target="_blank" href={`/mensagens/enviar?cliente=${d.id}&modelo=${b.modelo}`}>Abrir WhatsApp</a>
                  : <span className="text-sm text-stone-500">sem WhatsApp</span>}
              </li>
            ))}
            {!destinatarios.length && <li className="py-2 text-stone-500">Ninguém neste segmento.</li>}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Modelos</h2>
        <p className="text-sm text-stone-600">Variáveis: {VARIAVEIS.map((v) => `{${v}}`).join(" ")}</p>
        {modelos?.map((m) => (
          <form key={m.id} action={salvarModelo} className="cartao flex flex-col gap-2">
            <input type="hidden" name="id" value={m.id} />
            <label className="rotulo">{m.nome}</label>
            <textarea className="campo" name="texto" rows={3} defaultValue={m.texto} />
            <button className="btn-sec self-start">Salvar</button>
          </form>
        ))}
      </section>
    </div>
  );
}
