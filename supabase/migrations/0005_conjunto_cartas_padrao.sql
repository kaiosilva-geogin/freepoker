-- Adiciona o conjunto Padrão sem invalidar salas existentes.

alter table public.salas
  drop constraint if exists salas_conjunto_valido;

alter table public.salas
  add constraint salas_conjunto_valido check (
    conjunto_cartas in ('padrao', 'fibonacci', 'fibonacci_estendida', 'sequencial')
  );

create or replace function private.carta_permitida(conjunto text, carta text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case conjunto
    when 'padrao' then carta = any (array['cafe','2','4','8','13','18','21','28','34','44','56','70','86','100'])
    when 'fibonacci' then carta = any (array['0','1','2','3','5','8','13','21','?','cafe'])
    when 'fibonacci_estendida' then carta = any (array['0','1','2','3','5','8','13','20','40','100','?','cafe'])
    when 'sequencial' then carta = any (array['1','2','3','4','5','6','7','8','9','10','?','cafe'])
    else false
  end;
$$;

create or replace function public.criar_sala(
  p_nome_criador text,
  p_nome_sala text,
  p_conjunto_cartas text
)
returns table (codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  nova_sala public.salas%rowtype;
  tentativa integer;
begin
  p_nome_criador := btrim(p_nome_criador);
  p_nome_sala := btrim(p_nome_sala);

  if char_length(p_nome_criador) not between 1 and 40 then
    raise exception 'nome_invalido';
  end if;
  if char_length(p_nome_sala) not between 1 and 80 then
    raise exception 'nome_sala_invalido';
  end if;
  if p_conjunto_cartas not in ('padrao', 'fibonacci', 'fibonacci_estendida', 'sequencial') then
    raise exception 'conjunto_invalido';
  end if;

  for tentativa in 1..8 loop
    begin
      insert into public.salas (codigo, nome, proprietario_id, conjunto_cartas)
      values (private.codigo_aleatorio(), p_nome_sala, usuario, p_conjunto_cartas)
      returning * into nova_sala;
      exit;
    exception when unique_violation then
      if tentativa = 8 then raise; end if;
    end;
  end loop;

  insert into public.participantes (sala_id, usuario_id, nome)
  values (nova_sala.id, usuario, p_nome_criador);

  return query select nova_sala.codigo::text;
end;
$$;

revoke all on function public.criar_sala(text, text, text) from public;
grant execute on function public.criar_sala(text, text, text) to authenticated;
