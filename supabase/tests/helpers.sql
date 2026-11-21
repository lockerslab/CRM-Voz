-- Ayudas para escribir pruebas legibles. Cada una imprime "OK" o "FAIL".
\set QUIET on
\o /dev/null
create function pg_temp.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'OK   %', label; else raise notice 'FAIL %', label; end if;
end $$;
create function pg_temp.eq(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is not distinct from want then raise notice 'OK   % (= %)', label, got;
  else raise notice 'FAIL % (obtuve %, esperaba %)', label, got, want; end if;
end $$;
create function pg_temp.n(q text) returns bigint language plpgsql as $$
declare r bigint; begin execute q into r; return r; end $$;
create function pg_temp.rows(stmt text) returns int language plpgsql as $$
declare c int; begin execute stmt; get diagnostics c = row_count; return c; end $$;
-- La sentencia DEBE ser rechazada con un error.
create function pg_temp.denied(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    raise notice 'FAIL % (se permitió y no debía)', label;
  exception when others then
    raise notice 'OK   % [%]', label, left(sqlerrm, 70);
  end;
end $$;
-- La sentencia DEBE ser aceptada.
create function pg_temp.allowed(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    raise notice 'OK   %', label;
  exception when others then
    raise notice 'FAIL % (se rechazó: %)', label, left(sqlerrm, 80);
  end;
end $$;
