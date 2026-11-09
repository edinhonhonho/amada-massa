\set ON_ERROR_STOP 1
-- Roda sobre um banco com 0001..0004 aplicadas (semana de 2026-11-02 já existia com sabor "Centeio").
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000a4','adm4@x','{"perfil":"admin"}');
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000a4';

select 'sabor antigo virou pão', count(*) from paes_semana;
-- vários pães: o resumo da semana acompanha
insert into paes_semana (semana_id, nome, ingredientes, alergenos, ordem) select id, 'Integral', 'trigo integral', 'glúten, gergelim', 1 from semanas;
select 'resumo', sabor, alergenos from semanas;
delete from paes_semana where nome = 'Centeio';
select 'após apagar um', sabor from semanas;

-- plano livre: 3 pães, e dois planos da mesma modalidade/quantidade
insert into planos (nome, modalidade, paes_por_semana, valor_centavos) values ('Entrega · 3 pães', 'entrega', 3, 15000), ('Entrega · 1 pão solidário', 'entrega', 1, 4000);
select 'planos', count(*) from planos;

-- regras de retirada
insert into clientes (id, nome) values ('11111111-1111-1111-1111-1111111111a4', 'Teste');
select set_config('t.padaria', (select id::text from pontos_coleta where tipo = 'padaria'), false);
select set_config('t.ponto',   (select id::text from pontos_coleta where tipo = 'ponto' limit 1), false);
select set_config('t.pp', (select id::text from planos where modalidade = 'coleta_padaria' limit 1), false);
select set_config('t.pc', (select id::text from planos where modalidade = 'coleta_ponto' limit 1), false);
select set_config('t.pe', (select id::text from planos where modalidade = 'entrega' limit 1), false);

insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, ponto_coleta_id) values ('11111111-1111-1111-1111-1111111111a4', current_setting('t.pp')::uuid, 6000, 10, current_setting('t.padaria')::uuid);
do $$ begin begin insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, ponto_coleta_id) values ('11111111-1111-1111-1111-1111111111a4', current_setting('t.pp')::uuid, 6000, 10, current_setting('t.ponto')::uuid); raise exception 'deveria negar'; exception when others then if sqlerrm = 'deveria negar' then raise; end if; raise notice 'padaria com ponto: negado (%)', sqlerrm; end; end $$;
do $$ begin begin insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, ponto_coleta_id) values ('11111111-1111-1111-1111-1111111111a4', current_setting('t.pc')::uuid, 7500, 10, current_setting('t.padaria')::uuid); raise exception 'deveria negar'; exception when others then if sqlerrm = 'deveria negar' then raise; end if; raise notice 'ponto com padaria: negado (%)', sqlerrm; end; end $$;
do $$ begin begin insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento) values ('11111111-1111-1111-1111-1111111111a4', current_setting('t.pc')::uuid, 7500, 10); raise exception 'deveria negar'; exception when others then if sqlerrm = 'deveria negar' then raise; end if; raise notice 'ponto sem ponto: negado'; end; end $$;
insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, ponto_coleta_id) values ('11111111-1111-1111-1111-1111111111a4', current_setting('t.pc')::uuid, 7500, 10, current_setting('t.ponto')::uuid);
insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, ponto_coleta_id) values ('11111111-1111-1111-1111-1111111111a4', current_setting('t.pe')::uuid, 8000, 10, current_setting('t.ponto')::uuid);
select 'entrega descarta o ponto', count(*) from assinaturas where ponto_coleta_id is null;
select 'pontos com horário', count(*) from pontos_coleta where jsonb_array_length(horarios) > 0;
select 'ok4';
