# Configuração do Supabase

1. Crie um projeto no Supabase.
2. Em **Authentication → Providers → Anonymous**, habilite acessos anônimos.
3. Aplique, em ordem, os arquivos de `migrations/` usando a CLI do Supabase ou o editor SQL.
4. Em **Realtime Settings**, desabilite canais públicos. A aplicação usa apenas canais privados.
5. Copie a URL e a chave publicável do projeto para um arquivo `.env` baseado em `.env.example`.

## Limpeza periódica

A função `private.limpar_dados_expirados()` remove salas expiradas e identidades anônimas antigas. Ela não fica exposta pela API. Agende sua execução diária pelo recurso Cron do Supabase ou por uma rotina administrativa equivalente.

Exemplo para um projeto com `pg_cron` habilitado:

```sql
select cron.schedule(
  'freepoker-limpeza-diaria',
  '15 3 * * *',
  'select private.limpar_dados_expirados()'
);
```

## Segurança

As tabelas não oferecem acesso direto a `anon` ou `authenticated`. Todas as mutações passam por funções transacionais com `auth.uid()`, validação explícita e `search_path` vazio. Os eventos Realtime nunca incluem o valor secreto de um voto; os votos completos só são retornados por `obter_estado_sala` depois da revelação.
