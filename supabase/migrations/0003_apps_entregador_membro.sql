-- Amada Massa — app do entregador (rota iniciada, fotos) e app do membro (login por código, notificações).

-- Contas de membro (criadas pelo servidor) não entram na tabela de equipe "usuarios".
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_app_meta_data ->> 'membro' = 'true' then return new; end if;
  insert into usuarios (id, nome, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'perfil')::perfil_usuario, 'entregador')
  );
  return new;
end $$;

-- ------------------------------------------------------------------ membros
create table membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cliente_id uuid not null unique references clientes (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create function meu_cliente_id() returns uuid
language sql stable security definer set search_path = public as $$
  select cliente_id from membros where user_id = auth.uid()
$$;

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text not null,
  url text,
  ref text,                       -- evita avisar duas vezes o mesmo fato (ex.: id da entrega)
  criada_em timestamptz not null default now(),
  lida_em timestamptz
);
create unique index notificacoes_ref_unica on notificacoes (cliente_id, tipo, ref) where ref is not null;
create index notificacoes_cliente_idx on notificacoes (cliente_id, criada_em desc);

create table push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid not null references clientes (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now()
);
create index push_inscricoes_cliente_idx on push_inscricoes (cliente_id);

alter table membros enable row level security;
alter table notificacoes enable row level security;
alter table push_inscricoes enable row level security;

-- Escrita em membros e criação de notificações só pelo servidor (service role).
create policy membros_ler on membros for select using (user_id = auth.uid() or is_equipe());
create policy notificacoes_ler on notificacoes for select using (cliente_id = meu_cliente_id() or is_equipe());
create policy notificacoes_marcar_lida on notificacoes for update
  using (cliente_id = meu_cliente_id()) with check (cliente_id = meu_cliente_id());
revoke update on notificacoes from authenticated;
grant update (lida_em) on notificacoes to authenticated;

create policy push_ler on push_inscricoes for select using (user_id = auth.uid() or is_equipe());
create policy push_inserir on push_inscricoes for insert
  with check (user_id = auth.uid() and cliente_id = meu_cliente_id());
create policy push_apagar on push_inscricoes for delete using (user_id = auth.uid());

-- ------------------------------------------------------- execução da rota
create table rota_execucoes (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references semanas (id) on delete cascade,
  rota_id uuid not null references rotas (id) on delete cascade,
  iniciada_em timestamptz not null,
  iniciada_por uuid references usuarios (id) on delete set null,
  finalizada_em timestamptz,
  unique (semana_id, rota_id)
);
alter table rota_execucoes enable row level security;
create policy execucoes_equipe on rota_execucoes for all using (is_equipe()) with check (is_equipe());

-- true quando foi a primeira vez (o app avisa os membros só nesse caso).
create function iniciar_rota(p_semana uuid, p_rota uuid, p_em timestamptz default now())
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not pode_operar_rota(p_rota) then raise exception 'sem permissão'; end if;
  insert into rota_execucoes (semana_id, rota_id, iniciada_em, iniciada_por)
  values (p_semana, p_rota, least(p_em, now()), auth.uid())
  on conflict (semana_id, rota_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create function finalizar_rota(p_semana uuid, p_rota uuid, p_em timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
begin
  if not pode_operar_rota(p_rota) then raise exception 'sem permissão'; end if;
  update rota_execucoes set finalizada_em = least(p_em, now())
  where semana_id = p_semana and rota_id = p_rota and finalizada_em is null;
end $$;

create function execucao_da_rota(p_semana uuid, p_rota uuid)
returns table (iniciada_em timestamptz, finalizada_em timestamptz)
language sql stable security definer set search_path = public as $$
  select e.iniciada_em, e.finalizada_em from rota_execucoes e
  where e.semana_id = p_semana and e.rota_id = p_rota and pode_operar_rota(p_rota)
$$;

-- ---------------------------------------------------- entregas com foto
alter table entregas add column foto_path text;

create function pode_operar_entrega(p_entrega uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select pode_operar_rota(e.rota_id) from entregas e where e.id = p_entrega and e.rota_id is not null), false)
      or coalesce(is_equipe(), false)
$$;

drop function entregas_da_rota(uuid, uuid);
create function entregas_da_rota(p_semana uuid, p_rota uuid)
returns table (id uuid, ordem integer, nome text, telefone text, endereco text, bairro text,
               instrucoes text, qtd smallint, status status_entrega, ocorrencia text,
               observacao text, entregue_em timestamptz, tem_foto boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.ordem, trim(c.nome || ' ' || c.sobrenome), c.whatsapp,
         concat_ws(', ', c.logradouro || coalesce(' ' || c.numero, ''), c.complemento),
         c.bairro,
         concat_ws(' · ', c.referencia_portaria, c.instrucoes_entrega),
         e.qtd_prevista, e.status, e.ocorrencia, e.observacao, e.entregue_em, e.foto_path is not null
  from entregas e join clientes c on c.id = e.cliente_id
  where e.semana_id = p_semana and e.rota_id = p_rota and pode_operar_rota(p_rota)
    and e.status in ('programada', 'entregue', 'nao_entregue', 'reagendada')
  order by e.ordem, c.nome
$$;

drop function marcar_entrega(uuid, status_entrega, text, text, timestamptz);
create function marcar_entrega(p_id uuid, p_status status_entrega, p_ocorrencia text default null,
                               p_observacao text default null, p_em timestamptz default now(),
                               p_foto_path text default null)
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
  if p_foto_path is not null and split_part(p_foto_path, '/', 1) <> p_id::text then
    raise exception 'foto de outra entrega';
  end if;
  update entregas set
    status = p_status,
    qtd_entregue = case when p_status in ('entregue', 'retirada') then qtd_prevista else null end,
    entregue_em = case when p_status in ('entregue', 'retirada', 'nao_entregue') then least(p_em, now()) end,
    entregador_id = auth.uid(),
    ocorrencia = case when p_status in ('nao_entregue', 'reagendada') then p_ocorrencia end,
    observacao = case when p_status = 'programada' then null else coalesce(p_observacao, observacao) end,
    foto_path = case when p_status = 'programada' then null else coalesce(p_foto_path, foto_path) end
  where id = p_id;
end $$;

-- ------------------------------------------------------------ storage (fotos)
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('entregas-fotos', 'entregas-fotos', false, 5242880, array['image/jpeg'])
    on conflict (id) do nothing;

    create policy fotos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'entregas-fotos'
                  and pode_operar_entrega(((storage.foldername(name))[1])::uuid));
    create policy fotos_ver on storage.objects for select to authenticated
      using (bucket_id = 'entregas-fotos' and is_equipe());
    create policy fotos_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'entregas-fotos' and is_admin());
  end if;
end $$;

create trigger auditar_rota_execucoes after insert or update on rota_execucoes
  for each row execute function auditar();

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon;
  end if;
end $$;

create function meu_cliente_nome() returns text
language sql stable security definer set search_path = public as $$
  select c.nome from membros m join clientes c on c.id = m.cliente_id where m.user_id = auth.uid()
$$;
revoke execute on function meu_cliente_nome() from public;
grant execute on function meu_cliente_nome() to authenticated;
