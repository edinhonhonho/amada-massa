# Backup e restauração

O workflow `.github/workflows/backup.yml` gera `public.dump` (dados do sistema) e `auth.dump`
(contas de login) toda segunda e quinta, guardados por 90 dias em *Actions → Artifacts*.

**Configuração:** em *Settings → Secrets and variables → Actions* crie `SUPABASE_DB_URL` com a string
de conexão **Session pooler** do Supabase (Project Settings → Database). O repositório deve ser privado.

**Teste de restauração (faça uma vez e repita a cada poucos meses):**
1. Crie um projeto Supabase de teste e rode `supabase/migrations/*.sql` em ordem.
2. Baixe o artifact, e rode:
   ```bash
   pg_restore --no-owner --data-only --disable-triggers -d "$URL_TESTE" auth.dump
   pg_restore --no-owner --data-only --disable-triggers -d "$URL_TESTE" public.dump
   ```
3. Entre no app apontando para o projeto de teste e confira clientes, cobranças e entregas.
