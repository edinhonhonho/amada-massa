"use client";

import { Check, Loader2, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import SubmitButton from "@/components/ui/SubmitButton";
import { consultarCep, mascaraCep } from "@/lib/cep";
import { DIAS, ORDEM_DIAS, type Janela } from "@/lib/horarios";
import { salvarPonto } from "./actions";

export type Ponto = {
  id: string; nome: string; tipo: "padaria" | "ponto"; logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string; cep: string | null; referencia: string | null; endereco: string; horarios: Janela[];
  horario_texto: string | null; responsavel: string | null; telefone: string | null; ativo: boolean;
};

type Dia = { ativo: boolean; janelas: { abre: string; fecha: string }[] };

function inicialDias(h: Janela[] = []): Record<number, Dia> {
  const r: Record<number, Dia> = {};
  for (const d of ORDEM_DIAS) {
    const js = h.filter((j) => j.dia === d).sort((a, b) => a.abre.localeCompare(b.abre));
    r[d] = { ativo: js.length > 0, janelas: js.length ? js.map((j) => ({ abre: j.abre, fecha: j.fecha })) : [{ abre: "09:00", fecha: "18:00" }] };
  }
  return r;
}

export default function PontoForm({ p, temPadaria }: { p?: Ponto; temPadaria: boolean }) {
  const [cep, setCep] = useState(mascaraCep(p?.cep ?? ""));
  const [cepEstado, setCepEstado] = useState<"ocioso" | "buscando" | "ok" | "erro">("ocioso");
  const [logradouro, setLogradouro] = useState(p?.logradouro ?? "");
  const [bairro, setBairro] = useState(p?.bairro ?? "");
  const [cidade, setCidade] = useState(p?.cidade ?? "Porto Alegre");
  const [dias, setDias] = useState(() => inicialDias(p?.horarios));
  const numeroRef = useRef<HTMLInputElement>(null);

  async function aoDigitarCep(v: string) {
    const m = mascaraCep(v);
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

  const mudar = (d: number, fn: (x: Dia) => Dia) => setDias((s) => ({ ...s, [d]: fn(s[d]) }));
  const horarios: Janela[] = ORDEM_DIAS.flatMap((d) => (dias[d].ativo ? dias[d].janelas.map((j) => ({ dia: d, ...j })) : []));

  return (
    <form action={salvarPonto} className="flex flex-col gap-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="horarios" value={JSON.stringify(horarios)} />

      <section className="grid grid-cols-2 gap-4">
        <div className="col-span-2 text-sm font-semibold text-stone-900">Identificação</div>
        <div><label className="rotulo">Nome <span className="text-red-500">*</span></label><input className="campo" name="nome" defaultValue={p?.nome} required placeholder="Ex.: Escola de Yoga Umåna" /></div>
        <div>
          <label className="rotulo">Tipo</label>
          <select className="campo" name="tipo" defaultValue={p?.tipo ?? (temPadaria ? "ponto" : "padaria")}>
            <option value="ponto">Ponto de retirada</option>
            <option value="padaria">Padaria (retirada na produção)</option>
          </select>
        </div>
        <div><label className="rotulo">Responsável</label><input className="campo" name="responsavel" defaultValue={p?.responsavel ?? ""} /></div>
        <div><label className="rotulo">Telefone</label><input className="campo" name="telefone" type="tel" defaultValue={p?.telefone ?? ""} /></div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="col-span-2 text-sm font-semibold text-stone-900">Endereço <span className="font-normal text-stone-500">· comece pelo CEP</span></div>
        <div>
          <label className="rotulo">CEP</label>
          <div className="relative">
            <input className="campo !pr-10" name="cep" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(e) => void aoDigitarCep(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {cepEstado === "buscando" && <Loader2 size={16} className="animate-spin text-stone-400" />}
              {cepEstado === "ok" && <Check size={16} className="text-emerald-600" />}
            </span>
          </div>
          {cepEstado === "erro" && <p className="mt-1 text-xs text-amber-800">CEP não encontrado. Preencha manualmente.</p>}
        </div>
        <div><label className="rotulo">Número</label><input ref={numeroRef} className="campo" name="numero" defaultValue={p?.numero ?? ""} /></div>
        <div className="col-span-2"><label className="rotulo">Rua <span className="text-red-500">*</span></label><input className="campo" name="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} required /></div>
        <div><label className="rotulo">Complemento</label><input className="campo" name="complemento" defaultValue={p?.complemento ?? ""} placeholder="Loja, sala…" /></div>
        <div><label className="rotulo">Bairro</label><input className="campo" name="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
        <div><label className="rotulo">Cidade</label><input className="campo" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
        <div><label className="rotulo">Ponto de referência</label><input className="campo" name="referencia" defaultValue={p?.referencia ?? ""} placeholder="Ex.: ao lado da padaria" /></div>
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold text-stone-900">Horário de funcionamento <span className="font-normal text-stone-500">· por dia da semana</span></div>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {ORDEM_DIAS.map((d) => {
            const x = dias[d];
            return (
              <li key={d} className="flex items-start gap-3 px-4 py-2.5">
                <label className="flex w-36 shrink-0 cursor-pointer items-center gap-2 pt-2 text-sm font-medium">
                  <input type="checkbox" className="size-4 accent-amber-700" checked={x.ativo} onChange={(e) => mudar(d, (v) => ({ ...v, ativo: e.target.checked }))} />
                  {DIAS[d]}
                </label>
                {x.ativo ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {x.janelas.map((j, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="time" className="campo !w-32 !py-1.5" value={j.abre} onChange={(e) => mudar(d, (v) => ({ ...v, janelas: v.janelas.map((y, k) => (k === i ? { ...y, abre: e.target.value } : y)) }))} aria-label={`${DIAS[d]} abre`} />
                        <span className="text-stone-400">às</span>
                        <input type="time" className="campo !w-32 !py-1.5" value={j.fecha} onChange={(e) => mudar(d, (v) => ({ ...v, janelas: v.janelas.map((y, k) => (k === i ? { ...y, fecha: e.target.value } : y)) }))} aria-label={`${DIAS[d]} fecha`} />
                        {j.abre >= j.fecha && <span className="text-xs text-red-600">fim antes do início</span>}
                        {x.janelas.length > 1 && (
                          <button type="button" className="btn-ghost !p-1.5" aria-label="Remover horário" onClick={() => mudar(d, (v) => ({ ...v, janelas: v.janelas.filter((_, k) => k !== i) }))}><X size={15} /></button>
                        )}
                      </div>
                    ))}
                    {x.janelas.length < 3 && (
                      <button type="button" className="btn-ghost !justify-start !px-1 text-xs" onClick={() => mudar(d, (v) => ({ ...v, janelas: [...v.janelas, { abre: "16:00", fecha: "18:00" }] }))}><Plus size={13} />Outro horário no dia</button>
                    )}
                  </div>
                ) : <span className="pt-2 text-sm text-stone-400">Fechado</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {p && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} className="size-4 accent-amber-700" />Ponto ativo (aparece no cadastro de clientes)</label>}
      <div className="flex justify-end"><SubmitButton>{p ? "Salvar ponto" : "Adicionar ponto"}</SubmitButton></div>
    </form>
  );
}
