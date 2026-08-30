create or replace function private.codigo_aleatorio()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  resultado text := '';
  indice integer;
begin
  for indice in 1..6 loop
    resultado := resultado || substr(alfabeto, 1 + floor(random() * length(alfabeto))::integer, 1);
  end loop;
  return resultado;
end;
$$;

create or replace function private.exigir_usuario()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
begin
  if usuario is null then
    raise exception 'sessao_invalida';
  end if;
  return usuario;
end;
$$;

create or replace function private.carta_permitida(conjunto text, carta text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case conjunto
    when 'fibonacci' then carta = any (array['0','1','2','3','5','8','13','21','?','cafe'])
    when 'fibonacci_estendida' then carta = any (array['0','1','2','3','5','8','13','20','40','100','?','cafe'])
    when 'sequencial' then carta = any (array['1','2','3','4','5','6','7','8','9','10','?','cafe'])
    else false
  end;
$$;

create or replace function private.notificar_sala(
  sala_id uuid,
  evento text,
  dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    dados,
    evento,
    'sala:' || sala_id::text,
    true
  );
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
  if p_conjunto_cartas not in ('fibonacci', 'fibonacci_estendida', 'sequencial') then
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

create or replace function public.obter_sala_publica(p_codigo text)
returns table (codigo text, nome text, estado public.estado_sala)
language sql
security definer
set search_path = ''
as $$
  select s.codigo::text, s.nome::text, s.estado
  from public.salas s
  where s.codigo = upper(btrim(p_codigo))
    and s.estado <> 'encerrado'
    and s.expira_em > now()
  limit 1;
$$;

create or replace function public.entrar_sala(p_codigo text, p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala public.salas%rowtype;
  participante public.participantes%rowtype;
begin
  p_nome := btrim(p_nome);
  if char_length(p_nome) not between 1 and 40 then
    raise exception 'nome_invalido';
  end if;

  select * into sala
  from public.salas
  where codigo = upper(btrim(p_codigo))
    and estado <> 'encerrado'
    and expira_em > now()
  for update;

  if sala.id is null then raise exception 'sala_nao_encontrada'; end if;

  select * into participante
  from public.participantes
  where sala_id = sala.id and usuario_id = usuario;

  if participante.id is not null and not participante.ativo then
    raise exception 'participante_removido';
  end if;

  if participante.id is null then
    if (select count(*) from public.participantes where sala_id = sala.id and ativo) >= 50 then
      raise exception 'limite_sala';
    end if;

    insert into public.participantes (sala_id, usuario_id, nome)
    values (sala.id, usuario, p_nome)
    returning * into participante;
  else
    update public.participantes
    set nome = p_nome, ultima_atividade_em = now()
    where id = participante.id
    returning * into participante;
  end if;

  perform private.notificar_sala(sala.id, 'participantes_atualizados', jsonb_build_object('tipo', 'entrada'));
  return jsonb_build_object('participante_id', participante.id);
end;
$$;

create or replace function public.obter_estado_sala(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala public.salas%rowtype;
  participante public.participantes%rowtype;
  lista_participantes jsonb := '[]'::jsonb;
  lista_votos jsonb := '[]'::jsonb;
begin
  select * into sala
  from public.salas
  where codigo = upper(btrim(p_codigo))
    and estado <> 'encerrado'
    and expira_em > now();

  if sala.id is null then raise exception 'sala_nao_encontrada'; end if;

  select * into participante
  from public.participantes
  where sala_id = sala.id and usuario_id = usuario;

  if participante.id is not null and not participante.ativo then
    raise exception 'participante_removido';
  end if;

  if participante.id is not null then
    update public.participantes
    set ultima_atividade_em = now()
    where id = participante.id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'votou', p.votou,
      'proprietario', p.usuario_id = sala.proprietario_id,
      'ultima_atividade_em', p.ultima_atividade_em
    ) order by (p.usuario_id = sala.proprietario_id) desc, p.entrou_em), '[]'::jsonb)
    into lista_participantes
    from public.participantes p
    where p.sala_id = sala.id and p.ativo;

    if sala.estado = 'revelado' then
      select coalesce(jsonb_agg(jsonb_build_object(
        'participante_id', v.participante_id,
        'valor', v.valor
      )), '[]'::jsonb)
      into lista_votos
      from public.votos v
      join public.participantes p on p.id = v.participante_id and p.ativo
      where v.sala_id = sala.id and v.numero_rodada = sala.numero_rodada;
    end if;
  end if;

  return jsonb_build_object(
    'sala', jsonb_build_object(
      'id', sala.id,
      'codigo', sala.codigo,
      'nome', sala.nome,
      'conjunto_cartas', sala.conjunto_cartas,
      'estado', sala.estado,
      'numero_rodada', sala.numero_rodada,
      'proprietario', sala.proprietario_id = usuario
    ),
    'participante_atual', case when participante.id is null then null else jsonb_build_object(
      'id', participante.id,
      'nome', participante.nome,
      'votou', participante.votou,
      'ativo', participante.ativo,
      'voto', (
        select v.valor
        from public.votos v
        where v.sala_id = sala.id
          and v.participante_id = participante.id
          and v.numero_rodada = sala.numero_rodada
        limit 1
      )
    ) end,
    'participantes', lista_participantes,
    'votos', lista_votos
  );
end;
$$;

