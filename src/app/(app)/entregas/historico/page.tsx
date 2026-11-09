import { Camera, CheckCircle2, Download, PlayCircle, Truck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import Badge, { type Tom } from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import Stat from "@/components/ui/Stat";
import SubmitButton from "@/components/ui/SubmitButton";
import Vazio from "@/components/ui/Vazio";
import { exigirEquipe } from "@/lib/auth";
import { nomeCompleto, um } from "@/lib/dados";
import { dataBR } from "@/lib/format";
import { STATUS_ENTREGA } from "@/lib/semana";
import { tratarPendencia } from "../actions";

const TOM: Record<string, Tom> = { entregue: "verde", retirada: "verde", nao_entregue: "vermelho", suspensa_atraso: "laranja", pulada: "cinza", programada: "azul", reagendada: "ambar" };

export default async function Historico({ searchParams }: { searchParams: Promise<{ semana?: string; rota?: string }> }) {
  const { supabase, usuario } = await exigirEquipe();
  const b = await searchParams;
  const { data: semanas } = await supabase.from("semanas").select("id, inicio, sabor").order("inicio", { ascending: false }).limit(30);
  const semanaId = b.semana ?? semanas?.[0]?.id;

  let q = supabase.from("entregas").select("id, rota_nome, ponto_nome, status, ocorrencia, observacao, qtd_prevista, entregue_em, foto_path, clientes(nome, sobrenome), cliente_id, usuarios(nome)").eq("semana_id", semanaId ?? "");
  if (b.rota) q = q.eq("rota_nome", b.rota);
  const [{ data }, { data: pend }, { data: execucoes }] = await Promise.all([
    q.order("rota_nome").order("ordem"),
    supabase.from("entregas").select("id, rota_nome, ponto_nome, ocorrencia, semanas(inicio), clientes(nome, sobrenome)").eq("status", "nao_entregue").order("entregue_em", { ascending: false }).limit(50),
    supabase.from("rota_execucoes").select("iniciada_em, finalizada_em, rotas(nome), usuarios(nome)").eq("semana_id", semanaId ?? ""),
  ]);

  // links temporários (1 h) para as fotos, que ficam em armazenamento privado
  const caminhos = (data ?? []).map((e) => e.foto_path).filter((x): x is string => !!x);
  const urls = new Map<string, string>();
  if (caminhos.length) {
    const { data: assinadas } = await supabase.storage.from("entregas-fotos").createSignedUrls(caminhos, 3600);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
  }
  const quemFez = (u: unknown) => (um(u as { nome: string } | { nome: string }[] | null))?.nome;
  const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—");

  const porDestino = new Map<string, Record<string, number>>();
  for (const e of data ?? []) {
    const k = e.rota_nome ?? e.ponto_nome ?? "Sem rota";
    const r = porDestino.get(k) ?? {};
    r[e.status] = (r[e.status] ?? 0) + 1;
    porDestino.set(k, r);
  }
  const rotasNomes = [...new Set((data ?? []).map((e) => e.rota_nome).filter(Boolean))] as string[];
  const totais = { ok: 0, falha: 0, pend: 0 };
  for (const e of data ?? []) {
    if (["entregue", "retirada"].includes(e.status)) totais.ok++;
    else if (e.status === "nao_entregue") totais.falha++;
    else if (["programada", "reagendada"].includes(e.status)) totais.pend++;
  }
  const semanaAtual = semanas?.find((s) => s.id === semanaId);

  return (
    <>
      <PageHeader
        titulo="Entregas"
        etiqueta={<Badge tom="cinza">Passo 3 · Entregar</Badge>}
        subtitulo="Acompanhe a execução das rotas, as ocorrências e o histórico, com hora, observação e foto de cada parada."
        acoes={usuario.perfil === "admin" ? <Link className="btn-sec" href={`/exportar/entregas${semanaId ? `?semana=${semanaId}` : ""}`}><Download size={16} />Exportar CSV</Link> : undefined}
      />

      {(pend?.length ?? 0) > 0 && (
        <section className="cartao mb-5 overflow-hidden  !p-0">
          <h2 className="flex items-center gap-2 border-b border-stone-100 bg-red-50/60 px-5 py-3 text-sm font-semibold text-red-900"><TriangleAlert size={16} />Pendências: {pend?.length} entrega(s) não concluída(s)</h2>
          <ul className="divide-y divide-stone-100">
            {pend?.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1"><b>{nomeCompleto(um(e.clientes as never))}</b>
                  <span className="text-stone-500"> · {e.rota_nome ?? e.ponto_nome} · semana {dataBR((um(e.semanas as never) as { inicio: string } | null)?.inicio)} · {e.ocorrencia}</span></div>
                {(["reagendada", "programada"] as const).map((st) => (
                  <form key={st} action={tratarPendencia}>
                    <input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={st} />
                    <SubmitButton className="btn-sec btn-pequeno">{st === "reagendada" ? "Reagendar" : "Reprogramar"}</SubmitButton>
                  </form>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="mb-5 flex items-center gap-2">
        <select className="campo !w-auto" name="semana" defaultValue={semanaId}>{semanas?.map((s) => <option key={s.id} value={s.id}>Semana de {dataBR(s.inicio)}{s.sabor ? ` · ${s.sabor}` : ""}</option>)}</select>
        <select className="campo !w-auto" name="rota" defaultValue={b.rota ?? ""}><option value="">Todas as rotas</option>{rotasNomes.map((r) => <option key={r}>{r}</option>)}</select>
        <button className="btn-sec">Filtrar</button>
      </form>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat rotulo="Entregues" valor={totais.ok} icone={CheckCircle2} tom="verde" detalhe={semanaAtual ? `Semana de ${dataBR(semanaAtual.inicio)}` : undefined} />
        <Stat rotulo="A entregar" valor={totais.pend} icone={Truck} tom="azul" />
        <Stat rotulo="Não entregues" valor={totais.falha} icone={TriangleAlert} tom={totais.falha ? "vermelho" : "neutro"} />
      </div>

      {(execucoes?.length ?? 0) > 0 && (
        <section className="cartao mb-5">
          <div className="cartao-titulo"><PlayCircle size={17} className="text-stone-400" />Rotas da semana</div>
          <ul className="divide-y divide-stone-100 text-sm">
            {execucoes?.map((x, i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <b className="w-24">{(um(x.rotas as never) as { nome: string } | null)?.nome}</b>
                <span className="text-stone-600">Início {hhmm(x.iniciada_em)}</span>
                <span className="text-stone-600">{x.finalizada_em ? `Fim ${hhmm(x.finalizada_em)}` : ""}</span>
                <span className="flex-1 text-stone-400">{quemFez(x.usuarios)}</span>
                <Badge tom={x.finalizada_em ? "verde" : "azul"} ponto>{x.finalizada_em ? "Finalizada" : "Em andamento"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cartao overflow-hidden !p-0">
        {!data?.length ? <Vazio icone={Truck} titulo="Sem entregas nesta semana" texto="Abra a semana em Planejamento: as entregas são criadas a partir das assinaturas ativas." /> : (
          <table className="tabela">
            <thead><tr><th>Cliente</th><th>Rota ou ponto</th><th>Situação</th><th>Hora</th><th>Quem</th><th>Detalhes</th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/clientes/${e.cliente_id}`} className="font-medium hover:underline">{nomeCompleto(um(e.clientes as never))}</Link></td>
                  <td className="text-stone-600">{e.rota_nome ?? e.ponto_nome ?? "—"}</td>
                  <td><Badge tom={TOM[e.status]}>{STATUS_ENTREGA[e.status]}</Badge></td>
                  <td className="text-stone-600">{hhmm(e.entregue_em)}</td>
                  <td className="text-stone-600">{quemFez(e.usuarios)?.split(" ")[0] ?? "—"}</td>
                  <td className="text-stone-600">
                    {e.ocorrencia && <span className="text-red-700">{e.ocorrencia}. </span>}{e.observacao && <span>“{e.observacao}” </span>}
                    {e.foto_path && urls.get(e.foto_path) && <a href={urls.get(e.foto_path)} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1"><Camera size={13} />foto</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
