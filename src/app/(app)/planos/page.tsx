import { ArrowRight, MapPin, Pencil, Plus, Store, Truck, Users } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirAdmin, exigirEquipe } from "@/lib/auth";
import { MODALIDADES, dataBR, hojeISO, paraCentavos, reais } from "@/lib/format";

const pluralPaes = (n: number) => `${n} pão${n > 1 ? "es" : ""}`;

async function atualizarPlano(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  const valor = paraCentavos(String(f.get("valor") ?? ""));
  const nome = String(f.get("nome") ?? "").trim();
  if (valor === null || !nome) redirect("/planos?erro=Informe+o+nome+e+um+valor+v%C3%A1lido.");
  // Assinaturas guardam o valor contratado; mudar o plano não reescreve o passado.
  const { error } = await supabase
    .from("planos")
    .update({ nome, valor_centavos: valor, vigencia_inicio: String(f.get("vigencia") || hojeISO()), ativo: f.get("ativo") === "on" })
    .eq("id", String(f.get("id")));
  if (error) redirect(`/planos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/planos");
}

async function criarPlano(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  const modalidade = String(f.get("modalidade")) as keyof typeof MODALIDADES;
  const paes = Number(f.get("paes"));
  const valor = paraCentavos(String(f.get("valor") ?? ""));
  if (!(modalidade in MODALIDADES) || !Number.isInteger(paes) || paes < 1 || paes > 30 || valor === null)
    redirect("/planos?erro=Confira+a+modalidade%2C+a+quantidade+de+p%C3%A3es+e+o+valor.");
  const nome = String(f.get("nome") ?? "").trim() || `${MODALIDADES[modalidade]} · ${pluralPaes(paes)}/semana`;
  const { error } = await supabase.from("planos").insert({ nome, modalidade, paes_por_semana: paes, valor_centavos: valor });
  if (error) redirect(`/planos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/planos");
  revalidatePath("/clientes/novo");
}

const MODALIDADE_INFO = {
  entrega: { icone: Truck, texto: "Entregue na casa do cliente, por uma rota." },
  coleta_ponto: { icone: MapPin, texto: "Retirada num ponto de coleta parceiro." },
  coleta_padaria: { icone: Store, texto: "Retirada na própria padaria." },
} as const;

export default async function Planos({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, usuario } = await exigirEquipe();
  const admin = usuario.perfil === "admin";
  const [{ data: planos }, { data: assinaturas }] = await Promise.all([
    supabase.from("planos").select("*").order("paes_por_semana"),
    supabase.from("assinaturas").select("plano_id, valor_centavos, status").eq("status", "ativa"),
  ]);

  const uso = new Map<string, { n: number; receita: number }>();
  for (const a of assinaturas ?? []) {
    const u = uso.get(a.plano_id) ?? { n: 0, receita: 0 };
    u.n++; u.receita += a.valor_centavos;
    uso.set(a.plano_id, u);
  }
  const totalAssinaturas = [...uso.values()].reduce((s, u) => s + u.n, 0);
  const receitaTotal = [...uso.values()].reduce((s, u) => s + u.receita, 0);

  return (
    <>
      <PageHeader
        titulo="Planos e preços"
        subtitulo="O catálogo de ofertas do clube. Os planos não têm clientes próprios: cada cliente tem uma assinatura que aponta para um plano."
        etiqueta={<Badge tom="cinza">{totalAssinaturas} assinaturas ativas · {reais(receitaTotal)}/mês</Badge>}
        acoes={admin ? (
          <Modal titulo="Novo plano" descricao="Entra no catálogo e já pode ser escolhido no cadastro de clientes." gatilho={<><Plus size={16} />Novo plano</>} gatilhoClasse="btn">
            <form action={criarPlano} className="flex flex-col gap-4">
              <div>
                <label className="rotulo">Modalidade <span className="text-red-500">*</span></label>
                <select className="campo" name="modalidade" required defaultValue="entrega">
                  {(Object.keys(MODALIDADES) as (keyof typeof MODALIDADES)[]).map((m) => <option key={m} value={m}>{MODALIDADES[m]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="rotulo">Pães por semana <span className="text-red-500">*</span></label><input className="campo" type="number" name="paes" min={1} max={30} defaultValue={1} required /></div>
                <div><label className="rotulo">Valor mensal (R$) <span className="text-red-500">*</span></label><input className="campo" name="valor" placeholder="80,00" required /></div>
              </div>
              <div><label className="rotulo">Nome do plano</label><input className="campo" name="nome" placeholder="Opcional. Ex.: Entrega em casa · valor solidário" /><p className="ajuda">Se ficar em branco, o nome é montado com a modalidade e a quantidade de pães.</p></div>
              <div className="flex justify-end"><SubmitButton>Criar plano</SubmitButton></div>
            </form>
          </Modal>
        ) : undefined}
      />

      {erro && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

      <div className="cartao mb-6 flex items-start gap-4 !p-4 text-sm">
        {[["Plano", "o que o clube oferece e por quanto"], ["Assinatura", "o plano que um cliente contratou (e o valor combinado)"], ["Cobrança", "gerada todo mês a partir da assinatura"]].map(([t, d], i) => (
          <div key={t} className="flex flex-1 items-center gap-4">
            <div><div className="font-semibold">{t}</div><div className="text-stone-500">{d}</div></div>
            {i < 2 && <ArrowRight size={18} className="shrink-0 text-stone-300" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-7">
        {(Object.keys(MODALIDADES) as (keyof typeof MODALIDADES)[]).map((m) => {
          const lista = planos?.filter((p) => p.modalidade === m) ?? [];
          if (!lista.length) return null;
          const Info = MODALIDADE_INFO[m];
          return (
            <section key={m}>
              <div className="mb-3 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Info.icone size={18} /></span>
                <div><h2 className="font-semibold leading-tight">{MODALIDADES[m]}</h2><p className="text-sm text-stone-500">{Info.texto}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {lista.map((p) => {
                  const u = uso.get(p.id) ?? { n: 0, receita: 0 };
                  return (
                    <article key={p.id} className={`cartao flex flex-col gap-3 ${p.ativo ? "" : "opacity-60"}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="font-medium leading-snug">{p.nome}</div>
                          <div className="text-xs text-stone-500">{pluralPaes(p.paes_por_semana)} por semana · desde {dataBR(p.vigencia_inicio)}</div>
                        </div>
                        {!p.ativo && <Badge>Descontinuado</Badge>}
                      </div>
                      <div className="text-3xl font-semibold tracking-tight">{reais(p.valor_centavos)}<span className="text-sm font-normal text-stone-500">/mês</span></div>
                      <div className="mt-auto flex items-center gap-2 border-t border-stone-100 pt-3">
                        <Link href={`/clientes?plano=${p.id}`} className="flex flex-1 items-center gap-2 text-sm text-stone-700 hover:text-amber-900">
                          <Users size={15} className="text-stone-400" />
                          <span><b>{u.n}</b> cliente{u.n === 1 ? "" : "s"}<span className="text-stone-400"> · {reais(u.receita)}/mês</span></span>
                        </Link>
                        {admin && (
                          <Modal titulo="Editar plano" descricao="O novo preço vale para novas assinaturas. Quem já assina mantém o valor contratado."
                            gatilho={<><Pencil size={14} />Editar</>} gatilhoClasse="btn-sec btn-pequeno">
                            <form action={atualizarPlano} className="flex flex-col gap-4">
                              <input type="hidden" name="id" value={p.id} />
                              <div><label className="rotulo">Nome do plano</label><input className="campo" name="nome" defaultValue={p.nome} required /></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div><label className="rotulo">Valor mensal (R$)</label><input className="campo" name="valor" defaultValue={(p.valor_centavos / 100).toFixed(2).replace(".", ",")} required /></div>
                                <div><label className="rotulo">Vale a partir de</label><input className="campo" type="date" name="vigencia" defaultValue={p.vigencia_inicio} /></div>
                              </div>
                              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} className="size-4 accent-amber-700" />Plano disponível para novas assinaturas</label>
                              <div className="flex justify-end"><SubmitButton>Salvar plano</SubmitButton></div>
                            </form>
                          </Modal>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
