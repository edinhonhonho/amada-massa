"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registrarEntrega, type ItemFila } from "@/app/(app)/entregas/actions";

export type Parada = {
  id: string; ordem: number; nome: string; telefone: string | null; endereco: string; bairro: string | null;
  instrucoes: string | null; qtd: number; status: string; ocorrencia: string | null;
};

const CHAVE = "fila-entregas-v1";
const OCORRENCIAS = ["Cliente ausente", "Endereço errado", "Atraso", "Pão com problema", "Outro"];

function lerFila(): ItemFila[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); } catch { return []; }
}
function gravarFila(f: ItemFila[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(f)); } catch { /* sem armazenamento: segue só online */ }
}

export default function ListaEntrega({ paradas }: { paradas: Parada[] }) {
  const [status, setStatus] = useState<Record<string, string>>(() => Object.fromEntries(paradas.map((p) => [p.id, p.status])));
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocorrenciaDe, setOcorrenciaDe] = useState<string | null>(null);
  const enviando = useRef(false);

  const sincronizar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    try {
      for (const item of lerFila()) {
        try {
          const r = await registrarEntrega(item);
          if (!r.ok) setAviso(`Uma parada não pôde ser registrada: ${r.erro}`);
        } catch {
          break; // sem rede: mantém na fila e tenta depois
        }
        gravarFila(lerFila().filter((x) => !(x.id === item.id && x.em === item.em)));
      }
    } finally {
      enviando.current = false;
      setPendentes(lerFila().length);
    }
  }, []);

  useEffect(() => {
    // aplica o que ficou pendente de uma sessão offline anterior
    const fila = lerFila();
    if (fila.length) {
      setStatus((s) => ({ ...s, ...Object.fromEntries(fila.map((i) => [i.id, i.status])) }));
      setPendentes(fila.length);
    }
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void sincronizar(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void sincronizar();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sincronizar]);

  function marcar(id: string, novo: ItemFila["status"], ocorrencia?: string) {
    setStatus((s) => ({ ...s, [id]: novo }));
    setOcorrenciaDe(null);
    gravarFila([...lerFila(), { id, status: novo, ocorrencia: ocorrencia ?? null, em: new Date().toISOString() }]);
    setPendentes(lerFila().length);
    void sincronizar();
  }

  const feitas = paradas.filter((p) => status[p.id] === "entregue").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg bg-white/95 p-2 text-sm shadow">
        <b>{feitas}/{paradas.length} entregues</b>
        <span className={online ? "text-green-700" : "text-red-700"}>{online ? "online" : "sem sinal"}</span>
        {pendentes > 0 && <button className="ml-auto underline" onClick={() => void sincronizar()}>{pendentes} a sincronizar</button>}
      </div>
      {aviso && <p className="rounded-lg bg-red-50 p-3 text-red-800" onClick={() => setAviso(null)}>{aviso}</p>}
      {paradas.map((p, i) => {
        const st = status[p.id];
        const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.endereco}, ${p.bairro ?? ""}, Porto Alegre`)}`;
        return (
          <article key={p.id} className={`cartao ${st === "entregue" ? "border-green-300 bg-green-50" : st === "nao_entregue" ? "border-red-300 bg-red-50" : ""}`}>
            <div className="flex items-start gap-2">
              <span className="text-xl font-bold text-stone-500">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">{p.nome} · {p.qtd} 🍞</div>
                <a className="underline" href={mapa} target="_blank" rel="noreferrer">{p.endereco}{p.bairro && ` · ${p.bairro}`}</a>
                {p.instrucoes && <div className="text-sm italic text-stone-700">{p.instrucoes}</div>}
                {p.telefone && <a className="text-sm underline" href={`tel:${p.telefone}`}>{p.telefone}</a>}
              </div>
            </div>
            {st === "entregue" ? (
              <div className="mt-2 flex items-center gap-3"><b className="text-green-800">✔ Entregue</b>
                <button className="underline" onClick={() => marcar(p.id, "programada")}>desfazer</button></div>
            ) : st === "nao_entregue" ? (
              <div className="mt-2 flex items-center gap-3"><b className="text-red-800">✖ Não entregue</b>
                <button className="underline" onClick={() => marcar(p.id, "programada")}>desfazer</button></div>
            ) : ocorrenciaDe === p.id ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {OCORRENCIAS.map((o) => <button key={o} className="btn-sec py-3" onClick={() => marcar(p.id, "nao_entregue", o)}>{o}</button>)}
                <button className="col-span-2 underline" onClick={() => setOcorrenciaDe(null)}>voltar</button>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button className="btn col-span-2 py-4 text-lg" onClick={() => marcar(p.id, "entregue")}>Entregue</button>
                <button className="btn-sec py-4" onClick={() => setOcorrenciaDe(p.id)}>Problema</button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
