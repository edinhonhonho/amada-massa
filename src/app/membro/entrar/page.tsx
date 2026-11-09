import EntrarMembro from "@/components/EntrarMembro";
import InstalarApp from "@/components/InstalarApp";
import LogoApp from "@/components/LogoApp";

export default function Entrar() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col justify-center gap-9 py-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <LogoApp tamanho={68} />
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Amada Massa</h1>
          <p className="mx-auto mt-2 max-w-[19rem] text-[17px] leading-snug text-stone-500">Seus avisos do Clube do Pão, direto no celular.</p>
        </div>
      </header>
      <EntrarMembro />
      <InstalarApp nome="Amada Massa" />
    </main>
  );
}
