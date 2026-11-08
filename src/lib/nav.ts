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
    titulo: "Clientes",
    itens: [
      { href: "/clientes", rotulo: "Clientes", icone: Users, atalho: "c", dica: "Cada cliente tem uma assinatura" },
      { href: "/planos", rotulo: "Planos e preços", icone: Tag, atalho: "l", dica: "O catálogo que as assinaturas usam" },
    ],
  },
  {
    titulo: "Rotina da semana",
    fluxo: true,
    itens: [
      { href: "/pagamentos", rotulo: "Pagamentos", icone: Wallet, atalho: "p", passo: 1, dica: "Receber as mensalidades" },
      { href: "/semanas", rotulo: "Semanas", icone: CalendarDays, atalho: "s", passo: 2, dica: "Sabor, produção e listas" },
      { href: "/rotas", rotulo: "Rotas", icone: Route, atalho: "r", passo: 3, dica: "Quem entrega onde" },
      { href: "/entregas/historico", rotulo: "Entregas", icone: Truck, atalho: "e", passo: 4, dica: "Acompanhar e resolver pendências" },
    ],
  },
  { titulo: "Comunicação", itens: [{ href: "/mensagens", rotulo: "Mensagens", icone: MessageCircle, atalho: "m" }] },
  { titulo: "Cadastros", itens: [{ href: "/pontos-coleta", rotulo: "Pontos de coleta", icone: MapPin, atalho: "o" }] },
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
