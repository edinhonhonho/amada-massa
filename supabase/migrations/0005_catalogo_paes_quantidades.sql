-- Amada Massa — catálogo de pães reutilizável e quantidade de cada pão por cliente em cada semana.
-- Rode depois da 0004.

-- ------------------------------------------------------- catálogo de pães
create table paes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ingredientes text,
  alergenos text,                         -- separados por vírgula
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index paes_nome_unico on paes (lower(nome));
alter table paes enable row level security;
create policy paes_equipe on paes for all using (is_equipe()) with check (is_equipe());

-- O que já estava cadastrado por semana vira o catálogo.
insert into paes (nome, descricao, ingredientes, alergenos)
  select distinct on (lower(nome)) nome, descricao, ingredientes, alergenos from paes_semana order by lower(nome), criado_em;

drop trigger if exists paes_semana_sincroniza on paes_semana;
alter table paes_semana add column pao_id uuid references paes (id) on delete restrict;
update paes_semana ps set pao_id = p.id from paes p where lower(p.nome) = lower(ps.nome);
alter table paes_semana alter column pao_id set not null;
alter table paes_semana drop column nome, drop column descricao, drop column ingredientes, drop column alergenos;
-- o mesmo pão não entra duas vezes na mesma semana
delete from paes_semana a using paes_semana b where a.semana_id = b.semana_id and a.pao_id = b.pao_id and a.ctid > b.ctid;
create unique index paes_semana_unico on paes_semana (semana_id, pao_id);

-- semanas.sabor / alergenos continuam sendo o resumo, agora vindo do catálogo
create or replace function recalcular_sabor_semana(p_semana uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update semanas s set
    sabor = (select string_agg(p.nome, ' + ' order by ps.ordem, ps.criado_em)
             from paes_semana ps join paes p on p.id = ps.pao_id where ps.semana_id = p_semana),
    alergenos = (select string_agg(distinct trim(a), ', ')
                 from paes_semana ps join paes p on p.id = ps.pao_id,
                      unnest(string_to_array(coalesce(p.alergenos, ''), ',')) a
                 where ps.semana_id = p_semana and trim(a) <> '')
  where s.id = p_semana;
end $$;

create or replace function sincronizar_sabor_semana() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recalcular_sabor_semana(coalesce(new.semana_id, old.semana_id));
  return null;
end $$;
create trigger paes_semana_sincroniza after insert or update or delete on paes_semana
  for each row execute function sincronizar_sabor_semana();

-- renomear um pão ou mudar seus alérgenos atualiza todas as semanas que o usam
create function sincronizar_sabor_pao() returns trigger
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  for s in select distinct semana_id from paes_semana where pao_id = new.id loop
    perform recalcular_sabor_semana(s);
  end loop;
  return null;
end $$;
create trigger paes_atualizado after update of nome, alergenos on paes
  for each row execute function sincronizar_sabor_pao();

-- recalcula o que a migração mexeu
do $$ declare s uuid; begin
  for s in select distinct semana_id from paes_semana loop perform recalcular_sabor_semana(s); end loop;
end $$;

-- ------------------------------------- quantidade de cada pão por cliente
create table entrega_paes (
  entrega_id uuid not null references entregas (id) on delete cascade,
  pao_id uuid not null references paes (id) on delete cascade,
  quantidade smallint not null check (quantidade >= 0),
  primary key (entrega_id, pao_id)
);
alter table entrega_paes enable row level security;
create policy entrega_paes_equipe on entrega_paes for all using (is_equipe()) with check (is_equipe());

-- true quando a equipe mexeu nas quantidades do cliente nesta semana (a divisão automática não sobrescreve)
alter table entregas add column paes_manual boolean not null default false;

-- Divisão automática: cada cliente recebe os pães da semana em rodízio (2 pães e 2 sabores = 1 de cada).
create function distribuir_paes(p_semana uuid) returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  delete from entrega_paes ep using entregas e
    where ep.entrega_id = e.id and e.semana_id = p_semana and not e.paes_manual;
  insert into entrega_paes (entrega_id, pao_id, quantidade)
  select e.id, k.pao_id, count(*)::smallint
  from entregas e
  cross join lateral generate_series(0, e.qtd_prevista::int - 1) g(i)
  join (select pao_id,
               (row_number() over (order by ordem, criado_em) - 1)::int as pos,
               (count(*) over ())::int as total
        from paes_semana where semana_id = p_semana) k on k.pos = g.i % k.total
  where e.semana_id = p_semana and not e.paes_manual and e.qtd_prevista > 0
  group by e.id, k.pao_id;
end $$;

-- Volta tudo ao padrão: quantidade do plano e divisão automática.
create function restaurar_distribuicao(p_semana uuid) returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  update entregas e set paes_manual = false, qtd_prevista = p.paes_por_semana
    from assinaturas a join planos p on p.id = a.plano_id
    where e.semana_id = p_semana and a.id = e.assinatura_id;
  perform distribuir_paes(p_semana);
end $$;

-- Mantém "pães previstos" = soma das quantidades quando a divisão é manual.
create function sincronizar_quantidades(p_semana uuid) returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  update entregas e set qtd_prevista = coalesce((select sum(quantidade) from entrega_paes ep where ep.entrega_id = e.id), 0)
    where e.semana_id = p_semana and e.paes_manual;
end $$;

-- Prepara a semana ao abri-la na tela: cria as entregas de quem tem assinatura ativa,
-- reavalia atrasos e divide os pães. Com a lista fechada, nada muda.
create function preparar_semana(p_semana uuid) returns integer
language plpgsql as $$
declare v_novas integer := 0; v_fechada boolean;
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  select lista_fechada into v_fechada from semanas where id = p_semana;
  if v_fechada is null or v_fechada then return 0; end if;
  v_novas := gerar_entregas(p_semana);
  perform reavaliar_entregas();
  if v_novas > 0 then perform distribuir_paes(p_semana); end if;
  return v_novas;
end $$;

-- ---------------------- o entregador vê quais pães entregar em cada parada
drop function entregas_da_rota(uuid, uuid);
create function entregas_da_rota(p_semana uuid, p_rota uuid)
returns table (id uuid, ordem integer, nome text, telefone text, endereco text, bairro text,
               instrucoes text, qtd smallint, status status_entrega, ocorrencia text,
               observacao text, entregue_em timestamptz, tem_foto boolean,
               lat double precision, lng double precision, paes jsonb)
language sql stable security definer set search_path = public as $$
  select e.id, e.ordem, trim(c.nome || ' ' || c.sobrenome), c.whatsapp,
         concat_ws(', ', c.logradouro || coalesce(' ' || c.numero, ''), c.complemento),
         c.bairro,
         concat_ws(' · ', c.referencia_portaria, c.instrucoes_entrega),
         e.qtd_prevista, e.status, e.ocorrencia, e.observacao, e.entregue_em, e.foto_path is not null,
         c.lat, c.lng,
         (select jsonb_agg(jsonb_build_object('nome', p.nome, 'qtd', ep.quantidade) order by ps.ordem)
            from entrega_paes ep join paes p on p.id = ep.pao_id
            left join paes_semana ps on ps.semana_id = e.semana_id and ps.pao_id = ep.pao_id
           where ep.entrega_id = e.id and ep.quantidade > 0)
  from entregas e join clientes c on c.id = e.cliente_id
  where e.semana_id = p_semana and e.rota_id = p_rota and pode_operar_rota(p_rota)
    and e.status in ('programada', 'entregue', 'nao_entregue', 'reagendada')
  order by e.ordem, c.nome
$$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on all functions in schema public from anon;
  end if;
end $$;
