import { CalendarPlus } from "lucide-react";
import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import { exigirEquipe } from "@/lib/auth";
import { hojeISO } from "@/lib/format";
import { adicionarDias } from "@/lib/pagamentos";
import { numeroSemanaISO, segundaDe } from "@/lib/semana";
import { planejarSemana } from "../planejamento/actions";

/** Porta de entrada da rotina: leva direto à semana de hoje, ou oferece criá-la. */
export default async function EstaSemana() {
  const { supabase } = await exigirEquipe();
  const atual = segundaDe(hojeISO());
  const { data } = await supabase.from("semanas").select("id").eq("inicio", atual).maybeSingle();
  if (data) redirect(`/planejamento/${data.id}`);
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <>
      <PageHeader titulo="Esta semana" subtitulo={`Semana ${numeroSemanaISO(atual)} · ${dm(atual)} a ${dm(adicionarDias(atual, 6))}`} />
      <form action={planejarSemana} className="cartao flex flex-col items-start gap-3">
        <input type="hidden" name="inicio" value={atual} />
        <p className="max-w-xl text-stone-600">A semana ainda não foi planejada. Ao criá-la, os clientes com assinatura ativa entram sozinhos e você segue em quatro etapas: pães, produção, distribuição e entregas.</p>
        <SubmitButton className="btn"><CalendarPlus size={16} />Planejar esta semana</SubmitButton>
      </form>
    </>
  );
}
