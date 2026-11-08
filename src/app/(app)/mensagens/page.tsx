import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { avisarLivre } from "@/lib/avisos-entrega";
import { Bell, MessageCircle, Send } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
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

async function enviarAvisoApp(f: FormData) {
  "use server";
  await exigirEquipe();
  const titulo = String(f.get("titulo") ?? "").trim().slice(0, 80);
  const corpo = String(f.get("corpo") ?? "").trim().slice(0, 300);
  if (!titulo || !corpo) redirect("/mensagens?erro=aviso");
  const rota = String(f.get("rota") ?? "") || undefined;
  const n = await avisarLivre(titulo, corpo, rota);
  redirect(`/mensagens?avisados=${n}`);
}

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ modelo?: string; segmento?: string; avisados?: string; erro?: string }> }) {
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
    <>
      <PageHeader titulo="Mensagens" subtitulo="Fale com os clientes: avisos dentro do app e mensagens de WhatsApp prontas, com o texto já preenchido." />

      <div className="grid grid-cols-2 items-start gap-5">
        <section className="cartao">
          <div className="cartao-titulo"><Bell size={17} className="text-stone-400" />Aviso no app dos membros</div>
          <p className="mb-4 text-sm text-stone-500">Chega como notificação no celular de quem instalou o app e fica guardado na caixa de avisos.</p>
          {b.avisados !== undefined && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Enviado para {b.avisados} membro(s).</p>}
          {b.erro === "aviso" && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Preencha título e texto.</p>}
          <form action={enviarAvisoApp} className="flex flex-col gap-3">
            <div><label className="rotulo">Para quem</label>
              <select className="campo" name="rota" defaultValue=""><option value="">Todos os membros ativos</option>{rotas?.map((r) => <option key={r.id} value={r.id}>Só a rota {r.nome}</option>)}</select></div>
            <div><label className="rotulo">Título</label><input className="campo" name="titulo" maxLength={80} required placeholder="Ex.: Mudança de horário" /></div>
            <div><label className="rotulo">Texto</label><textarea className="campo" name="corpo" rows={3} maxLength={300} required placeholder="O que o cliente precisa saber" /></div>
            <div className="flex justify-end"><SubmitButton><Send size={15} />Enviar aviso</SubmitButton></div>
          </form>
        </section>

        <section className="cartao">
          <div className="cartao-titulo"><MessageCircle size={17} className="text-stone-400" />WhatsApp em lote</div>
          <p className="mb-4 text-sm text-stone-500">Escolha o modelo e quem recebe. Cada clique abre o WhatsApp com o texto pronto; você confirma o envio.</p>
          <form className="mb-3 grid grid-cols-[1fr_1fr_auto] gap-2">
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
            <button className="btn-sec">Listar</button>
          </form>
          {b.modelo && (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {destinatarios.map((d) => (
                <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1 font-medium">{d.nome}</span>
                  {d.whatsapp
                    ? <a className="btn-sec btn-pequeno" target="_blank" href={`/mensagens/enviar?cliente=${d.id}&modelo=${b.modelo}`}><MessageCircle size={14} />Abrir</a>
                    : <span className="text-xs text-stone-400">sem WhatsApp</span>}
                </li>
              ))}
              {!destinatarios.length && <li className="px-3 py-3 text-sm text-stone-500">Ninguém neste segmento.</li>}
            </ul>
          )}
        </section>
      </div>

      <h2 className="mb-1 mt-8 text-lg font-semibold tracking-tight">Modelos de mensagem</h2>
      <p className="mb-3 text-sm text-stone-500">Variáveis disponíveis: {VARIAVEIS.map((v) => <code key={v} className="mr-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs">{`{${v}}`}</code>)}</p>
      <div className="grid grid-cols-2 gap-4">
        {modelos?.map((m) => (
          <form key={m.id} action={salvarModelo} className="cartao flex flex-col gap-2">
            <input type="hidden" name="id" value={m.id} />
            <label className="text-sm font-semibold">{m.nome}</label>
            <textarea className="campo" name="texto" rows={3} defaultValue={m.texto} />
            <div className="flex justify-end"><SubmitButton className="btn-sec btn-pequeno">Salvar</SubmitButton></div>
          </form>
        ))}
      </div>
    </>
  );
}
