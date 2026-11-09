import { BellRing, CheckCheck, Smartphone, Users } from "lucide-react";
import { headers } from "next/headers";
import QRCode from "qrcode";
import PageHeader from "@/components/ui/PageHeader";
import ComporAviso from "@/components/avisos/ComporAviso";
import CopiarLink from "@/components/avisos/CopiarLink";
import Vazio from "@/components/ui/Vazio";
import AvisoEnviado from "@/components/avisos/AvisoEnviado";
import { exigirEquipe } from "@/lib/auth";
import { opcoesSegmento } from "@/lib/destinatarios";
import { quando } from "@/lib/avisos";
import { enviarAvisoApp } from "./actions";

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ aviso?: string; n?: string; push?: string; para?: string }> }) {
  const { supabase } = await exigirEquipe();
  const b = await searchParams;

  const [opcoes, { data: historico }, { count: ativos }, { count: entraram }, { data: pushes }] = await Promise.all([
    opcoesSegmento(supabase),
    supabase.from("avisos_resumo").select("*").order("criado_em", { ascending: false }).limit(30),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("membros").select("user_id, clientes!inner(status)", { count: "exact", head: true }).eq("clientes.status", "ativo"),
    supabase.from("push_inscricoes").select("cliente_id, clientes!inner(status)").eq("clientes.status", "ativo").range(0, 4999),
  ]);
  const comAvisos = new Set((pushes ?? []).map((p) => p.cliente_id)).size;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`}/membro/entrar`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, width: 168, color: { dark: "#292524", light: "#0000" } });

  const pct = (a: number, t: number) => (t ? Math.round((a / t) * 100) : 0);

  return (
    <>
      <PageHeader
        titulo="Mensagens"
        subtitulo={<>Tudo o que a equipe diz ao cliente vai pelo aplicativo <b className="font-semibold text-stone-700">Amada Massa</b>, a central de avisos dos membros.</>}
      />
      <AvisoEnviado aviso={b.aviso} n={b.n} push={b.push} />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section className="cartao">
            <div className="cartao-titulo"><BellRing size={16} className="text-amber-700" />Novo aviso</div>
            <ComporAviso opcoes={opcoes} acao={enviarAvisoApp} segmentoInicial={b.para} />
          </section>

          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Enviados</h2>
            {!historico?.length ? (
              <div className="cartao"><Vazio icone={BellRing} titulo="Nenhum aviso enviado ainda" texto="Os avisos que você enviar aparecem aqui, com quem já leu." /></div>
            ) : (
              <ul className="flex flex-col gap-3">
                {historico.map((a) => {
                  const lidos = pct(a.lidos, a.gravados);
                  return (
                    <li key={a.id} className="cartao !p-4">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-semibold">{a.titulo}</h3>
                        <span className="selo selo-cinza">{a.segmento_rotulo}</span>
                        <span className="ml-auto text-xs text-stone-400">{quando(a.criado_em)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{a.corpo}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-stone-500">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${lidos}% leram`}>
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${lidos}%` }} />
                        </div>
                        <span><CheckCheck size={13} className="mr-1 inline text-emerald-600" />{a.lidos} de {a.gravados} leram</span>
                        <span className="ml-auto">{a.pushes} no celular</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          <section className="cartao">
            <div className="cartao-titulo"><Smartphone size={16} className="text-amber-700" />Aplicativo Amada Massa</div>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Adesao rotulo="Já entraram" valor={entraram ?? 0} total={ativos ?? 0} />
              <Adesao rotulo="Com avisos ativos" valor={comAvisos} total={ativos ?? 0} />
            </div>
            <div className="flex justify-center rounded-xl bg-stone-50 p-3" dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code do aplicativo" role="img" />
            <p className="mt-3 text-sm text-stone-600">Peça ao cliente para abrir o link no celular, entrar com <b>e-mail e telefone</b> do cadastro e instalar o app.</p>
            <CopiarLink link={link} />
          </section>
          <section className="cartao !p-4 text-sm text-stone-600">
            <div className="cartao-titulo !mb-1.5"><Users size={15} className="text-stone-400" />Quem pode entrar</div>
            Só quem tem <b>e-mail e telefone</b> no cadastro. Se algum dos dois estiver diferente, corrija na ficha do cliente.
          </section>
        </aside>
      </div>
    </>
  );
}

function Adesao({ rotulo, valor, total }: { rotulo: string; valor: number; total: number }) {
  const p = total ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{valor}<span className="text-sm font-normal text-stone-400"> / {total}</span></div>
      <div className="text-xs text-stone-500">{rotulo}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-amber-600" style={{ width: `${p}%` }} /></div>
    </div>
  );
}
