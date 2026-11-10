import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500"><SearchX size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">Não encontramos esta página</h1>
      <p className="text-sm text-stone-600">O endereço pode estar errado, ou o cadastro foi excluído.</p>
      <Link href="/semana" className="btn">Ir para Esta semana</Link>
    </div>
  );
}
