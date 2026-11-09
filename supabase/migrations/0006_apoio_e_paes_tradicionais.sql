-- Amada Massa — apoio recorrente (paga sem receber pão) e pães tradicionais (fixos, além do pão da semana).
-- Rode depois da 0005.  ATENÇÃO: rode esta migração SOZINHA, antes de qualquer importação que use a modalidade "apoio".

alter type modalidade add value if not exists 'apoio';

-- planos de apoio têm 0 pães
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'planos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%paes_por_semana%' loop
    execute format('alter table planos drop constraint %I', r.conname);
  end loop;
end $$;
alter table planos add constraint planos_paes_por_semana_check check (paes_por_semana between 0 and 30);

-- pão tradicional: o mesmo todas as semanas. Cada assinatura diz quantos dos seus pães são tradicionais.
alter table paes add column tradicional boolean not null default false;
alter table assinaturas add column paes_tradicionais smallint not null default 0 check (paes_tradicionais >= 0);

-- apoio não tem ponto de retirada
create or replace function validar_ponto_assinatura() returns trigger
language plpgsql as $$
declare m modalidade; t text;
begin
  select modalidade into m from planos where id = new.plano_id;
  if m::text in ('entrega', 'apoio') then
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

-- Apoio recorrente não recebe pão: nunca entra nas entregas da semana.
create or replace function gerar_entregas(p_semana uuid) returns integer
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
  where a.status = 'ativa' and c.status = 'ativo' and p.modalidade::text <> 'apoio' and p.paes_por_semana > 0
    and a.inicio <= s.fim and (a.fim is null or a.fim >= s.inicio)
  on conflict (semana_id, assinatura_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Divisão automática: os tradicionais da assinatura vão para o pão tradicional da semana;
-- o resto é dividido em rodízio entre os demais pães (se só houver o tradicional, tudo vai nele).
create or replace function distribuir_paes(p_semana uuid) returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  delete from entrega_paes ep using entregas e
    where ep.entrega_id = e.id and e.semana_id = p_semana and not e.paes_manual;

  with pw as (
    select ps.pao_id, p.tradicional, row_number() over (order by ps.ordem, ps.criado_em) as pos
    from paes_semana ps join paes p on p.id = ps.pao_id where ps.semana_id = p_semana),
  nt as (select pao_id, (row_number() over (order by pos) - 1)::int as pos, (count(*) over ())::int as total from pw where not tradicional),
  tr as (select pao_id from pw where tradicional order by pos limit 1),
  base as (
    select e.id as entrega_id, e.qtd_prevista::int as qtd,
           case when exists (select 1 from tr) then least(a.paes_tradicionais, e.qtd_prevista)::int else 0 end as trad
    from entregas e join assinaturas a on a.id = e.assinatura_id
    where e.semana_id = p_semana and not e.paes_manual and e.qtd_prevista > 0),
  ins_t as (select b.entrega_id, (select pao_id from tr) as pao_id, b.trad::smallint as quantidade from base b where b.trad > 0),
  ins_v as (
    select b.entrega_id, nt.pao_id, count(*)::smallint as quantidade
    from base b cross join lateral generate_series(0, b.qtd - b.trad - 1) g(i)
    join nt on nt.pos = g.i % nt.total group by b.entrega_id, nt.pao_id),
  ins_r as (
    select b.entrega_id, (select pao_id from tr) as pao_id, (b.qtd - b.trad)::smallint as quantidade
    from base b where not exists (select 1 from nt) and exists (select 1 from tr) and b.qtd - b.trad > 0)
  insert into entrega_paes (entrega_id, pao_id, quantidade)
  select entrega_id, pao_id, sum(quantidade)::smallint
  from (select * from ins_t union all select * from ins_v union all select * from ins_r) u
  group by entrega_id, pao_id;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon;
  end if;
end $$;
