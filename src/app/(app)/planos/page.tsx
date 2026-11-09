import { HeartHandshake, MapPin, Pencil, Plus, Store, Truck, Wheat } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirAdmin, exigirEquipe } from "@/lib/auth";
import { MODALIDADES, dataBR, hojeISO, paraCentavos, reais } from "@/lib/format";

const pluralPaes = (n: number) => (n === 0 ? "Sem pães" : `${n} ${n > 1 ? "pães" : "pão"}`);
type Mod = keyof typeof MODALIDADES;

async function atualizarPlano(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  const valor = paraCentavos(String(f.get("valor") ?? ""));
  const nome = String(f.get("nome") ?? "").trim();
  const paes = Number(f.get("paes"));
  const apoio = f.get("modalidade") === "apoio";
  if (valor === null || !nome || !Number.isInteger(paes) || paes < (apoio ? 0 : 1) || paes > 30) redirect("/planos?erro=Informe+o+nome%2C+os+p%C3%A3es+por+semana+e+um+valor+v%C3%A1lido.");
  // Assinaturas guardam o valor contratado; mudar o plano não reescreve o passado.
  const { error } = await supabase
    .from("planos")
    .update({ nome, paes_por_semana: paes, valor_centavos: valor, vigencia_inicio: String(f.get("vigencia") || hojeISO()), ativo: f.get("ativo") === "on" })
    .eq("id", String(f.get("id")));
  if (error) redirect(`/planos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/planos");
}

async function criarPlano(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  const modalidade = String(f.get("modalidade")) as Mod;
  const paes = Number(f.get("paes"));
  const valor = paraCentavos(String(f.get("valor") ?? ""));
  if (!(modalidade in MODALIDADES) || !Number.isInteger(paes) || paes < (modalidade === "apoio" ? 0 : 1) || paes > 30 || valor === null)
    redirect("/planos?erro=Confira+a+modalidade%2C+a+quantidade+de+p%C3%A3es+e+o+valor.");
  const nome = String(f.get("nome") ?? "").trim() || (paes === 0 ? MODALIDADES[modalidade] : `${MODALIDADES[modalidade]} · ${pluralPaes(paes)}/semana`);
  const { error } = await supabase.from("planos").insert({ nome, modalidade, paes_por_semana: paes, valor_centavos: valor });
  if (error) redirect(`/planos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/planos");
  revalidatePath("/clientes/novo");
}

function FormNovoPlano({ modalidade }: { modalidade: Mod }) {
  return (
    <form action={criarPlano} className="flex flex-col gap-4">
      <input type="hidden" name="modalidade" value={modalidade} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="rotulo">Pães por semana <span className="text-red-500">*</span></label><input className="campo" type="number" name="paes" min={modalidade === "apoio" ? 0 : 1} max={30} defaultValue={modalidade === "apoio" ? 0 : 1} required /></div>
        <div><label className="rotulo">Valor mensal (R$) <span className="text-red-500">*</span></label><input className="campo" name="valor" placeholder="80,00" required /></div>
      </div>
      <div><label className="rotulo">Nome do plano <span className="font-normal text-stone-400">(opcional)</span></label><input className="campo" name="nome" placeholder="Ex.: Valor solidário" /><p className="ajuda">Em branco, o nome é montado com a modalidade e os pães por semana. A quantidade de pães é um dado do plano, não depende do nome.</p></div>
      <div className="flex justify-end"><SubmitButton>Criar plano</SubmitButton></div>
    </form>
  );
}

const COLUNAS: Record<Mod, { icone: typeof Truck; texto: string; tile: string; barra: string }> = {
  entrega: { icone: Truck, texto: "Entregue na casa do cliente, por uma rota.", tile: "bg-amber-100 text-amber-800", barra: "bg-amber-500" },
  coleta_ponto: { icone: MapPin, texto: "Retirada num ponto de coleta parceiro.", tile: "bg-teal-100 text-teal-800", barra: "bg-teal-500" },
  coleta_padaria: { icone: Store, texto: "Retirada na própria padaria.", tile: "bg-rose-100 text-rose-800", barra: "bg-rose-500" },
  apoio: { icone: HeartHandshake, texto: "Contribui todo mês, sem receber pão.", tile: "bg-violet-100 text-violet-800", barra: "bg-violet-500" },
};

export default async function Planos({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, usuario } = await exigirEquipe();
  const admin = usuario.perfil === "admin";
  const [{ data: planos }, { data: assinaturas }] = await Promise.all([
    supabase.from("planos").select("*").order("paes_por_semana").order("valor_centavos"),
    supabase.from("assinaturas").select("plano_id, valor_centavos, status").eq("status", "ativa"),
  ]);

  const uso = new Map<string, { n: number; receita: number }>();
  for (const a of assinaturas ?? []) {
    const u = uso.get(a.plano_id) ?? { n: 0, receita: 0 };
    u.n++; u.receita += a.valor_centavos;
    uso.set(a.plano_id, u);
  }
  const maiorUso = Math.max(1, ...[...uso.values()].map((u) => u.n));

  return (
    <>
      <PageHeader titulo="Planos" subtitulo="O que o clube vende. Cada plano tem uma modalidade, uma quantidade de pães por semana e um preço mensal." />
      {erro && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 shadow-sm">{erro}</p>}

      <div className="flex flex-col gap-9">
        {(Object.keys(COLUNAS) as Mod[]).map((m) => {
          const col = COLUNAS[m];
          const lista = (planos ?? []).filter((p) => p.modalidade === m);
          const clientes = lista.reduce((n, p) => n + (uso.get(p.id)?.n ?? 0), 0);
          return (
            <section key={m} aria-labelledby={`mod-${m}`}>
              <header className="mb-4 flex items-center gap-3.5">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${col.tile}`}><col.icone size={20} /></span>
                <div className="min-w-0 flex-1">
                  <h2 id={`mod-${m}`} className="text-lg font-semibold leading-tight tracking-tight">{MODALIDADES[m]}</h2>
                  <p className="text-sm text-stone-500">{col.texto}</p>
                </div>
                <span className="hidden text-sm text-stone-400 sm:block">{lista.length} {lista.length === 1 ? "plano" : "planos"} · {clientes} {clientes === 1 ? "cliente" : "clientes"}</span>
              </header>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] items-stretch gap-4">
                {lista.map((p) => {
                  const u = uso.get(p.id) ?? { n: 0, receita: 0 };
                  const nomeAuto = p.nome === (p.paes_por_semana === 0 ? MODALIDADES[m] : `${MODALIDADES[m]} · ${pluralPaes(p.paes_por_semana)}/semana`);
                  return (
                    <article key={p.id} className={`flex h-full flex-col gap-4 rounded-[24px] bg-painel p-5 ring-1 ring-stone-900/[0.04] transition hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(28,25,23,.35)] hover:ring-stone-900/10 ${p.ativo ? "" : "opacity-60"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${col.tile}`}><Wheat size={14} />{p.paes_por_semana === 0 ? "Sem pães" : `${pluralPaes(p.paes_por_semana)} por semana`}</span>
                        {!p.ativo && <Badge>Descontinuado</Badge>}
                      </div>
                      <div>
                        <div className="text-[30px] font-semibold leading-none tracking-tight tabular-nums">{reais(p.valor_centavos)}<span className="text-sm font-normal text-stone-500"> /mês</span></div>
                        {!nomeAuto && <p className="mt-1.5 line-clamp-2 text-sm text-stone-500">{p.nome}</p>}
                      </div>
                      <div className="mt-auto">
                        <div className="mb-1.5 flex items-center justify-between text-xs text-stone-500">
                          <Link href={`/clientes?plano=${p.id}`} className="font-medium text-stone-700 hover:text-amber-900"><b>{u.n}</b> {u.n === 1 ? "cliente" : "clientes"}</Link>
                          <span>{reais(u.receita)}/mês</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white shadow-inner"><div className={`h-full rounded-full ${col.barra}`} style={{ width: `${(u.n / maiorUso) * 100}%` }} /></div>
                      </div>
                      {admin && (
                        <div className="flex items-center justify-between border-t border-stone-200/70 pt-3 text-xs text-stone-400">
                          <span>Desde {dataBR(p.vigencia_inicio)}</span>
                          <Modal titulo="Editar plano" descricao="O novo preço vale para novas assinaturas. Quem já assina mantém o valor contratado."
                            gatilho={<><Pencil size={13} />Editar</>} gatilhoClasse="btn-ghost !px-2 !py-1 text-xs">
                            <form action={atualizarPlano} className="flex flex-col gap-4">
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="modalidade" value={m} />
                              <div className="grid grid-cols-2 gap-3">
                                <div><label className="rotulo">Pães por semana <span className="text-red-500">*</span></label><input className="campo" type="number" name="paes" min={m === "apoio" ? 0 : 1} max={30} defaultValue={p.paes_por_semana} required /></div>
                                <div><label className="rotulo">Valor mensal (R$) <span className="text-red-500">*</span></label><input className="campo" name="valor" defaultValue={(p.valor_centavos / 100).toFixed(2).replace(".", ",")} required /></div>
                              </div>
                              <div><label className="rotulo">Nome do plano</label><input className="campo" name="nome" defaultValue={p.nome} required /></div>
                              <div><label className="rotulo">Vale a partir de</label><input className="campo" type="date" name="vigencia" defaultValue={p.vigencia_inicio} /></div>
                              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Mudar os pães por semana vale para as próximas semanas geradas. Semanas já abertas e entregas já divididas continuam como estão.</p>
                              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} className="size-4 accent-amber-700" />Plano disponível para novas assinaturas</label>
                              <div className="flex justify-end"><SubmitButton>Salvar plano</SubmitButton></div>
                            </form>
                          </Modal>
                        </div>
                      )}
                    </article>
                  );
                })}
                {admin && (
                  <Modal titulo={`Novo plano · ${MODALIDADES[m]}`} descricao="Entra no catálogo e já pode ser escolhido no cadastro de clientes."
                    gatilho={<><span className="flex size-11 items-center justify-center rounded-full bg-stone-100 transition group-hover:bg-amber-100"><Plus size={20} /></span><span className="font-semibold">Novo plano</span><span className="text-[13px] text-stone-400">{MODALIDADES[m]}</span></>} gatilhoClasse="cartao-novo group">
                    <FormNovoPlano modalidade={m} />
                  </Modal>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
