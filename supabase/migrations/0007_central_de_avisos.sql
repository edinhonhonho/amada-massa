-- Amada Massa — central de avisos: o app "Amada Massa" é o único canal de mensagens.
-- Rode DEPOIS da 0006.

-- Cada envio da equipe (para todos, atrasados, uma rota…) vira um aviso, com contagem de leitura.
create table avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo text not null,
  segmento text not null,            -- "todos", "atrasados", "rota:<id>"…
  segmento_rotulo text not null,     -- como aparece no histórico: "Todos os clientes ativos"
  destinatarios integer not null default 0,
  pushes integer not null default 0, -- quantos avisos chegaram a um aparelho com notificação ativada
  enviado_por uuid references usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index avisos_criado_idx on avisos (criado_em desc);
alter table avisos enable row level security;
create policy avisos_equipe_ler on avisos for select using (is_equipe());
-- escrita só pelo servidor (service role)

alter table notificacoes add column aviso_id uuid references avisos (id) on delete cascade;
create index notificacoes_aviso_idx on notificacoes (aviso_id) where aviso_id is not null;

alter table membros add column ultimo_acesso timestamptz;

-- Histórico com quem recebeu e quem já leu.
create view avisos_resumo with (security_invoker = true) as
select a.id, a.titulo, a.corpo, a.segmento, a.segmento_rotulo, a.destinatarios, a.pushes, a.criado_em,
       count(n.id)::int as gravados, count(n.lida_em)::int as lidos
from avisos a left join notificacoes n on n.aviso_id = a.id
group by a.id;
grant select on avisos_resumo to authenticated;

-- Freio para tentativas de entrada no app (e-mail + telefone). Só o servidor lê e escreve.
create table tentativas_login (
  id bigserial primary key,
  chave text not null,               -- "email:<e-mail>" ou "ip:<endereço>"
  criada_em timestamptz not null default now()
);
create index tentativas_login_idx on tentativas_login (chave, criada_em desc);
alter table tentativas_login enable row level security;

-- Resumo por mês para o gráfico de Pagamentos (uma linha por competência, sem estourar o limite de linhas da API).
create function resumo_cobrancas(p_ini date, p_fim date)
returns table (competencia date, esperado bigint, recebido bigint, cobrancas integer)
language sql stable security invoker set search_path = public as $$
  select c.competencia,
         coalesce(sum(c.valor_centavos) filter (where c.status in ('pendente', 'paga')), 0)::bigint,
         coalesce(sum(p.pago), 0)::bigint,
         (count(*) filter (where c.status in ('pendente', 'paga')))::integer
  from cobrancas c
  left join lateral (select sum(valor_centavos) as pago from pagamentos where cobranca_id = c.id) p on true
  where c.competencia between p_ini and p_fim
  group by c.competencia
  order by c.competencia
$$;
