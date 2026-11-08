import { ArrowRight, MapPin, Pencil, Store, Truck, Users } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirAdmin, exigirEquipe } from "@/lib/auth";
import { MODALIDADES, dataBR, hojeISO, paraCentavos, reais } from "@/lib/format";

async function atualizarPlano(f: FormData) {
  "use server";
  const { supabase } = await exigirAdmin();
  const valor = paraCentavos(String(f.get("valor") ?? ""));
  if (valor === null) return;
  // Assinaturas guardam o valor contratado; mudar o plano não reescreve o passado.
  await supabase
    .from("planos")
    .update({ valor_centavos: valor, vigencia_inicio: String(f.get("vigencia") || hojeISO()), ativo: f.get("ativo") === "on" })
    .eq("id", String(f.get("id")));
  revalidatePath("/planos");
}

const MODALIDADE_INFO = {
  entrega: { icone: Truck, texto: "Entregue na casa do cliente, por uma rota." },
  coleta_ponto: { icone: MapPin, texto: "Retirada num ponto de coleta parceiro." },
  coleta_padaria: { icone: Store, texto: "Retirada na própria padaria." },
} as const;

export default async function Planos() {
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
      />

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
              <div className="grid grid-cols-2 gap-4">
                {lista.map((p) => {
                  const u = uso.get(p.id) ?? { n: 0, receita: 0 };
                  return (
                    <article key={p.id} className={`cartao flex flex-col gap-3 ${p.ativo ? "" : "opacity-60"}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{p.paes_por_semana} pão{p.paes_por_semana > 1 ? "es" : ""} por semana</div>
                          <div className="text-xs text-stone-500">Preço vigente desde {dataBR(p.vigencia_inicio)}</div>
                        </div>
                        {!p.ativo && <Badge>Descontinuado</Badge>}
                      </div>
                      <div className="text-3xl font-semibold tracking-tight">{reais(p.valor_centavos)}<span className="text-sm font-normal text-stone-500">/mês</span></div>
                      <div className="mt-auto flex items-center gap-2 border-t border-stone-100 pt-3">
                        <Link href={`/clientes?plano=${p.id}`} className="flex flex-1 items-center gap-2 text-sm text-stone-700 hover:text-amber-900">
                          <Users size={15} className="text-stone-400" />
                          <span><b>{u.n}</b> cliente{u.n === 1 ? "" : "s"} · {reais(u.receita)}/mês</span>
                        </Link>
                        {admin && (
                          <Modal titulo={`${MODALIDADES[m]} · ${p.paes_por_semana} pão${p.paes_por_semana > 1 ? "es" : ""}`} descricao="O novo preço vale para novas assinaturas. Quem já assina mantém o valor contratado."
                            gatilho={<><Pencil size={14} />Editar</>} gatilhoClasse="btn-sec btn-pequeno">
                            <form action={atualizarPlano} className="flex flex-col gap-4">
                              <input type="hidden" name="id" value={p.id} />
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
