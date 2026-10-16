# Amada Massa — gestão do Clube do Pão

Sistema interno (Next.js + TypeScript + Tailwind) hospedado na **Vercel**, com **Supabase** (PostgreSQL + Auth) e código no **GitHub**, tudo em planos gratuitos. Especificação completa: seções 1–15 do documento do projeto.

## Estado atual: Fase 1 (base / MVP)

Login (e-mail e senha, recuperação, sem cadastro público), perfis (admin, operação, entregador) com RLS, clientes com status e linha do tempo, registro de contatos com próximo passo, planos editáveis (seed dos 6 planos), assinaturas (troca de plano preserva histórico), pontos de coleta (seed dos 3), auditoria por trigger, exportação/exclusão LGPD por cliente (admin).

Próximas fases: 2 dinheiro (cobranças e baixas) · 3 rotas · 4 semana · 5 entregas · 6 comunicação e painel.

## Configuração

1. **Supabase** (região São Paulo): crie o projeto e rode `supabase/migrations/0001_base.sql` no SQL Editor.
   Em *Authentication → Providers → Email* desligue "Allow new users to sign up".
   Em *Authentication → URL Configuration* defina Site URL e adicione `https://SEU-APP/auth/callback` em Redirect URLs.
2. **Primeiro administrador**: em *Authentication → Users → Add user* crie sua conta e depois, no SQL Editor:
   ```sql
   update usuarios set perfil = 'admin' where id = (select id from auth.users where email = 'voce@exemplo.com');
   ```
   As demais contas são criadas da mesma forma (perfil padrão `entregador`; ajuste em `usuarios.perfil`).
3. **Local**: `cp .env.example .env.local`, preencha as chaves (Settings → API) e rode `npm install && npm run dev`.
4. **Vercel**: importe o repositório do GitHub e defina as 3 variáveis de `.env.example`. Deploy automático a cada commit.

## Observações

- Valores em centavos inteiros; datas dd/mm/aaaa; fuso America/Sao_Paulo.
- Pausa registrada no próprio cliente (`pausa_retorno_previsto`); a tabela `pausas` por assinatura fica para quando houver pausas pontuais (Fase 4).
- Termos do plano Hobby da Vercel (uso não comercial) e backup semanal via GitHub Actions: ver seção 13/15 da especificação.
