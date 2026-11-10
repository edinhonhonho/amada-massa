# Amada Massa — gestão do Clube do Pão

Sistema interno (Next.js + TypeScript + Tailwind) hospedado na **Vercel**, com **Supabase** (PostgreSQL + Auth) e código no **GitHub**, tudo em planos gratuitos. Especificação completa: seções 1–15 do documento do projeto.

## Estado atual: Fases 1 a 6

| Fase | O que há |
| --- | --- |
| 1 Base | Login, perfis com RLS, clientes (status, linha do tempo, contatos), planos, assinaturas, pontos de coleta, auditoria, LGPD |
| 2 Dinheiro | Cobrança mensal automática (mês atual e próximo), baixa parcial/total, ajuste/isenção com justificativa, estorno (admin), situação calculada (em dia, a vencer, vence hoje, atrasado, crítico), painel de pagamentos e grade clientes × meses |
| 3 Rotas | Editor com seleção de clientes, ordem sugerida e trajeto de bicicleta no mapa; atribuição com histórico (uma ativa por cliente); mapa e navegação pelo Google Maps no app do entregador |
| 4 Rotas e planejamento | **Rotas**: cada rota tem responsável, dia e os bairros que cobre; a cada semana, quem tem assinatura de entrega ativa nesses bairros entra na rota, e a ordem das paradas e o caminho de bicicleta são calculados sozinhos O cliente pode ter uma rota de preferência; sem ela vale o bairro. A casa do cliente é marcada no mapa no próprio cadastro (sai do endereço e pode ser arrastada); na semana, a rota localiza endereços que faltam, ordena as paradas e traça o caminho sozinha. **Pães**: catálogo em Cadastros; o tradicional é um pão como os outros. |
| 4b Planejamento | Calendário do ano; catálogo de pães reutilizáveis; em cada semana, clientes com assinatura ativa agrupados por rota, ponto de coleta e padaria, quantidade de cada pão por cliente, total a produzir por destino e PDF para conferência, pular cliente, semana sem produção, entregas geradas com suspensão por atraso (volta ao pagar), listas de produção, entrega e coleta para imprimir |
| 5 Entregas | App do entregador (PWA, fila offline, iniciar/finalizar rota, foto e observação por parada, sem dados financeiros), ocorrências, pendências, histórico com fotos |
| 6 Comunicação e relatórios | **Mensagens**: central de avisos pelo app Amada Massa (único canal): para todos, em atraso, com mensalidade em aberto ou uma rota, com `{nome}`, `{valor}`, `{vencimento}`, prévia no celular e histórico com quem leu; escolha de pessoas específicas, modelos editáveis, `{nome}` também no título, envio com barra de progresso; aviso individual na ficha do cliente e lembrete de cobrança em Pagamentos; 7 relatórios, CSV, configurações |

Também: backup automático do banco (`.github/workflows/backup.yml`, ver `docs/backup.md`).
App do membro com notificações push implementado. Ainda fora do escopo: mapa, conciliação de extrato, WhatsApp automático e formulário do Wix.

### Regras assumidas (decisões em aberto da especificação)
- Mês cheio no mês de início; vencimento = dia combinado (1–28), ou o dia do início se for posterior.
- Suspensão da entrega no dia seguinte ao vencimento; **carência configurável** em Configurações (padrão 0). Vale também para coleta.
- A entrega volta ao pagar, desde que a lista da semana não esteja fechada.
- Pausa/cancelamento cancelam cobranças ainda não vencidas; troca de plano substitui as cobranças pendentes do mês em diante.
- Sem multa nem juros.

## Desempenho

`vercel.json` fixa as funções em **São Paulo (gru1)**, perto do banco do Supabase (também em São Paulo). Sem isso a Vercel roda nos EUA e cada ida ao banco cruza o continente. O login é verificado localmente (`getClaims`) quando o projeto usa chaves de assinatura assimétricas (padrão em projetos novos do Supabase).

## Mapas e endereços (serviços gratuitos)

CEP: ViaCEP. Localização de endereços: Nominatim (OpenStreetMap), com limite de 1 consulta por segundo (o sistema respeita e guarda o resultado no cliente). Traçado de bicicleta: routing.openstreetmap.de. Mapa: Leaflet com tiles do OpenStreetMap. Todos são de uso gratuito e razoável; para volume alto, seria preciso um provedor próprio.

## Importar a planilha de assinaturas

`scripts/importar_planilha.py` lê a planilha "Controle de assinaturas" e gera um SQL de importação mais um relatório de conferência:

```bash
python3 scripts/importar_planilha.py caminho/da/planilha.xlsx importacao/
```

O SQL **apaga todos os clientes atuais** e importa clientes, assinaturas (modalidade, pães, tradicionais, valor), rotas e ordem das paradas, pontos de coleta, pagamentos de 2026 e as anotações da aba Alterações. Rode no SQL Editor depois de aplicar a migração 0006. A pasta `importacao/` não vai para o Git (tem dados pessoais).

