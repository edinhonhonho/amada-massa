import EntrarMembro from "@/components/EntrarMembro";
import InstalarApp from "@/components/InstalarApp";
import LogoApp from "@/components/LogoApp";

export default function Entrar() {
  return (
    <main className="flex min-h-screen flex-col justify-center gap-6 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <LogoApp tamanho={72} />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Amada Massa</h1>
          <p className="mt-1 text-stone-600">Seus avisos do Clube do Pão: rota, entregador e o pão da semana.</p>
        </div>
      </header>
      <EntrarMembro />
      <InstalarApp nome="Amada Massa" />
    </main>
  );
}
