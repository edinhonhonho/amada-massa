import {
  BarChart3, CalendarCheck, CalendarDays, MapPin, MessageCircle, Route, Settings, Tag, Truck, Users, Wallet,
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
  { titulo: "Financeiro", itens: [{ href: "/pagamentos", rotulo: "Pagamentos", icone: Wallet, atalho: "p", dica: "Mensalidades e baixas" }] },
  { titulo: "Comunicação", itens: [{ href: "/mensagens", rotulo: "Mensagens", icone: MessageCircle, atalho: "m" }] },
  {
    // A ordem é a do trabalho: onde retirar, o que se vende e, por fim, quem assina.
    titulo: "Cadastros",
    itens: [
      { href: "/pontos-coleta", rotulo: "Pontos de coleta", icone: MapPin, atalho: "o", dica: "Onde retirar o pão" },
      { href: "/planos", rotulo: "Planos", icone: Tag, atalho: "l", dica: "O que o clube vende" },
      { href: "/clientes", rotulo: "Clientes", icone: Users, atalho: "c", dica: "Quem assina, com plano e endereço" },
      { href: "/rotas", rotulo: "Rotas", icone: Route, atalho: "r", dica: "Trajeto e entregador de cada rota" },
    ],
  },
  {
    titulo: "Rotina da semana",
    itens: [
      { href: "/semana", rotulo: "Esta semana", icone: CalendarCheck, atalho: "s", dica: "Pães, produção, distribuição e entregas, em quatro etapas" },
      { href: "/planejamento", rotulo: "Calendário", icone: CalendarDays, atalho: "n", dica: "Todas as semanas do ano" },
      { href: "/entregas/historico", rotulo: "Histórico de entregas", icone: Truck, atalho: "e", dica: "Entregas de semanas passadas" },
    ],
  },
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
