import { redirect } from "next/navigation";

/** Não há tela de início: o trabalho da semana é a porta de entrada. */
export default function Inicio() {
  redirect("/semana");
}