## Atalhos de teclado (gestão)

`⌘K` ou `/` abre a busca e os comandos (clientes e telas). Cada tela tem um atalho de duas letras: a inicial do grupo e a inicial da página (`C` `M` = Comunicação > Mensagens, `F` `P` = Financeiro > Pagamentos, `E` `E` = Entregas > Esta semana). `?` mostra a lista.

## Os três apps

| App | Endereço | Quem usa |
| --- | --- | --- |
| Gestão | `/` | Administrador e operação, no computador |
| Entregador (PWA) | `/entregador` | Entregador, no celular: escolhe a rota, inicia, marca entregas com foto e observação, funciona sem sinal |
| Amada Massa (PWA do cliente) | `/membro` | Central de avisos: o cliente entra com o **e-mail e o telefone do cadastro** (sem código, sem SMTP), instala o app e recebe notificações (rota iniciou, você é o próximo, entregue, pão da semana e avisos da equipe) |

O membro só entra se o e-mail estiver na ficha do cliente (e o cliente não estiver cancelado).

## Configuração

1. **Supabase** (região São Paulo): rode no SQL Editor, em ordem, `supabase/migrations/0001_base.sql`, `0002_financeiro_rotas_semanas.sql`, `0003_apps_entregador_membro.sql`, `0004_planos_pontos_paes_mapa.sql`, `0005_catalogo_paes_quantidades.sql` `0006_apoio_e_paes_tradicionais.sql` (**sozinha**, antes de importar dados: adiciona a modalidade de apoio recorrente) `0007_central_de_avisos.sql` (histórico de avisos, freio de tentativas de login e resumo mensal de cobranças) `0008_modelos_de_aviso.sql` (modelos de aviso editáveis) `0009_rotas_por_bairro.sql` (rotas por bairro) e `0010_paes_sem_distincao.sql` (os pães da semana são divididos igualmente, sem distinção entre eles). Se aparecer o erro “Could not find the 'bairros' column of 'rotas'”, é porque a 0009 ainda não foi executada.
2. **Supabase → Authentication**:
   - *Sign In / Providers → Email*: deixe ligado; desligue **Allow new users to sign up**.
   - *URL Configuration*: Site URL = endereço do app; Redirect URLs = `https://SEU-APP/auth/callback` (e `http://localhost:3000/auth/callback`).
   - O app Amada Massa **não envia e-mail**: o cliente entra com e-mail + telefone cadastrados e o servidor confere os dois. São permitidas 5 tentativas erradas por e-mail e 25 por endereço a cada 15 minutos. Como é uma verificação simples (quem souber e-mail e telefone de um cliente entra como ele), o app mostra somente os avisos recebidos, sem dados cadastrais. O SMTP só é necessário para a equipe usar "Esqueci minha senha".
3. **Primeiro administrador**: *Authentication → Users → Add user* (marque Auto Confirm), depois no SQL Editor:
   ```sql
   update usuarios set perfil = 'admin' where id = (select id from auth.users where email = 'voce@exemplo.com');
   ```
   Demais contas da equipe: mesmo caminho; ajuste `perfil` (`operacao` ou `entregador`) e o `nome` (aparece nos avisos aos membros, ex.: "Seu entregador é Marcelo").
4. **Chaves de notificação**: rode `npm run vapid` e guarde as duas chaves. Sem elas os avisos ficam só dentro do app: a tela Mensagens mostra um alerta enquanto faltarem, e em Configurações há um gerador das chaves com botão de copiar. `VAPID_SUBJECT` é só um contato (`mailto:seu@email.com` ou o endereço do site).
5. **Vercel**: importe o repositório e defina as variáveis de `.env.example`: URL e chave pública do Supabase, `SUPABASE_SERVICE_ROLE_KEY` (secreta!), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Faça um redeploy depois de mudar variáveis.
6. **Local**: `cp .env.example .env.local`, preencha e rode `npm install && npm run dev`.
7. **Backup**: secret `SUPABASE_DB_URL` no GitHub (ver `docs/backup.md`).

## Observações

- Valores em centavos inteiros; datas dd/mm/aaaa; fuso America/Sao_Paulo.
- Pausa registrada no próprio cliente (`pausa_retorno_previsto`); pausas pontuais de uma semana usam `pulos_semana`.
- Rotas se ordenam por setas ↑↓ (funciona melhor no celular que arrastar e soltar).
- Comprovante de pagamento (anexo) não implementado; use o campo de observação.
- Testes: `npm test` (regras de situação, CSV, mensagens, PDF, geografia). Testes de banco: `supabase/tests/rodar.sh` (aplica as migrações e roda os testes num Postgres local com um stub do Supabase).
- Termos do plano Hobby da Vercel (uso não comercial) e backup semanal via GitHub Actions: ver seção 13/15 da especificação.
