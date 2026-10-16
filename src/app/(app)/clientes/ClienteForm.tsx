"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { salvarCliente, type EstadoForm } from "./actions";
import { MODALIDADES, ORIGENS, reais } from "@/lib/format";

type Plano = { id: string; nome: string; modalidade: keyof typeof MODALIDADES; valor_centavos: number };
type Ponto = { id: string; nome: string };
type Cliente = Record<string, string | null> & { id: string };

const Campo = ({ nome, rotulo, def, tipo = "text", req = false, area = false }: {
  nome: string; rotulo: string; def?: string | null; tipo?: string; req?: boolean; area?: boolean;
}) => (
  <div>
    <label className="rotulo" htmlFor={nome}>{rotulo}{req && " *"}</label>
    {area
      ? <textarea className="campo" id={nome} name={nome} defaultValue={def ?? ""} rows={2} />
      : <input className="campo" id={nome} name={nome} type={tipo} defaultValue={def ?? ""} required={req} />}
  </div>
);

export default function ClienteForm({ cliente, planos, pontos }: { cliente?: Cliente; planos?: Plano[]; pontos?: Ponto[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(salvarCliente, {});
  const [planoId, setPlanoId] = useState(planos?.[0]?.id ?? "");
  const plano = planos?.find((p) => p.id === planoId);
  const c = cliente;

  return (
    <form action={acao} className="flex flex-col gap-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      {estado.erro && (
        <div className="rounded-lg bg-red-50 p-3 text-red-800" role="alert">
          <p>{estado.erro}</p>
          {estado.duplicados && (
            <>
              <ul className="mt-1 list-disc pl-5">
                {estado.duplicados.map((d) => (
                  <li key={d.id}><Link className="underline" href={`/clientes/${d.id}`} target="_blank">{d.nome}</Link></li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" name="confirmar" value="1" /> É outra pessoa, salvar mesmo assim
              </label>
            </>
          )}
        </div>
      )}

      <fieldset className="cartao grid gap-4 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Dados pessoais</legend>
        <Campo nome="nome" rotulo="Nome" def={c?.nome} req />
        <Campo nome="sobrenome" rotulo="Sobrenome" def={c?.sobrenome} />
        <Campo nome="whatsapp" rotulo="WhatsApp (com DDD)" def={c?.whatsapp} tipo="tel" />
        <Campo nome="email" rotulo="E-mail" def={c?.email} tipo="email" />
        <Campo nome="cpf" rotulo="CPF (opcional)" def={c?.cpf} />
        <div>
          <label className="rotulo" htmlFor="origem">Origem do contato</label>
          <select className="campo" id="origem" name="origem" defaultValue={c?.origem ?? ""}>
            <option value="">—</option>
            {ORIGENS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <Campo nome="confirmado_em" rotulo="Assinatura confirmada em" def={c?.confirmado_em} tipo="date" />
        <Campo nome="restricoes_alimentares" rotulo="Restrições/preferências alimentares" def={c?.restricoes_alimentares} />
        <div className="sm:col-span-2"><Campo nome="observacoes" rotulo="Observações" def={c?.observacoes} area /></div>
      </fieldset>

      <fieldset className="cartao grid gap-4 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Endereço</legend>
        <Campo nome="logradouro" rotulo="Logradouro" def={c?.logradouro} />
        <Campo nome="numero" rotulo="Número" def={c?.numero} />
        <Campo nome="complemento" rotulo="Complemento" def={c?.complemento} />
        <Campo nome="bairro" rotulo="Bairro" def={c?.bairro} />
        <Campo nome="cidade" rotulo="Cidade" def={c?.cidade ?? "Porto Alegre"} />
        <Campo nome="cep" rotulo="CEP" def={c?.cep} />
        <Campo nome="referencia_portaria" rotulo="Referência de portaria" def={c?.referencia_portaria} />
        <Campo nome="instrucoes_entrega" rotulo="Instruções de entrega" def={c?.instrucoes_entrega} />
      </fieldset>

      {!c && planos && (
        <fieldset className="cartao grid gap-4 sm:grid-cols-2">
          <legend className="px-1 font-semibold">Plano e pagamento</legend>
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="plano_id">Plano contratado *</label>
            <select className="campo" id="plano_id" name="plano_id" value={planoId} onChange={(e) => setPlanoId(e.target.value)} required>
              {planos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {reais(p.valor_centavos)}/mês</option>)}
            </select>
          </div>
          {plano && plano.modalidade !== "entrega" && (
            <div>
              <label className="rotulo" htmlFor="ponto_coleta_id">Ponto de coleta *</label>
              <select className="campo" id="ponto_coleta_id" name="ponto_coleta_id" required>
                {pontos?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
          <Campo nome="dia_vencimento" rotulo="Dia de pagamento (1 a 28) *" tipo="number" def="10" req />
          <Campo nome="inicio" rotulo="Início da assinatura" tipo="date" />
          <Campo nome="valor" rotulo={`Valor personalizado (padrão ${plano ? reais(plano.valor_centavos) : ""})`} />
          <Campo nome="justificativa_valor" rotulo="Justificativa (se valor diferente)" />
        </fieldset>
      )}

      <div className="flex gap-3">
        <button className="btn" disabled={pendente}>{pendente ? "Salvando…" : "Salvar"}</button>
        <Link className="btn-sec" href={c ? `/clientes/${c.id}` : "/clientes"}>Cancelar</Link>
      </div>
    </form>
  );
}
