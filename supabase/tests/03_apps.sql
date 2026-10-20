\set ON_ERROR_STOP 1
-- Roda depois de 01 e 02 (usa os mesmos dados). Conta de membro vinculada à Ana.
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000c1','ana@x','{"membro":true}');
select 'membro fora de usuarios?', count(*) = 0 from usuarios where id = '00000000-0000-0000-0000-0000000000c1';
insert into membros (user_id, cliente_id) select '00000000-0000-0000-0000-0000000000c1', id from clientes where nome='Ana';
insert into notificacoes (cliente_id,tipo,titulo,corpo,ref) select id,'entregue','t','c','e1' from clientes;
insert into notificacoes (cliente_id,tipo,titulo,corpo,ref) select id,'entregue','t','c','e1' from clientes on conflict do nothing;
select 'dedupe', count(*) from notificacoes;

select set_config('t.cbeto',(select id::text from clientes where nome='Beto'),false);
-- membro: vê só as próprias notificações, nada de clientes/cobranças/rotas
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
select 'membro vê notificações', count(*) from notificacoes;
select 'membro vê clientes/cobranças/rotas/semanas', (select count(*) from clientes) + (select count(*) from cobrancas) + (select count(*) from rotas) + (select count(*) from semanas);
update notificacoes set lida_em = now();
do $$ begin begin update notificacoes set titulo = 'hack'; raise exception 'deveria negar'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into push_inscricoes (user_id,cliente_id,endpoint,p256dh,auth) values ('00000000-0000-0000-0000-0000000000c1', current_setting('t.cbeto')::uuid, 'https://x', 'a', 'b'); raise exception 'deveria negar'; exception when others then if sqlerrm = 'deveria negar' then raise; end if; end; end $$;
insert into push_inscricoes (user_id,cliente_id,endpoint,p256dh,auth) values ('00000000-0000-0000-0000-0000000000c1', meu_cliente_id(), 'https://ok', 'a', 'b');
select 'membro vê inscrição', count(*) from push_inscricoes;

-- entregador da Rota A: inicia rota, marca com foto
set request.uid = '00000000-0000-0000-0000-00000000000e';
select 'primeira vez', iniciar_rota((select id from semanas), 'aaaaaaaa-0000-0000-0000-000000000001');
select 'segunda vez', iniciar_rota((select id from semanas), 'aaaaaaaa-0000-0000-0000-000000000001');
select 'execução', iniciada_em is not null from execucao_da_rota((select id from semanas), 'aaaaaaaa-0000-0000-0000-000000000001');
set request.uid = '00000000-0000-0000-0000-00000000000a';
select set_config('t.beto', (select e.id::text from entregas e join clientes c on c.id=e.cliente_id where c.nome='Beto'), false);
set request.uid = '00000000-0000-0000-0000-00000000000e';
select marcar_entrega(current_setting('t.beto')::uuid, 'nao_entregue', 'Cliente ausente', 'Toquei 2x', now(), current_setting('t.beto') || '/f.jpg');
do $$ begin begin perform marcar_entrega(current_setting('t.beto')::uuid, 'entregue', null, null, now(), '00000000-0000-0000-0000-000000000000/f.jpg'); raise exception 'deveria negar'; exception when others then if sqlerrm = 'deveria negar' then raise; end if; end; end $$;
select ocorrencia, observacao, foto_path is not null as foto from entregas where id = current_setting('t.beto')::uuid;
-- storage: entregador envia foto da própria rota, não da alheia, e não lê
insert into storage.objects (bucket_id, name) values ('entregas-fotos', current_setting('t.beto') || '/f.jpg');
do $$ begin begin insert into storage.objects (bucket_id, name) values ('entregas-fotos', '00000000-0000-0000-0000-000000000000/x.jpg'); raise exception 'deveria negar'; exception when insufficient_privilege or others then if sqlerrm = 'deveria negar' then raise; end if; end; end $$;
select 'entregador lê fotos?', count(*) from storage.objects;
set request.uid = '00000000-0000-0000-0000-00000000000a';
select 'admin lê fotos', count(*) from storage.objects;
select 'ok3';
