import { CircleAlert, CircleCheck } from "lucide-react";

/** Faixa de resultado depois de enviar um aviso (vem da URL: ?aviso=ok&n=..&push=..). */
export default function AvisoEnviado({ aviso, n, push }: { aviso?: string; n?: string; push?: string }) {
  if (!aviso) return null;
  const ok = aviso === "ok";
  return (
    <div role="status" className={`entra mb-5 flex items-start gap-3 rounded-2xl p-4 shadow-sm ${ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
      {ok ? <CircleCheck size={20} className="mt-0.5 shrink-0" /> : <CircleAlert size={20} className="mt-0.5 shrink-0" />}
      <div className="text-sm">
        {ok ? (
          <>
            <b>Aviso enviado para {n} {n === "1" ? "pessoa" : "pessoas"}.</b>{" "}
            {Number(push) > 0 ? `${push} já receberam como notificação no celular; o restante verá ao abrir o app.` : "Ninguém desse grupo ativou as notificações ainda; todos verão o aviso ao abrir o app."}
          </>
        ) : aviso === "vazio" ? (
          <b>Ninguém neste grupo para receber o aviso.</b>
        ) : (
          <b>Não foi possível enviar. Confira o título, a mensagem e o grupo.</b>
        )}
      </div>
    </div>
  );
}
