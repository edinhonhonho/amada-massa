import {
  BarChart3, CalendarCheck, CalendarDays, MapPin, MessageCircle, Route, Settings, Tag, Truck, Users, Wallet, Wheat,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** Atalho de duas teclas: 1ª letra do grupo + 1ª letra da página (ex.: Comunicação > Mensagens = "cm"). */
  atalho: string;
  /** Passo numerado da rotina semanal. */
  passo?: number;
  dica?: string;
  /** Só o administrador vê. */
  admin?: boolean;
};
export type GrupoNav = { titulo?: string; fluxo?: boolean; itens: ItemNav[] };

/** Itens que o perfil pode ver, sem grupos vazios. */
export const gruposVisiveis = (admin: boolean): GrupoNav[] =>
  GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.admin || admin) })).filter((g) => g.itens.length > 0);

export const GRUPOS: GrupoNav[] = [
  { titulo: "Comunicação", itens: [{ href: "/mensagens", rotulo: "Mensagens", icone: MessageCircle, atalho: "cm" }] },
  { titulo: "Financeiro", itens: [{ href: "/pagamentos", rotulo: "Pagamentos", icone: Wallet, atalho: "fp", dica: "Mensalidades e baixas" }] },
  {
    // A ordem é a do trabalho: onde retirar, o que se vende e, por fim, quem assina.
    titulo: "Cadastros",
    itens: [
      { href: "/pontos-coleta", rotulo: "Pontos de coleta", icone: MapPin, atalho: "co", dica: "Onde retirar o pão" },
      { href: "/planos", rotulo: "Planos", icone: Tag, atalho: "cp", dica: "O que o clube vende" },
      { href: "/paes", rotulo: "Pães", icone: Wheat, atalho: "ca", dica: "Catálogo de pães para escolher em cada semana" },
      { href: "/clientes", rotulo: "Clientes", icone: Users, atalho: "cc", dica: "Quem assina, com plano e endereço" },
      { href: "/rotas", rotulo: "Rotas", icone: Route, atalho: "cr", dica: "Trajeto e entregador de cada rota" },
    ],
  },
  {
    titulo: "Rotina da semana",
    itens: [
      { href: "/semana", rotulo: "Esta semana", icone: CalendarCheck, atalho: "re", dica: "Planejar, clientes, pontos e rotas, consolidar e acompanhar" },
      { href: "/planejamento", rotulo: "Calendário", icone: CalendarDays, atalho: "rc", dica: "Todas as semanas do ano" },
      { href: "/entregas/historico", rotulo: "Histórico de entregas", icone: Truck, atalho: "rh", dica: "Entregas de semanas passadas" },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3, atalho: "ar", admin: true },
      { href: "/configuracoes", rotulo: "Configurações", icone: Settings, atalho: "ac", dica: "Atalhos de teclado e regras do sistema" },
    ],
  },
];

export const TODOS_ITENS = GRUPOS.flatMap((g) => g.itens);
