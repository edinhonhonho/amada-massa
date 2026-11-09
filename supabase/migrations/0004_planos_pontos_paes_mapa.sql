-- Amada Massa — planos livres, pontos de coleta completos, vários pães por semana, coordenadas e trajeto das rotas.

-- ---------------------------------------------------------------- planos
-- Antes só 1 ou 2 pães e um plano por modalidade/quantidade. Agora o clube cria os planos que quiser
-- (ex.: valor solidário, 3 pães).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'planos'::regclass and (contype = 'u' or (contype = 'c' and pg_get_constraintdef(oid) like '%paes_por_semana%'))
  loop
    execute format('alter table planos drop constraint %I', r.conname);
  end loop;
end $$;
alter table planos add constraint planos_paes_por_semana_check check (paes_por_semana between 1 and 30);

-- ---------------------------------------------------------- pontos_coleta
alter table pontos_coleta
  add column tipo text not null default 'ponto' check (tipo in ('padaria', 'ponto')),
  add column logradouro text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column cidade text not null default 'Porto Alegre',
  add column cep text,
  add column referencia text,
  -- [{"dia":2,"abre":"11:00","fecha":"14:00"}, ...]  dia 0=domingo; um dia pode ter várias janelas
  add column horarios jsonb not null default '[]'::jsonb,
  add column lat double precision,
  add column lng double precision;

update pontos_coleta set tipo = 'padaria', logradouro = 'Rua Doutor Sebastião Leão', numero = '90', bairro = 'Cidade Baixa',
  horarios = '[{"dia":2,"abre":"11:00","fecha":"14:00"},{"dia":2,"abre":"16:30","fecha":"18:30"},{"dia":3,"abre":"11:00","fecha":"18:30"}]'
  where nome = 'Padaria';
update pontos_coleta set logradouro = 'Av. Wenceslau Escobar', numero = '1766',
  horarios = '[{"dia":3,"abre":"11:30","fecha":"18:00"}]'
  where nome like 'Zona Sul%';
update pontos_coleta set logradouro = 'Av. Ramiro Barcelos', numero = '1800', bairro = 'Bom Fim',
  horarios = '[{"dia":2,"abre":"11:00","fecha":"19:00"}]'
  where nome like 'Bom Fim%';

-- Coleta na padaria só na Padaria; ponto de coleta só em ponto de retirada; entrega sem ponto.
create function validar_ponto_assinatura() returns trigger
language plpgsql as $$
declare m modalidade; t text;
begin
  select modalidade into m from planos where id = new.plano_id;
  if m = 'entrega' then
    new.ponto_coleta_id := null;
  else
    select tipo into t from pontos_coleta where id = new.ponto_coleta_id;
    if m = 'coleta_padaria' and t is distinct from 'padaria' then
      raise exception 'Coleta na padaria exige o ponto "Padaria".';
    elsif m = 'coleta_ponto' and t is distinct from 'ponto' then
      raise exception 'Ponto de coleta exige um ponto de retirada (não a padaria).';
    end if;
  end if;
  return new;
end $$;
create trigger assinaturas_validar_ponto before insert or update of plano_id, ponto_coleta_id on assinaturas
  for each row execute function validar_ponto_assinatura();

-- -------------------------------------------------- coordenadas e trajeto
alter table clientes add column lat double precision, add column lng double precision;

alter table rotas
  add column origem_ponto_id uuid references pontos_coleta (id) on delete set null,
  add column trajeto jsonb,           -- [[lat,lng], ...] traçado no mapa
  add column distancia_m integer,
  add column duracao_s integer;

-- ----------------------------------------------------- pães da semana
create table paes_semana (
  id uuid primary key default gen_random_uuid(),
  semana_id uuid not null references semanas (id) on delete cascade,
  nome text not null,
  descricao text,
  ingredientes text,
  alergenos text,                      -- separados por vírgula
  ordem smallint not null default 0,
  criado_em timestamptz not null default now()
);
create index paes_semana_idx on paes_semana (semana_id, ordem);
alter table paes_semana enable row level security;
create policy paes_semana_equipe on paes_semana for all using (is_equipe()) with check (is_equipe());

-- semanas.sabor passa a ser o resumo dos pães ("Centeio + Integral"), mantido pelo banco.
create function sincronizar_sabor_semana() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_semana uuid := coalesce(new.semana_id, old.semana_id);
begin
  update semanas s set
    sabor = (select string_agg(nome, ' + ' order by ordem, criado_em) from paes_semana where semana_id = v_semana),
    alergenos = (select string_agg(distinct trim(a), ', ')
                 from paes_semana p, unnest(string_to_array(coalesce(p.alergenos, ''), ',')) a
                 where p.semana_id = v_semana and trim(a) <> '')
  where s.id = v_semana;
  return null;
end $$;

-- semanas que já tinham um sabor viram o primeiro pão
insert into paes_semana (semana_id, nome, descricao, ingredientes, alergenos)
  select id, sabor, descricao, ingredientes, alergenos from semanas where coalesce(sabor, '') <> '';

create trigger paes_semana_sincroniza after insert or update or delete on paes_semana
  for each row execute function sincronizar_sabor_semana();

-- ------------------------------------------- mapa no app do entregador
drop function entregas_da_rota(uuid, uuid);
create function entregas_da_rota(p_semana uuid, p_rota uuid)
returns table (id uuid, ordem integer, nome text, telefone text, endereco text, bairro text,
               instrucoes text, qtd smallint, status status_entrega, ocorrencia text,
               observacao text, entregue_em timestamptz, tem_foto boolean,
               lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select e.id, e.ordem, trim(c.nome || ' ' || c.sobrenome), c.whatsapp,
         concat_ws(', ', c.logradouro || coalesce(' ' || c.numero, ''), c.complemento),
         c.bairro,
         concat_ws(' · ', c.referencia_portaria, c.instrucoes_entrega),
         e.qtd_prevista, e.status, e.ocorrencia, e.observacao, e.entregue_em, e.foto_path is not null,
         c.lat, c.lng
  from entregas e join clientes c on c.id = e.cliente_id
  where e.semana_id = p_semana and e.rota_id = p_rota and pode_operar_rota(p_rota)
    and e.status in ('programada', 'entregue', 'nao_entregue', 'reagendada')
  order by e.ordem, c.nome
$$;

-- Trajeto desenhado pela gestão e ponto de partida, para o entregador.
create function rota_trajeto(p_rota uuid)
returns table (trajeto jsonb, distancia_m integer, duracao_s integer, origem_nome text, origem_lat double precision, origem_lng double precision)
language sql stable security definer set search_path = public as $$
  select r.trajeto, r.distancia_m, r.duracao_s, p.nome, p.lat, p.lng
  from rotas r left join pontos_coleta p on p.id = r.origem_ponto_id
  where r.id = p_rota and pode_operar_rota(p_rota)
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon;
  end if;
end $$;
