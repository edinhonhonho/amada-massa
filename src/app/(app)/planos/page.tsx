import { revalidatePath } from "next/cache";
import { exigirEquipe, exigirAdmin } from "@/lib/auth";
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

export default async function Planos() {
  const { supabase, usuario } = await exigirEquipe();
  const { data } = await supabase.from("planos").select("*").order("modalidade").order("paes_por_semana");
  const admin = usuario.perfil === "admin";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Planos</h1>
      <p className="text-stone-600">Preços são editáveis. A mudança vale para novas assinaturas; quem já assina mantém o valor contratado.</p>
      <ul className="flex flex-col gap-3">
        {data?.map((p) => (
          <li key={p.id} className="cartao">
            <div className="font-medium">{p.nome}</div>
            <div className="text-sm text-stone-600">{MODALIDADES[p.modalidade as keyof typeof MODALIDADES]} · {p.paes_por_semana} pão/sem · vigência {dataBR(p.vigencia_inicio)}</div>
            {admin ? (
              <form action={atualizarPlano} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input className="campo w-32" name="valor" defaultValue={(p.valor_centavos / 100).toFixed(2).replace(".", ",")} />
                <input className="campo w-44" type="date" name="vigencia" defaultValue={p.vigencia_inicio} />
                <label className="flex items-center gap-1"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo</label>
                <button className="btn-sec">Salvar</button>
              </form>
            ) : <div className="mt-1 font-semibold">{reais(p.valor_centavos)}/mês</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
