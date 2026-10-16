-- Amada Massa — Fases 2 a 6: cobranças, pagamentos, rotas, semanas, entregas, mensagens.

create function hoje_br() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- ----------------------------------------------------------- configuracoes
create table configuracoes (
  chave text primary key,
  valor integer not null,
  descricao text
);
insert into configuracoes values
  ('a_vencer_dias', 3, 'Dias antes do vencimento em que a mensalidade vira "a vencer"'),
  ('atraso_critico_dias', 15, 'Dias de atraso a partir dos quais o atraso é crítico'),
  ('carencia_dias', 0, 'Dias de carência após o vencimento antes de suspender a entrega');
alter table configuracoes enable row level security;
create policy config_ler on configuracoes for select using (is_equipe());
create policy config_admin on configuracoes for all using (is_admin()) with check (is_admin());

-- --------------------------------------------------------------- cobrancas
create type status_cobranca as enum ('pendente', 'paga', 'isenta', 'cancelada');
create type forma_pagamento as enum ('pix', 'transferencia', 'debito_automatico', 'dinheiro', 'outro');

create table cobrancas (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references assinaturas (id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  valor_centavos integer not null check (valor_centavos >= 0),
  vencimento date not null,
  status status_cobranca not null default 'pendente',
  justificativa text,
  criado_em timestamptz not null default now(),
  unique (assinatura_id, competencia)
);
create index cobrancas_competencia_idx on cobrancas (competencia, status);
create index cobrancas_venc_idx on cobrancas (vencimento) where status = 'pendente';

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references cobrancas (id) on delete cascade,
  valor_centavos integer not null check (valor_centavos > 0),
  data date not null default hoje_br(),
  forma forma_pagamento not null default 'pix',
  observacao text,
  usuario_id uuid references usuarios (id),
  criado_em timestamptz not null default now()
);
create index pagamentos_cobranca_idx on pagamentos (cobranca_id);

-- Cria as cobranças do mês (idempotente). Mês cheio no mês de início;
-- vencimento antes do início passa a ser o dia do início.
create function gerar_cobrancas(p_competencia date) returns integer
language plpgsql as $$
declare
  v_ini date := date_trunc('month', p_competencia)::date;
  v_fim date := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;
  n integer;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  insert into cobrancas (assinatura_id, competencia, valor_centavos, vencimento)
  select a.id, v_ini, a.valor_centavos, greatest(v_ini + (a.dia_vencimento - 1), a.inicio)
  from assinaturas a
  where a.status = 'ativa' and a.inicio <= v_fim and (a.fim is null or a.fim >= v_ini)
  on conflict (assinatura_id, competencia) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Assinatura em atraso = existe cobrança pendente vencida além da carência.
create function assinatura_em_atraso(p_assinatura uuid, p_ref date default hoje_br())
returns boolean language sql stable as $$
  select exists (
    select 1 from cobrancas c
    where c.assinatura_id = p_assinatura and c.status = 'pendente'
      and c.vencimento + coalesce((select valor from configuracoes where chave = 'carencia_dias'), 0) < p_ref
  )
$$;

-- --------------------------------------------------------------- rotas
create table rotas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  dia_semana smallint check (dia_semana between 0 and 6),
  janela_inicio time,
  janela_fim time,
  cor text not null default '#b45309',
  entregador_id uuid references usuarios (id) on delete set null,
  capacidade_paes integer check (capacidade_paes > 0),
  ativa boolean not null default true
);

create table atribuicoes_rota (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  rota_id uuid not null references rotas (id),
  ordem integer not null default 0,
  inicio date not null default hoje_br(),
  fim date
);
-- Só uma atribuição ativa por cliente (spec 12).
create unique index atribuicao_ativa_unica on atribuicoes_rota (cliente_id) where fim is null;
create index atribuicoes_rota_idx on atribuicoes_rota (rota_id) where fim is null;

-- --------------------------------------------------------------- semanas
create type status_semana as enum ('planejada', 'em_producao', 'entregue', 'encerrada');
create type status_entrega as enum
  ('programada', 'entregue', 'retirada', 'nao_entregue', 'pulada', 'reagendada', 'suspensa_atraso');

create table semanas (
  id uuid primary key default gen_random_uuid(),
  inicio date not null unique,
  fim date not null,
  sabor text,
  descricao text,
  ingredientes text,
  alergenos text,
  status status_semana not null default 'planejada',
  sem_producao boolean not null default false,
  lista_fechada boolean not null default false,
  observacao text,
  check (fim >= inicio)
);

create table pulos_semana (
  semana_id uuid not null references semanas (id) on delete cascade,
  assinatura_id uuid not null references assinaturas (id) on delete cascade,
  motivo text,
  primary key (semana_id, assinatura_id)
);

