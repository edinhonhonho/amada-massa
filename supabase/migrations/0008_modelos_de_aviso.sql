-- Amada Massa — modelos de aviso editáveis pela equipe (substituem os modelos fixos do código).
-- Rode DEPOIS da 0007.
create table modelos_aviso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  titulo text not null,
  corpo text not null,
  segmento_sugerido text,            -- "atrasados", "pendentes"… (opcional: já seleciona o grupo)
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);
alter table modelos_aviso enable row level security;
create policy modelos_aviso_equipe on modelos_aviso for all using (is_equipe()) with check (is_equipe());

insert into modelos_aviso (nome, titulo, corpo, segmento_sugerido, ordem) values
  ('Aviso geral', 'Recado do Amada Massa', 'Oi, {nome}! ', 'todos', 1),
  ('Lembrete de pagamento', 'Sua mensalidade, {nome}', 'Oi, {nome}! Sua mensalidade de {valor} vence em {vencimento}. Qualquer dúvida é só responder por aqui.', 'pendentes', 2),
  ('Cobrança em atraso', 'Mensalidade em aberto', 'Oi, {nome}! Identificamos {valor} em aberto desde {vencimento}. Assim que o pagamento for confirmado, sua entrega volta ao planejamento.', 'atrasados', 3),
  ('Semana sem entrega', 'Semana sem entrega', 'Oi, {nome}! Nesta semana não teremos produção. Voltamos na próxima, com pão fresquinho.', 'todos', 4),
  ('Novidade', 'Novidade no clube 🍞', 'Oi, {nome}! Temos uma novidade para contar: ', 'todos', 5);
