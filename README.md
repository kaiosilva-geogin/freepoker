# FreePoker

Planning Poker em tempo real, sem cadastro. O projeto usa Astro, Supabase Auth anônimo, PostgreSQL, Supabase Realtime e o runtime da Cloudflare.

## Desenvolvimento local

Requisitos: Node.js 22 ou mais recente e npm.

```bash
npm install
copy .env.example .env
npm run dev
```

Preencha no `.env`:

```text
PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Consulte [`supabase/README.md`](supabase/README.md) para habilitar autenticação anônima, aplicar as migrations e configurar o Realtime privado.

## Validação

```bash
npm run validate
```

Esse comando executa os testes, a verificação de tipos do Astro e o build de produção.

## Publicação na Cloudflare

O adaptador atual do Astro gera um Worker com os arquivos estáticos associados. Primeiro gere e simule o pacote:

```bash
npm run build
npm run deploy:dry
```

Depois de autenticar o Wrangler, publique com:

```bash
npm run deploy
```

Cadastre `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de build da Cloudflare. Esses valores são chaves públicas protegidas pelas políticas e funções do banco; nenhuma chave administrativa é utilizada pela aplicação.

## Estrutura

- `src/pages/index.astro`: página institucional, criação e entrada.
- `src/pages/sala/[codigo].astro`: sala de votação.
- `src/pages/api`: endpoints executados na Cloudflare.
- `src/scripts`: comportamento do navegador e Realtime.
- `supabase/migrations`: tabelas, funções transacionais, RLS e autorização Realtime.
