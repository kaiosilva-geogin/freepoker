create or replace function private.limpar_dados_expirados()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  salas_removidas integer;
  usuarios_removidos integer;
begin
  with removidas as (
    delete from public.salas
    where expira_em < now()
       or (atualizado_em < now() - interval '24 hours')
    returning 1
  )
  select count(*) into salas_removidas from removidas;

  with removidos as (
    delete from auth.users u
    where u.is_anonymous is true
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from public.salas s where s.proprietario_id = u.id)
      and not exists (select 1 from public.participantes p where p.usuario_id = u.id)
    returning 1
  )
  select count(*) into usuarios_removidos from removidos;

  return jsonb_build_object(
    'salas_removidas', salas_removidas,
    'usuarios_removidos', usuarios_removidos
  );
end;
$$;

revoke all on function private.limpar_dados_expirados() from public, anon, authenticated;
