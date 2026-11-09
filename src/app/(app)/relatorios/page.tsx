import { BarChart3 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Vazio from "@/components/ui/Vazio";
import { exigirAdmin } from "@/lib/auth";

export default async function Relatorios() {
  await exigirAdmin();
  return (
    <>
      <PageHeader titulo="Relatórios" />
      <div className="cartao"><Vazio icone={BarChart3} titulo="Em breve" texto="Os relatórios vão aparecer aqui." /></div>
    </>
  );
}
