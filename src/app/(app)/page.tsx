import { redirect } from "next/navigation";

/** Por enquanto não há tela de início: o essencial começa pelos clientes. */
export default function Inicio() {
  redirect("/clientes");
}
