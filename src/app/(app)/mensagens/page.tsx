import { TriangleAlert } from "lucide-react";
import { headers } from "next/headers";
import QRCode from "qrcode";
import CentralMensagens, { BotaoNovoAviso, type LinhaHistorico, type NaoEntrou } from "@/components/avisos/CentralMensagens";
import PageHeader from "@/components/ui/PageHeader";
import { exigirEquipe } from "@/lib/auth";
import { carregarModelosAviso, nomeCompleto } from "@/lib/dados";
import { opcoesSegmento } from "@/lib/destinatarios";
import { diagnosticoPush } from "@/lib/notificar";
import { chaveTelefone } from "@/lib/telefone";

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ para?: string; novo?: string }> }) {
  const { supabase } = await exigirEquipe();
  const b = await searchParams;

  const [opcoes, modelos, { data: historico }, { data: ativos }, { data: membros }, { data: pushes }] = await Promise.all([
    opcoesSegmento(supabase, { alcance: true }),
    carregarModelosAviso(supabase),
    supabase.from("avisos_resumo").select("*").order("criado_em", { ascending: false }).limit(30),
    supabase.from("clientes").select("id, nome, sobrenome, email, whatsapp").eq("status", "ativo").order("nome").range(0, 4999),
    supabase.from("membros").select("cliente_id").range(0, 4999),
    supabase.from("push_inscricoes").select("cliente_id").range(0, 4999),
  ]);

  const idsAtivos = new Set((ativos ?? []).map((c) => c.id));
  const entraram = new Set((membros ?? []).map((m) => m.cliente_id).filter((id) => idsAtivos.has(id)));
  const comAvisos = new Set((pushes ?? []).map((p) => p.cliente_id).filter((id) => idsAtivos.has(id)));
  const semEntrar = (ativos ?? []).filter((c) => !entraram.has(c.id));
  // quem não consegue entrar por falta de dado vem primeiro: é o que a equipe pode resolver
  const falta = (c: { email: string | null; whatsapp: string | null }) => (!c.email && !chaveTelefone(c.whatsapp) ? "e-mail e telefone" : !c.email ? "e-mail" : !chaveTelefone(c.whatsapp) ? "telefone com DDD" : null);
  const naoEntraram: NaoEntrou[] = semEntrar.slice(0, 400).map((c) => ({ id: c.id, nome: nomeCompleto(c), falta: falta(c) })).sort((a, b) => Number(!!b.falta) - Number(!!a.falta));

  const linhas = (historico ?? []) as LinhaHistorico[];
  const desde = Date.now() - 30 * 86_400_000;
  const recentes = linhas.filter((l) => new Date(l.criado_em).getTime() >= desde);
  const gravados = recentes.reduce((n, l) => n + l.gravados, 0);
  const lidos = recentes.reduce((n, l) => n + l.lidos, 0);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`}/membro/entrar`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, width: 168, color: { dark: "#292524", light: "#0000" } });
  const problema = diagnosticoPush()[0];

  return (
    <>
      <PageHeader titulo="Mensagens" subtitulo={<>Tudo o que a equipe diz ao cliente vai pelo aplicativo <b className="font-semibold text-stone-700">Amada Massa</b>, a central de avisos dos membros.</>} acoes={<BotaoNovoAviso />} />
      {problema && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div><b>As notificações no celular não estão funcionando.</b> {problema} Os avisos aparecem só dentro do app. Depois de corrigir a variável na Vercel, faça um redeploy.</div>
        </div>
      )}
      <CentralMensagens
        opcoes={opcoes} modelos={modelos} historico={linhas} qr={qr} link={link} abrirInicial={b.novo === "1" || !!b.para} segmentoInicial={b.para}
        indicadores={{ ativos: idsAtivos.size, entraram: entraram.size, comAvisos: comAvisos.size, leitura: gravados ? Math.round((lidos / gravados) * 100) : null, enviados30: recentes.length }}
        naoEntraram={naoEntraram}
      />
    </>
  );
}
