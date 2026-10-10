-- IF-04 cross-domain ledger RPC security regressions. Run only against isolated IF-02 test DB.
begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';
do $$
declare v_record public.intelligence_records; v_raised boolean := false;
begin
  select * into v_record from public.create_cross_domain_intelligence_record(
    null, 'IF-04 valid cross-domain record',
    '{"schemaVersion":1,"crossDomain":true,"domains":["finance","marketing"],"evidence":[{"id":"e1","kind":"verified_fact","statement":"Revenue source value","sourceRef":"report:finance","confidence":0.9},{"id":"e2","kind":"verified_fact","statement":"Spend source value","sourceRef":"campaign:marketing","confidence":0.9}],"findings":[{"id":"f1","statement":"Compare values over aligned period","evidenceIds":["e1","e2"]}],"recommendations":[{"id":"r1","statement":"Review channel efficiency","evidenceIds":["e1","e2"],"requiresApproval":true}]}'::jsonb
  );
  if v_record.id is null or v_record.domain_key is not null or v_record.record_type <> 'analysis' then raise exception 'IF-04 TEST FAILED (1): valid cross-domain record was not persisted as a canonical non-single-domain analysis'; end if;
  begin
    perform public.create_cross_domain_intelligence_record(null, 'Unapproved recommendation',
      '{"schemaVersion":1,"crossDomain":true,"domains":["finance","marketing"],"evidence":[{"id":"e1","kind":"verified_fact","statement":"Revenue","sourceRef":"report:finance","confidence":0.9}],"findings":[],"recommendations":[{"id":"r1","statement":"Change prices","evidenceIds":["e1"],"requiresApproval":false}]}'::jsonb);
  exception when others then v_raised := true; end;
  if not v_raised then raise exception 'IF-04 TEST FAILED (2): recommendation without approval was accepted'; end if;
  v_raised := false;
  begin
    perform public.create_cross_domain_intelligence_record(null, 'Finding without evidence citations',
      '{"schemaVersion":1,"crossDomain":true,"domains":["finance","marketing"],"evidence":[{"id":"e1","kind":"verified_fact","statement":"Revenue","sourceRef":"report:finance","confidence":0.9}],"findings":[{"id":"f1","statement":"Unsupported finding","evidenceIds":[]}],"recommendations":[]}'::jsonb);
  exception when others then v_raised := true; end;
  if not v_raised then raise exception 'IF-04 TEST FAILED (3): finding with empty evidence citations was accepted'; end if;
  v_raised := false;
  begin
    perform public.create_cross_domain_intelligence_record(null, 'Recommendation without evidence citations',
      '{"schemaVersion":1,"crossDomain":true,"domains":["finance","marketing"],"evidence":[{"id":"e1","kind":"verified_fact","statement":"Revenue","sourceRef":"report:finance","confidence":0.9}],"findings":[],"recommendations":[{"id":"r1","statement":"Unsupported recommendation","evidenceIds":[],"requiresApproval":true}]}'::jsonb);
  exception when others then v_raised := true; end;
  if not v_raised then raise exception 'IF-04 TEST FAILED (4): recommendation with empty evidence citations was accepted'; end if;
end;
$;
rollback;

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
do $$
declare v_raised boolean := false;
begin
  begin
    perform public.create_cross_domain_intelligence_record(null, 'Unentitled cross-domain write',
      '{"schemaVersion":1,"crossDomain":true,"domains":["finance","marketing"],"evidence":[],"findings":[],"recommendations":[]}'::jsonb);
  exception when others then v_raised := true; end;
  if not v_raised then raise exception 'IF-04 TEST FAILED (3): unentitled user created cross-domain record'; end if;
end;
$$;
rollback;