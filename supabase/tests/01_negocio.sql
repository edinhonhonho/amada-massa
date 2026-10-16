\set ON_ERROR_STOP 1
insert into auth.users (id,email,raw_app_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','adm@x','{"perfil":"admin"}'),
 ('00000000-0000-0000-0000-00000000000e','ent@x','{}'),
 ('00000000-0000-0000-0000-00000000000f','ent2@x','{}');
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
insert into clientes (id,nome,whatsapp,bairro) values ('11111111-1111-1111-1111-111111111111','Ana','51999990000','Bom Fim'),('22222222-2222-2222-2222-222222222222','Beto','51988880000','Centro');
insert into rotas (id,nome,entregador_id) values ('aaaaaaaa-0000-0000-0000-000000000001','Rota A','00000000-0000-0000-0000-00000000000e');
insert into atribuicoes_rota (cliente_id,rota_id,ordem) select id,'aaaaaaaa-0000-0000-0000-000000000001',1 from clientes where nome='Ana';
insert into atribuicoes_rota (cliente_id,rota_id,ordem) select id,'aaaaaaaa-0000-0000-0000-000000000001',2 from clientes where nome='Beto';
-- 2a atribuição ativa do mesmo cliente deve falhar:
do $$ begin
  begin insert into atribuicoes_rota (cliente_id,rota_id) select id,'aaaaaaaa-0000-0000-0000-000000000001' from clientes where nome='Ana'; raise exception 'deveria falhar';
  exception when unique_violation then null; end; end $$;
insert into assinaturas (cliente_id,plano_id,valor_centavos,dia_vencimento,inicio)
  select c.id,(select id from planos where modalidade='entrega' and paes_por_semana=1),8000,10,'2026-09-01' from clientes c;
select 'cobrancas geradas set', gerar_cobrancas('2026-09-15');
select 'idempotente', gerar_cobrancas('2026-09-15');
select c.vencimento, c.valor_centavos, c.status from cobrancas c limit 1;
-- Ana paga, Beto não
update cobrancas set status='paga' where assinatura_id=(select a.id from assinaturas a join clientes c on c.id=a.cliente_id where c.nome='Ana');
insert into semanas (inicio,fim,sabor) values (hoje_br(), hoje_br()+6, 'Centeio');
select 'entregas', gerar_entregas((select id from semanas));
select c.nome, e.status from entregas e join clientes c on c.id=e.cliente_id order by c.nome;
-- baixa de Beto -> volta
update cobrancas set status='paga';
select reavaliar_entregas();
select c.nome, e.status from entregas e join clientes c on c.id=e.cliente_id order by c.nome;
select set_config('t.eid',(select id::text from entregas order by ordem limit 1),false);
-- entregador
set request.uid = '00000000-0000-0000-0000-00000000000e';
select 'entregador vê clientes?', count(*) from clientes;
select 'entregador vê cobrancas?', count(*) from cobrancas;
select nome, telefone, qtd, status from entregas_da_rota((select id from semanas),'aaaaaaaa-0000-0000-0000-000000000001');
select marcar_entrega(current_setting('t.eid')::uuid,'entregue');
set request.uid = '00000000-0000-0000-0000-00000000000a';
select status, qtd_entregue from entregas order by status limit 2;
set request.uid = '00000000-0000-0000-0000-00000000000f';
-- outro entregador sem rota
set request.uid = '00000000-0000-0000-0000-00000000000f';
select 'outro entregador', count(*) from entregas_da_rota((select id from semanas),'aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin begin perform marcar_entrega(current_setting('t.eid')::uuid,'entregue'); raise exception 'deveria negar'; exception when others then if sqlerrm='deveria negar' then raise; end if; end; end $$;
select 'ok';
