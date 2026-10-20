import EntrarMembro from "@/components/EntrarMembro";
import InstalarApp from "@/components/InstalarApp";

export default function Entrar() {
  return (
    <main className="flex min-h-screen flex-col justify-center gap-5 py-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-amber-800">Amada Massa</h1>
        <p className="text-stone-600">Clube do Pão · avisos da sua entrega</p>
      </header>
      <InstalarApp nome="Amada Massa" />
      <EntrarMembro />
    </main>
  );
}
