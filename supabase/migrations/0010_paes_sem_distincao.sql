-- Amada Massa — o pão tradicional é um pão como os outros.
-- Rode DEPOIS da 0009 (que deve ter sido rodada antes: ela cria a coluna rotas.bairros).

-- A divisão dos pães de cada cliente considera todos os pães escolhidos para a semana, por igual.
-- (A quantidade fixa de tradicionais por assinatura deixa de ser usada; a coluna fica no banco, sem efeito.)
create or replace function distribuir_paes(p_semana uuid) returns void
language plpgsql as $$
begin
  if not is_equipe() then raise exception 'sem permissão'; end if;
  delete from entrega_paes ep using entregas e
    where ep.entrega_id = e.id and e.semana_id = p_semana and not e.paes_manual;

  with pw as (
    select ps.pao_id,
           (row_number() over (order by ps.ordem, ps.criado_em) - 1)::int as pos, (count(*) over ())::int as total
    from paes_semana ps where ps.semana_id = p_semana),
  base as (
    select e.id as entrega_id, e.qtd_prevista::int as qtd
    from entregas e
    where e.semana_id = p_semana and not e.paes_manual and e.qtd_prevista > 0)
  insert into entrega_paes (entrega_id, pao_id, quantidade)
  select b.entrega_id, pw.pao_id, count(*)::smallint
  from base b cross join lateral generate_series(0, b.qtd - 1) g(i)
  join pw on pw.pos = g.i % pw.total
  group by b.entrega_id, pw.pao_id;
end $$;

-- Faz a API do Supabase enxergar as colunas novas (bairros) sem esperar.
notify pgrst, 'reload schema';
