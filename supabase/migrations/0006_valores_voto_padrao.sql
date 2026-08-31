-- Mantém a validação física dos votos alinhada aos conjuntos de cartas.

alter table public.votos
  drop constraint if exists votos_valor_valido;

alter table public.votos
  add constraint votos_valor_valido check (
    valor in (
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '13', '18', '20', '21', '28', '34', '40', '44', '56', '70',
      '86', '100', '?', 'cafe'
    )
  );
