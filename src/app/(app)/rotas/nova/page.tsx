import { exigirEquipe } from "@/lib/auth";
import RotaForm from "../RotaForm";

export default async function NovaRota() {
  const { supabase } = await exigirEquipe();
  const { data } = await supabase.from("usuarios").select("id, nome").eq("ativo", true).order("nome");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Nova rota</h1>
      <RotaForm entregadores={data ?? []} />
    </div>
  );
}
