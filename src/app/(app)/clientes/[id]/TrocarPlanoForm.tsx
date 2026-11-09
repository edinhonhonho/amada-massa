"use client";

import { useState } from "react";
import SeletorPlano, { type PlanoOpcao, type PontoOpcao } from "@/components/SeletorPlano";
import SubmitButton from "@/components/ui/SubmitButton";
import { reais } from "@/lib/format";
import { trocarPlano } from "../actions";

export default function TrocarPlanoForm({
  clienteId, assinaturaId, planoAtualId, pontoAtualId, planos, pontos, hoje,
}: { clienteId: string; assinaturaId: string; planoAtualId?: string; pontoAtualId?: string | null; planos: PlanoOpcao[]; pontos: PontoOpcao[]; hoje: string }) {
  const [plano, setPlano] = useState<PlanoOpcao | null>(null);
  return (
    <form action={trocarPlano} className="flex flex-col gap-5">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="assinatura_id" value={assinaturaId} />
      <SeletorPlano planos={planos} pontos={pontos} inicial={{ planoId: planoAtualId, pontoId: pontoAtualId }} onSelecao={(s) => setPlano(s.plano)} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="rotulo">Vale a partir de</label><input className="campo" type="date" name="inicio" defaultValue={hoje} /></div>
        <div><label className="rotulo">Valor combinado</label><input className="campo" name="valor" placeholder={plano ? `Padrão: ${reais(plano.valor_centavos)}` : "Padrão do plano"} /></div>
      </div>
      {plano && plano.paes_por_semana > 0 && (
        <div><label className="rotulo">Quantos pães tradicionais? (de {plano.paes_por_semana})</label><input className="campo !w-32" type="number" name="paes_tradicionais" min={0} max={plano.paes_por_semana} defaultValue={0} /></div>
      )}
      <div><label className="rotulo">Motivo do valor diferente</label><input className="campo" name="justificativa_valor" placeholder="Só se o valor não for o do catálogo" /></div>
      <div className="flex justify-end"><SubmitButton>Trocar plano</SubmitButton></div>
    </form>
  );
}
