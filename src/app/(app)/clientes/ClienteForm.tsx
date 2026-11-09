"use client";

import { AlertTriangle, CalendarClock, Check, Loader2, MapPin, Package, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import SeletorPlano, { type PlanoOpcao, type PontoOpcao } from "@/components/SeletorPlano";
import SubmitButton from "@/components/ui/SubmitButton";
import { consultarCep, mascaraCep } from "@/lib/cep";
import { MODALIDADES, ORIGENS, paraCentavos, reais } from "@/lib/format";
import { salvarCliente, type EstadoForm } from "./actions";

type Cliente = Record<string, string | null> & { id: string };

const Campo = ({ nome, rotulo, def, tipo = "text", req = false, area = false, ajuda, className = "" }: {
  nome: string; rotulo: string; def?: string | null; tipo?: string; req?: boolean; area?: boolean; ajuda?: string; className?: string;
}) => (
  <div className={className}>
    <label className="rotulo" htmlFor={nome}>{rotulo}{req && <span className="text-red-500"> *</span>}</label>
    {area
      ? <textarea className="campo" id={nome} name={nome} defaultValue={def ?? ""} rows={2} />
      : <input className="campo" id={nome} name={nome} type={tipo} defaultValue={def ?? ""} required={req} />}
    {ajuda && <p className="ajuda">{ajuda}</p>}
  </div>
);

function Secao({ n, titulo, texto, children }: { n?: number; titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <section className="cartao !p-0">
      <header className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
        {n && <span className="flex size-7 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">{n}</span>}
        <div><h2 className="font-semibold leading-tight">{titulo}</h2>{texto && <p className="text-sm text-stone-500">{texto}</p>}</div>
      </header>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-6">{children}</div>
    </section>
  );
}

export default function ClienteForm({ cliente, planos, pontos }: { cliente?: Cliente; planos?: PlanoOpcao[]; pontos?: PontoOpcao[] }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarCliente, {});
  const c = cliente;

  // Endereço: o CEP vem primeiro e preenche rua, bairro e cidade.
  const [cep, setCep] = useState(mascaraCep(c?.cep ?? ""));
  const [cepEstado, setCepEstado] = useState<"ocioso" | "buscando" | "ok" | "erro">("ocioso");
  const [logradouro, setLogradouro] = useState(c?.logradouro ?? "");
  const [bairro, setBairro] = useState(c?.bairro ?? "");
  const [cidade, setCidade] = useState(c?.cidade ?? "Porto Alegre");
  const numeroRef = useRef<HTMLInputElement>(null);

  async function aoDigitarCep(valor: string) {
    const m = mascaraCep(valor);
    setCep(m);
    if (m.replace(/\D/g, "").length !== 8) { setCepEstado("ocioso"); return; }
    setCepEstado("buscando");
    const r = await consultarCep(m);
    if (!r) { setCepEstado("erro"); return; }
    if (r.logradouro) setLogradouro(r.logradouro);
    if (r.bairro) setBairro(r.bairro);
    if (r.cidade) setCidade(r.cidade);
    setCepEstado("ok");
    numeroRef.current?.focus();
  }

  // Assinatura (só no cadastro)
  const [selecao, setSelecao] = useState<{ plano: PlanoOpcao | null; ponto: PontoOpcao | null }>({ plano: null, ponto: null });
  const [dia, setDia] = useState("10");
  const [valor, setValor] = useState("");
  const [nome, setNome] = useState(c?.nome ?? "");
  const plano = selecao.plano;
  const personalizado = valor.trim() ? paraCentavos(valor) : null;
  const final = personalizado ?? plano?.valor_centavos ?? 0;
  const IconeMod = plano ? { entrega: Truck, coleta_ponto: MapPin, coleta_padaria: Store }[plano.modalidade] : Package;

  return (
    <form action={acao} className={c ? "max-w-3xl" : "grid grid-cols-[1fr_320px] items-start gap-6"}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="flex flex-col gap-5">
        {estado.erro && (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{estado.erro}</p>
              {estado.duplicados && (
                <>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {estado.duplicados.map((d) => <li key={d.id}><Link className="underline" href={`/clientes/${d.id}`} target="_blank">{d.nome}</Link></li>)}
                  </ul>
                  <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" name="confirmar" value="1" /> É outra pessoa, salvar mesmo assim</label>
                </>
              )}
            </div>
          </div>
        )}

        <Secao n={c ? undefined : 1} titulo="Quem é" texto="Dados de contato. O e-mail é também o acesso do cliente ao app de avisos.">
          <div><label className="rotulo" htmlFor="nome">Nome <span className="text-red-500">*</span></label>
            <input className="campo" id="nome" name="nome" required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <Campo nome="sobrenome" rotulo="Sobrenome" def={c?.sobrenome} />
          <Campo nome="whatsapp" rotulo="WhatsApp (com DDD)" def={c?.whatsapp} tipo="tel" />
          <Campo nome="email" rotulo="E-mail" def={c?.email} tipo="email" />
          <Campo nome="cpf" rotulo="CPF (opcional)" def={c?.cpf} />
          <div>
            <label className="rotulo" htmlFor="origem">Como conheceu</label>
            <select className="campo" id="origem" name="origem" defaultValue={c?.origem ?? ""}>
              <option value="">—</option>{ORIGENS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <Campo nome="confirmado_em" rotulo="Assinatura confirmada em" def={c?.confirmado_em} tipo="date" />
          <Campo nome="restricoes_alimentares" rotulo="Restrições alimentares" def={c?.restricoes_alimentares} />
          <Campo nome="observacoes" rotulo="Observações" def={c?.observacoes} area className="col-span-2" />
        </Secao>

        <Secao n={c ? undefined : 2} titulo="Onde recebe" texto="Comece pelo CEP: rua, bairro e cidade são preenchidos sozinhos.">
          <div>
            <label className="rotulo" htmlFor="cep">CEP</label>
            <div className="relative">
              <input className="campo !pr-10" id="cep" name="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => void aoDigitarCep(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {cepEstado === "buscando" && <Loader2 size={16} className="animate-spin text-stone-400" />}
                {cepEstado === "ok" && <Check size={16} className="text-emerald-600" />}
              </span>
            </div>
            {cepEstado === "erro" && <p className="mt-1 text-xs text-amber-800">CEP não encontrado. Preencha o endereço manualmente.</p>}
          </div>
          <div><label className="rotulo" htmlFor="numero">Número</label><input ref={numeroRef} className="campo" id="numero" name="numero" defaultValue={c?.numero ?? ""} /></div>
          <div className="col-span-2"><label className="rotulo" htmlFor="logradouro">Rua</label><input className="campo" id="logradouro" name="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} /></div>
          <Campo nome="complemento" rotulo="Complemento" def={c?.complemento} />
          <div><label className="rotulo" htmlFor="bairro">Bairro</label><input className="campo" id="bairro" name="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
          <div><label className="rotulo" htmlFor="cidade">Cidade</label><input className="campo" id="cidade" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
          <Campo nome="referencia_portaria" rotulo="Portaria / referência" def={c?.referencia_portaria} />
          <Campo nome="instrucoes_entrega" rotulo="Instruções de entrega" def={c?.instrucoes_entrega} ajuda='Ex.: "deixar com o porteiro"' className="col-span-2" />
        </Secao>

        {!c && planos && (
          <Secao n={3} titulo="O que assina" texto="Escolha o plano do catálogo. Isso cria a assinatura e as cobranças mensais.">
            <div className="col-span-2"><SeletorPlano planos={planos} pontos={pontos ?? []} onSelecao={setSelecao} /></div>
            <div>
              <label className="rotulo" htmlFor="dia_vencimento">Dia do pagamento (1 a 28) <span className="text-red-500">*</span></label>
              <input className="campo" id="dia_vencimento" name="dia_vencimento" type="number" min={1} max={28} required value={dia} onChange={(e) => setDia(e.target.value)} />
            </div>
            <Campo nome="inicio" rotulo="Início da assinatura" tipo="date" />
            <div>
              <label className="rotulo" htmlFor="valor">Valor combinado (se diferente)</label>
              <input className="campo" id="valor" name="valor" placeholder={plano ? reais(plano.valor_centavos) : ""} value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <Campo nome="justificativa_valor" rotulo="Motivo do valor diferente" ajuda="Obrigatório se o valor for outro (ex.: valor solidário)." />
          </Secao>
        )}

        <div className="flex gap-3">
          <SubmitButton className="btn !px-6"><Check size={16} />{c ? "Salvar alterações" : "Cadastrar cliente"}</SubmitButton>
          <Link className="btn-sec" href={c ? `/clientes/${c.id}` : "/clientes"}>Cancelar</Link>
        </div>
      </div>

      {!c && plano && (
        <aside className="cartao sticky top-6 flex flex-col gap-4 bg-gradient-to-b from-amber-50/70 to-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">Resumo da assinatura</div>
          <div>
            <div className="text-lg font-semibold leading-tight">{nome.trim() || "Novo cliente"}</div>
            <div className="text-sm text-stone-500">vai assinar</div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><IconeMod size={18} /></span>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-snug">{MODALIDADES[plano.modalidade]}</div>
              <div className="text-xs text-stone-500">{plano.paes_por_semana} pão{plano.paes_por_semana > 1 ? "es" : ""} por semana</div>
            </div>
          </div>
          <div>
            <div className="text-3xl font-semibold tracking-tight">{reais(final)}<span className="text-sm font-normal text-stone-500">/mês</span></div>
            {personalizado !== null && personalizado !== plano.valor_centavos && <div className="text-xs text-amber-800">Valor do catálogo: {reais(plano.valor_centavos)}</div>}
          </div>
          <ul className="space-y-2 text-sm text-stone-600">
            <li className="flex items-start gap-2"><CalendarClock size={16} className="mt-0.5 shrink-0 text-stone-400" /><span>Cobrança todo dia <b className="text-stone-900">{dia || "—"}</b>, gerada automaticamente</span></li>
            {plano.modalidade === "entrega"
              ? <li className="flex items-start gap-2"><Truck size={16} className="mt-0.5 shrink-0 text-stone-400" /><span>Depois de cadastrar, atribua uma <b className="text-stone-900">rota</b></span></li>
              : <li className="flex items-start gap-2"><Store size={16} className="mt-0.5 shrink-0 text-stone-400" /><span>Retira em <b className="text-stone-900">{selecao.ponto?.nome ?? "—"}</b></span></li>}
          </ul>
        </aside>
      )}
    </form>
  );
}
