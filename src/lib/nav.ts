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
    // A ordem é a do trabalho: onde retirar, o que se vende e, por fim, quem assina.
    titulo: "Cadastros",
    itens: [
      { href: "/pontos-coleta", rotulo: "Pontos de coleta", icone: MapPin, atalho: "o", dica: "Onde retirar o pão" },
      { href: "/planos", rotulo: "Planos", icone: Tag, atalho: "l", dica: "O que o clube vende" },
      { href: "/clientes", rotulo: "Clientes", icone: Users, atalho: "c", dica: "Quem assina, com plano e endereço" },
    ],
  },
  { titulo: "Financeiro", itens: [{ href: "/pagamentos", rotulo: "Pagamentos", icone: Wallet, atalho: "p", dica: "Mensalidades e baixas" }] },
  {
    titulo: "Rotina da semana",
    fluxo: true,
    itens: [
      { href: "/planejamento", rotulo: "Planejamento", icone: CalendarDays, atalho: "s", passo: 1, dica: "Pães, produção e destinos de cada semana" },
      { href: "/rotas", rotulo: "Rotas", icone: Route, atalho: "r", passo: 2, dica: "Trajeto de cada entregador" },
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