create table entregas (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references semanas (id) on delete cascade,
  assinatura_id uuid not null references assinaturas (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  -- cópias do momento, para o histórico não ser reescrito (spec 9)
  rota_id uuid references rotas (id) on delete set null,
  rota_nome text,
  ponto_coleta_id uuid references pontos_coleta (id) on delete set null,
  ponto_nome text,
  ordem integer not null default 0,
  qtd_prevista smallint not null,
  qtd_entregue smallint,
  status status_entrega not null default 'programada',
  entregue_em timestamptz,
  entregador_id uuid references usuarios (id) on delete set null,
  ocorrencia text,
  observacao text,
  unique (semana_id, assinatura_id)
);
create index entregas_semana_idx on entregas (semana_id, rota_id, ordem);
create index entregas_cliente_idx on entregas (cliente_id);

-- Gera os registros da semana: programada, pulada ou suspensa por atraso.
create function gerar_entregas(p_semana uuid) returns integer
language plpgsql as $$
declare s semanas; n integer;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  select * into s from semanas where id = p_semana;
  if not found or s.sem_producao then return 0; end if;
  insert into entregas (semana_id, assinatura_id, cliente_id, rota_id, rota_nome,
                        ponto_coleta_id, ponto_nome, ordem, qtd_prevista, status)
  select s.id, a.id, a.cliente_id, ar.rota_id, r.nome, a.ponto_coleta_id, pc.nome,
         coalesce(ar.ordem, 0), p.paes_por_semana,
         (case
            when exists (select 1 from pulos_semana ps where ps.semana_id = s.id and ps.assinatura_id = a.id) then 'pulada'
            when assinatura_em_atraso(a.id) then 'suspensa_atraso'
            else 'programada'
          end)::status_entrega
  from assinaturas a
  join planos p on p.id = a.plano_id
  join clientes c on c.id = a.cliente_id
  left join atribuicoes_rota ar on ar.cliente_id = a.cliente_id and ar.fim is null and p.modalidade = 'entrega'
  left join rotas r on r.id = ar.rota_id
  left join pontos_coleta pc on pc.id = a.ponto_coleta_id
  where a.status = 'ativa' and c.status = 'ativo'
    and a.inicio <= s.fim and (a.fim is null or a.fim >= s.inicio)
  on conflict (semana_id, assinatura_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Reavalia semanas abertas: pagamento baixado devolve a entrega; atraso novo suspende;
-- assinatura pausada/cancelada deixa de entrar.
create function reavaliar_entregas() returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  update entregas e set
    status = case
      when a.status <> 'ativa' then 'pulada'
      when assinatura_em_atraso(e.assinatura_id) then 'suspensa_atraso'
      else 'programada' end::status_entrega,
    observacao = case when a.status <> 'ativa' then 'Assinatura pausada ou cancelada' else e.observacao end
  from semanas s, assinaturas a
  where s.id = e.semana_id and a.id = e.assinatura_id
    and not s.lista_fechada and s.status in ('planejada', 'em_producao')
    and e.status in ('programada', 'suspensa_atraso')
    and e.status <> (case
      when a.status <> 'ativa' then 'pulada'
      when assinatura_em_atraso(e.assinatura_id) then 'suspensa_atraso'
      else 'programada' end)::status_entrega;
end $$;

-- --------------------------------------------- acesso do entregador (sem dados financeiros)
create function pode_operar_rota(p_rota uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(is_equipe(), false)
      or exists (select 1 from rotas r where r.id = p_rota and r.entregador_id = auth.uid() and perfil_atual() = 'entregador')
$$;

create function entregas_da_rota(p_semana uuid, p_rota uuid)
returns table (id uuid, ordem integer, nome text, telefone text, endereco text, bairro text,
               instrucoes text, qtd smallint, status status_entrega, ocorrencia text)
language sql stable security definer set search_path = public as $$
  select e.id, e.ordem, trim(c.nome || ' ' || c.sobrenome), c.whatsapp,
         concat_ws(', ', c.logradouro || coalesce(' ' || c.numero, ''), c.complemento),
         c.bairro,
         concat_ws(' · ', c.referencia_portaria, c.instrucoes_entrega),
         e.qtd_prevista, e.status, e.ocorrencia
  from entregas e join clientes c on c.id = e.cliente_id
  where e.semana_id = p_semana and e.rota_id = p_rota and pode_operar_rota(p_rota)
    and e.status in ('programada', 'entregue', 'nao_entregue', 'reagendada')
  order by e.ordem, c.nome
$$;

create function marcar_entrega(p_id uuid, p_status status_entrega, p_ocorrencia text default null,
                               p_observacao text default null, p_em timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare e entregas;
begin
  select * into e from entregas where id = p_id;
  if not found then raise exception 'entrega não encontrada'; end if;
  if e.rota_id is null then
    if not is_equipe() then raise exception 'sem permissão'; end if;
  elsif not pode_operar_rota(e.rota_id) then
    raise exception 'sem permissão';
  end if;
  if e.status in ('pulada', 'suspensa_atraso') then raise exception 'entrega não está ativa'; end if;
  if p_status not in ('programada', 'entregue', 'retirada', 'nao_entregue', 'reagendada') then
    raise exception 'status inválido';
  end if;
  update entregas set
    status = p_status,
    qtd_entregue = case when p_status in ('entregue', 'retirada') then qtd_prevista else null end,
    entregue_em = case when p_status in ('entregue', 'retirada') then least(p_em, now()) end,
    entregador_id = auth.uid(),
    ocorrencia = case when p_status in ('nao_entregue', 'reagendada') then p_ocorrencia end,
    observacao = coalesce(p_observacao, observacao)
  where id = p_id;
end $$;

-- ------------------------------------------------------------ mensagens
create table modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  texto text not null
);
insert into modelos_mensagem (chave, nome, texto) values
  ('boas_vindas', 'Boas-vindas', 'Oi, {nome}! Bem-vindo(a) ao Clube do Pão Amada Massa 🍞 Sua assinatura ({plano}) está confirmada.'),
  ('confirmacao', 'Confirmação de assinatura', 'Oi, {nome}! Confirmando sua assinatura: {plano}, {valor}/mês, pagamento até o dia {dia_pagamento}.'),
  ('lembrete_pagamento', 'Lembrete de pagamento', 'Oi, {nome}! Passando para lembrar que a mensalidade de {valor} vence em {vencimento}. Pode pagar por PIX, transferência ou débito automático (Papayas).'),
  ('cobranca_atraso', 'Cobrança de atraso', 'Oi, {nome}! A mensalidade de {valor} (venc. {vencimento}) ainda não aparece por aqui. Assim que o pagamento for confirmado, sua entrega volta ao planejamento. Qualquer dúvida, é só chamar!'),
  ('sabor_semana', 'Sabor da semana', 'Oi, {nome}! O pão desta semana é {sabor}. {dia_horario}'),
  ('aviso_feriado', 'Semana sem produção', 'Oi, {nome}! Esta semana não teremos produção. Voltamos na próxima 🍞'),
  ('confirmar_endereco', 'Confirmação de endereço', 'Oi, {nome}! Pode confirmar seu endereço de entrega? Temos: {endereco}.'),
  ('pesquisa', 'Pesquisa de satisfação', 'Oi, {nome}! O que está achando dos pães do clube? Sua opinião ajuda muito.');
alter table modelos_mensagem enable row level security;
create policy modelos_equipe on modelos_mensagem for all using (is_equipe()) with check (is_equipe());

-- ------------------------------------------------------------------ RLS
alter table cobrancas enable row level security;
alter table pagamentos enable row level security;
alter table rotas enable row level security;
alter table atribuicoes_rota enable row level security;
alter table semanas enable row level security;
alter table pulos_semana enable row level security;
alter table entregas enable row level security;

-- a equipe precisa listar usuários (ex.: escolher entregador da rota)
create policy usuarios_equipe_ler on usuarios for select using (is_equipe());

create policy cobrancas_equipe on cobrancas for all using (is_equipe()) with check (is_equipe());
create policy pagamentos_equipe on pagamentos for all using (is_equipe()) with check (is_equipe());
create policy rotas_ler on rotas for select using (perfil_atual() is not null);
create policy rotas_equipe on rotas for all using (is_equipe()) with check (is_equipe());
create policy atribuicoes_equipe on atribuicoes_rota for all using (is_equipe()) with check (is_equipe());
create policy semanas_ler on semanas for select using (perfil_atual() is not null);
create policy semanas_equipe on semanas for all using (is_equipe()) with check (is_equipe());
create policy pulos_equipe on pulos_semana for all using (is_equipe()) with check (is_equipe());
create policy entregas_equipe on entregas for all using (is_equipe()) with check (is_equipe());

-- ---------------------------------------------------------------- auditoria
create trigger auditar_cobrancas after insert or update or delete on cobrancas
  for each row execute function auditar();
create trigger auditar_pagamentos after insert or update or delete on pagamentos
  for each row execute function auditar();
create trigger auditar_atribuicoes after insert or update or delete on atribuicoes_rota
  for each row execute function auditar();
create trigger auditar_rotas after insert or update or delete on rotas
  for each row execute function auditar();

-- Endurecimento: usuários não autenticados (anon) não chamam funções por RPC.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon;
  end if;
end $$;
