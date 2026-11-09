import {
  BarChart3, CalendarDays, LayoutDashboard, MapPin, MessageCircle, Route, Settings, Tag, Truck, Users, Wallet,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** Segunda tecla do atalho "g + tecla". */
  atalho: string;
  /** Passo numerado da rotina semanal. */
  passo?: number;
  dica?: string;
};
export type GrupoNav = { titulo?: string; admin?: boolean; fluxo?: boolean; itens: ItemNav[] };

export const GRUPOS: GrupoNav[] = [
  { itens: [{ href: "/", rotulo: "Início", icone: LayoutDashboard, atalho: "i" }] },
  {
    // A ordem é a do trabalho: o catálogo existe antes dos clientes que assinam.
    titulo: "Cadastros",
    itens: [
      { href: "/planos", rotulo: "Planos e preços", icone: Tag, atalho: "l", dica: "O catálogo que as assinaturas usam" },
      { href: "/pontos-coleta", rotulo: "Pontos de coleta", icone: MapPin, atalho: "o", dica: "Onde retirar o pão" },
    ],
  },
  {
    titulo: "Clientes",
    itens: [
      { href: "/clientes", rotulo: "Clientes", icone: Users, atalho: "c", dica: "Cada cliente tem uma assinatura" },
      { href: "/pagamentos", rotulo: "Pagamentos", icone: Wallet, atalho: "p", dica: "Mensalidades e baixas" },
    ],
  },
  {
    titulo: "Rotina da semana",
    fluxo: true,
    itens: [
      { href: "/semanas", rotulo: "Semanas", icone: CalendarDays, atalho: "s", passo: 1, dica: "Pães, produção e listas" },
      { href: "/rotas", rotulo: "Rotas", icone: Route, atalho: "r", passo: 2, dica: "Quem entrega onde" },
      { href: "/entregas/historico", rotulo: "Entregas", icone: Truck, atalho: "e", passo: 3, dica: "Acompanhar e resolver pendências" },
    ],
  },
  { titulo: "Comunicação", itens: [{ href: "/mensagens", rotulo: "Mensagens", icone: MessageCircle, atalho: "m" }] },
  {
    titulo: "Administração",
    admin: true,
    itens: [
      { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3, atalho: "a" },
      { href: "/configuracoes", rotulo: "Configurações", icone: Settings, atalho: "x" },
    ],
  },
];

export const TODOS_ITENS = GRUPOS.flatMap((g) => g.itens);
