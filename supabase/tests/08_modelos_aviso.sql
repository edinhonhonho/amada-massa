\set ON_ERROR_STOP 1
insert into auth.users (id,email,raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a8','adm8@x','{"perfil":"admin"}'),
  ('00000000-0000-0000-0000-0000000000b8','membro8@x','{"membro":true}');
insert into usuarios (id, nome, perfil) values ('00000000-0000-0000-0000-0000000000a8','Adm8','admin') on conflict (id) do nothing;
select 'modelos de partida', (select count(*) from modelos_aviso) = 5;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000a8';
insert into modelos_aviso (nome, titulo, corpo) values ('Meu modelo', 'Oi {nome}', 'Texto');
update modelos_aviso set corpo = 'Editado' where nome = 'Meu modelo';
select 'equipe cria, edita e apaga', (select corpo from modelos_aviso where nome = 'Meu modelo') = 'Editado';
delete from modelos_aviso where nome = 'Meu modelo';
set request.uid = '00000000-0000-0000-0000-0000000000b8';
select 'membro não vê nem altera modelos', (select count(*) from modelos_aviso) = 0;
select 'ok8';
