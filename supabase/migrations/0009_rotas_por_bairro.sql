-- Amada Massa — rotas por bairro e pão tradicional como um pão qualquer.
-- Rode DEPOIS da 0008.

-- ------------------------------------------------------------------ rotas por bairro
-- A rota passa a cobrir bairros. Quem entra nela, a ordem e o caminho são definidos a cada semana,
-- a partir de quem tem assinatura ativa de entrega naquele bairro.
alter table rotas add column bairros text[] not null default '{}';

-- Compara bairros sem diferenciar acento, caixa nem espaços sobrando.
create function norm_bairro(t text) returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g')
$$;

-- Rota de um cliente: a atribuição manual (se houver) vale mais; senão, a rota ativa que cobre o bairro dele.
create function rota_do_cliente(p_cliente uuid) returns uuid language sql stable as $$
  select coalesce(
    (select ar.rota_id from atribuicoes_rota ar join rotas r on r.id = ar.rota_id and r.ativa
      where ar.cliente_id = p_cliente and ar.fim is null limit 1),
    (select r.id from clientes c join rotas r on r.ativa
        and norm_bairro(trim(c.bairro)) <> ''
        and exists (select 1 from unnest(r.bairros) b where norm_bairro(trim(b)) = norm_bairro(trim(c.bairro)))
      where c.id = p_cliente order by r.nome limit 1))
$$;

create or replace function gerar_entregas(p_semana uuid) returns integer
language plpgsql as $$
declare s semanas; n integer;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  select * into s from semanas where id = p_semana;
  if not found or s.sem_producao then return 0; end if;
  insert into entregas (semana_id, assinatura_id, cliente_id, rota_id, rota_nome,
                        ponto_coleta_id, ponto_nome, ordem, qtd_prevista, status)
  select s.id, a.id, a.cliente_id, r.id, r.nome, a.ponto_coleta_id, pc.nome,
         coalesce(ar.ordem, 0), p.paes_por_semana,
         (case
            when exists (select 1 from pulos_semana ps where ps.semana_id = s.id and ps.assinatura_id = a.id) then 'pulada'
            when assinatura_em_atraso(a.id) then 'suspensa_atraso'
            else 'programada'
          end)::status_entrega
  from assinaturas a
  join planos p on p.id = a.plano_id
  join clientes c on c.id = a.cliente_id
  left join lateral (select case when p.modalidade = 'entrega' then rota_do_cliente(a.cliente_id) end as id) rr on true
  left join rotas r on r.id = rr.id
  left join atribuicoes_rota ar on ar.cliente_id = a.cliente_id and ar.fim is null and ar.rota_id = r.id
  left join pontos_coleta pc on pc.id = a.ponto_coleta_id
  where a.status = 'ativa' and c.status = 'ativo' and p.modalidade::text <> 'apoio' and p.paes_por_semana > 0
    and a.inicio <= s.fim and (a.fim is null or a.fim >= s.inicio)
  on conflict (semana_id, assinatura_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Entregas da semana ainda sem rota ganham a rota do bairro (não mexe em quem já foi movido à mão).
create function alocar_rotas_semana(p_semana uuid) returns integer
language plpgsql as $$
declare n integer;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  update entregas e set rota_id = x.rota_id, rota_nome = r.nome
  from (select e2.id, rota_do_cliente(e2.cliente_id) as rota_id from entregas e2
          join assinaturas a on a.id = e2.assinatura_id join planos p on p.id = a.plano_id
         where e2.semana_id = p_semana and e2.rota_id is null and p.modalidade = 'entrega'
           and e2.status in ('programada', 'reagendada', 'suspensa_atraso')) x
  join rotas r on r.id = x.rota_id
  where e.id = x.id and x.rota_id is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Depois de mudar os bairros de uma rota: refaz a rota das entregas ainda não realizadas das semanas abertas.
create function realocar_rotas_abertas() returns integer
language plpgsql as $$
declare n integer;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  update entregas e set rota_id = x.rota_id, rota_nome = r.nome
  from (select e2.id, rota_do_cliente(e2.cliente_id) as rota_id from entregas e2
          join semanas s on s.id = e2.semana_id and not s.lista_fechada and s.fim >= current_date
          join assinaturas a on a.id = e2.assinatura_id join planos p on p.id = a.plano_id
         where p.modalidade = 'entrega' and e2.status in ('programada', 'reagendada', 'suspensa_atraso')) x
  left join rotas r on r.id = x.rota_id
  where e.id = x.id and e.rota_id is distinct from x.rota_id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function preparar_semana(p_semana uuid) returns integer
language plpgsql as $$
declare v_novas integer := 0; v_fechada boolean;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  select lista_fechada into v_fechada from semanas where id = p_semana;
  if v_fechada is null or v_fechada then return 0; end if;
  v_novas := gerar_entregas(p_semana);
  perform alocar_rotas_semana(p_semana);
  perform reavaliar_entregas();
  if v_novas > 0 then perform distribuir_paes(p_semana); end if;
  return v_novas;
end $$;

-- Excluir uma rota leva junto o histórico de atribuições; as entregas ficam sem rota.
alter table atribuicoes_rota drop constraint atribuicoes_rota_rota_id_fkey;
alter table atribuicoes_rota add constraint atribuicoes_rota_rota_id_fkey foreign key (rota_id) references rotas (id) on delete cascade;

-- ------------------------------------------------------------------ pão tradicional
-- O tradicional é um pão como os outros: entra na semana só se for escolhido e participa da divisão.
-- A quantidade fixa da assinatura (paes_tradicionais) continua valendo quando ele está na semana;
-- o restante é dividido entre TODOS os pães da semana, inclusive o tradicional.
create or replace function distribuir_paes(p_semana uuid) returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  delete from entrega_paes ep using entregas e
    where ep.entrega_id = e.id and e.semana_id = p_semana and not e.paes_manual;

  with pw as (
    select ps.pao_id, p.tradicional,
           (row_number() over (order by ps.ordem, ps.criado_em) - 1)::int as pos, (count(*) over ())::int as total
    from paes_semana ps join paes p on p.id = ps.pao_id where ps.semana_id = p_semana),
  tr as (select pao_id from pw where tradicional order by pos limit 1),
  base as (
    select e.id as entrega_id, e.qtd_prevista::int as qtd,
           case when exists (select 1 from tr) then least(a.paes_tradicionais, e.qtd_prevista)::int else 0 end as trad
    from entregas e join assinaturas a on a.id = e.assinatura_id
    where e.semana_id = p_semana and not e.paes_manual and e.qtd_prevista > 0),
  ins_t as (select b.entrega_id, (select pao_id from tr) as pao_id, b.trad::smallint as quantidade from base b where b.trad > 0),
  ins_v as (
    select b.entrega_id, pw.pao_id, count(*)::smallint as quantidade
    from base b cross join lateral generate_series(0, b.qtd - b.trad - 1) g(i)
    join pw on pw.pos = g.i % pw.total group by b.entrega_id, pw.pao_id)
  insert into entrega_paes (entrega_id, pao_id, quantidade)
  select entrega_id, pao_id, sum(quantidade)::smallint
  from (select * from ins_t union all select * from ins_v) u
  group by entrega_id, pao_id;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon;
  end if;
end $$;

-- Faz a API do Supabase enxergar a coluna nova (bairros) sem esperar.
notify pgrst, 'reload schema';
