create or replace function private.pode_acessar_topico(p_topico text, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participantes p
    join public.salas s on s.id = p.sala_id
    where p.usuario_id = p_usuario
      and p.ativo
      and s.estado <> 'encerrado'
      and s.expira_em > now()
      and p_topico = 'sala:' || s.id::text
  );
$$;

grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.pode_acessar_topico(text, uuid) to authenticated;

-- O Supabase já mantém RLS habilitado em realtime.messages. O schema
-- realtime é administrado pelo serviço e não permite ALTER TABLE.

drop policy if exists "participantes recebem eventos da sala" on realtime.messages;
create policy "participantes recebem eventos da sala"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.pode_acessar_topico(realtime.topic(), (select auth.uid()))
);