create or replace function public.registrar_voto(p_codigo text, p_valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala public.salas%rowtype;
  participante public.participantes%rowtype;
begin
  select * into sala from public.salas
  where codigo = upper(btrim(p_codigo)) and expira_em > now()
  for update;

  if sala.id is null then raise exception 'sala_nao_encontrada'; end if;
  if sala.estado <> 'votando' then raise exception 'votacao_encerrada'; end if;
  if not private.carta_permitida(sala.conjunto_cartas, p_valor) then raise exception 'carta_invalida'; end if;

  select * into participante from public.participantes
  where sala_id = sala.id and usuario_id = usuario and ativo;
  if participante.id is null then raise exception 'sem_permissao'; end if;

  insert into public.votos (sala_id, participante_id, numero_rodada, valor)
  values (sala.id, participante.id, sala.numero_rodada, p_valor)
  on conflict (sala_id, participante_id, numero_rodada)
  do update set valor = excluded.valor, atualizado_em = now();

  update public.participantes
  set votou = true, ultima_atividade_em = now()
  where id = participante.id;

  perform private.notificar_sala(sala.id, 'votacao_atualizada', jsonb_build_object(
    'participante_id', participante.id,
    'votou', true
  ));
end;
$$;

create or replace function public.revelar_votos(p_codigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala_id uuid;
begin
  update public.salas
  set estado = 'revelado', atualizado_em = now()
  where codigo = upper(btrim(p_codigo))
    and proprietario_id = usuario
    and estado = 'votando'
    and expira_em > now()
  returning id into sala_id;

  if sala_id is null then raise exception 'sem_permissao'; end if;
  perform private.notificar_sala(sala_id, 'sala_atualizada', jsonb_build_object('estado', 'revelado'));
end;
$$;

create or replace function public.iniciar_nova_votacao(p_codigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala public.salas%rowtype;
begin
  update public.salas
  set estado = 'votando', numero_rodada = numero_rodada + 1, atualizado_em = now()
  where codigo = upper(btrim(p_codigo))
    and proprietario_id = usuario
    and estado = 'revelado'
    and expira_em > now()
  returning * into sala;

  if sala.id is null then raise exception 'sem_permissao'; end if;

  update public.participantes set votou = false where sala_id = sala.id and ativo;
  delete from public.votos where sala_id = sala.id;
  perform private.notificar_sala(sala.id, 'sala_atualizada', jsonb_build_object(
    'estado', 'votando',
    'numero_rodada', sala.numero_rodada
  ));
end;
$$;

create or replace function public.remover_participante(p_codigo text, p_participante_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala public.salas%rowtype;
  removido_id uuid;
begin
  select * into sala from public.salas
  where codigo = upper(btrim(p_codigo)) and proprietario_id = usuario and expira_em > now();
  if sala.id is null then raise exception 'sem_permissao'; end if;

  update public.participantes
  set ativo = false, votou = false, removido_em = now(), ultima_atividade_em = now()
  where id = p_participante_id
    and sala_id = sala.id
    and usuario_id <> sala.proprietario_id
    and ativo
  returning id into removido_id;

  if removido_id is null then raise exception 'participante_nao_encontrado'; end if;
  delete from public.votos where sala_id = sala.id and participante_id = removido_id;
  perform private.notificar_sala(sala.id, 'participantes_atualizados', jsonb_build_object(
    'tipo', 'remocao',
    'participante_id', removido_id
  ));
end;
$$;

create or replace function public.sair_sala(p_codigo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := private.exigir_usuario();
  sala public.salas%rowtype;
  participante_id uuid;
begin
  select * into sala from public.salas
  where codigo = upper(btrim(p_codigo)) and expira_em > now();
  if sala.id is null then raise exception 'sala_nao_encontrada'; end if;
  if sala.proprietario_id = usuario then raise exception 'sem_permissao'; end if;

  update public.participantes
  set ativo = false, votou = false, removido_em = now(), ultima_atividade_em = now()
  where sala_id = sala.id and usuario_id = usuario and ativo
  returning id into participante_id;

  if participante_id is null then raise exception 'participante_nao_encontrado'; end if;
  delete from public.votos where sala_id = sala.id and participante_id = participante_id;
  perform private.notificar_sala(sala.id, 'participantes_atualizados', jsonb_build_object('tipo', 'saida'));
end;
$$;

revoke execute on function public.criar_sala(text, text, text) from public, anon, authenticated;
revoke execute on function public.obter_sala_publica(text) from public, anon, authenticated;
revoke execute on function public.entrar_sala(text, text) from public, anon, authenticated;
revoke execute on function public.obter_estado_sala(text) from public, anon, authenticated;
revoke execute on function public.registrar_voto(text, text) from public, anon, authenticated;
revoke execute on function public.revelar_votos(text) from public, anon, authenticated;
revoke execute on function public.iniciar_nova_votacao(text) from public, anon, authenticated;
revoke execute on function public.remover_participante(text, uuid) from public, anon, authenticated;
revoke execute on function public.sair_sala(text) from public, anon, authenticated;
grant execute on function public.criar_sala(text, text, text) to authenticated;
grant execute on function public.obter_sala_publica(text) to authenticated;
grant execute on function public.entrar_sala(text, text) to authenticated;
grant execute on function public.obter_estado_sala(text) to authenticated;
grant execute on function public.registrar_voto(text, text) to authenticated;
grant execute on function public.revelar_votos(text) to authenticated;
grant execute on function public.iniciar_nova_votacao(text) to authenticated;
grant execute on function public.remover_participante(text, uuid) to authenticated;
grant execute on function public.sair_sala(text) to authenticated;
