-- Apply once in a new Supabase project. Browser clients may only write via the RPC.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'trainee' check (role in ('trainee','educator','administrator'))
);
create function public.create_training_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values (new.id) on conflict do nothing; return new; end $$;
create trigger training_profile_created after insert on auth.users for each row execute function public.create_training_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
create table public.educator_assignments (
  educator_id uuid references public.profiles(id) on delete cascade,
  trainee_id uuid references public.profiles(id) on delete cascade,
  primary key (educator_id, trainee_id)
);
create table public.scenario_tasks (
  scenario_id text not null, task_id text not null, title text not null,
  position integer not null, max_score integer not null check(max_score > 0), required boolean not null default true,
  primary key (scenario_id, task_id), unique(scenario_id, position)
);
insert into public.scenario_tasks(scenario_id, task_id, title, position, max_score) values
('ladder-inspection','inspect-area','Inspect the surrounding area',1,20),
('ladder-inspection','wear-equipment','Wear safety equipment',2,20),
('ladder-inspection','secure-ladder','Secure the ladder',3,20),
('ladder-inspection','inspect-rungs','Inspect ladder rungs',4,20),
('ladder-inspection','confirm-inspection','Confirm final inspection',5,20);
create table public.training_sessions (
  id uuid primary key, user_id uuid not null references public.profiles(id), scenario_id text not null,
  source text not null check(source in ('unity','demo')), status text not null check(status in ('in-progress','completed','exited')),
  revision integer not null check(revision > 0), score integer not null, duration_seconds double precision not null,
  payload jsonb not null, updated_at timestamptz not null default now()
);
create index training_sessions_user_date on public.training_sessions(user_id, updated_at desc);
create table public.task_results (
  session_id uuid references public.training_sessions(id) on delete cascade, task_id text not null,
  completed boolean not null, mistakes integer not null check(mistakes >= 0), score integer not null,
  primary key(session_id, task_id)
);
create table public.interaction_logs (
  session_id uuid references public.training_sessions(id) on delete cascade, event_id uuid not null,
  event_type text not null, occurred_at timestamptz not null, payload jsonb not null,
  primary key(session_id, event_id)
);
alter table public.profiles enable row level security;
alter table public.educator_assignments enable row level security;
alter table public.scenario_tasks enable row level security;
alter table public.training_sessions enable row level security;
alter table public.task_results enable row level security;
alter table public.interaction_logs enable row level security;
create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy assignments_read on public.educator_assignments for select to authenticated using (educator_id = (select auth.uid()));
create policy catalog_read on public.scenario_tasks for select to authenticated using (true);
create policy sessions_read on public.training_sessions for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.educator_assignments a where a.educator_id = (select auth.uid()) and a.trainee_id = user_id
  )
);
create policy tasks_read on public.task_results for select to authenticated using (exists(select 1 from public.training_sessions s where s.id = session_id));
create policy logs_read on public.interaction_logs for select to authenticated using (exists(select 1 from public.training_sessions s where s.id = session_id));
revoke all on public.profiles, public.educator_assignments, public.scenario_tasks, public.training_sessions, public.task_results, public.interaction_logs from anon, authenticated;
grant select on public.profiles, public.educator_assignments, public.scenario_tasks, public.training_sessions, public.task_results, public.interaction_logs to authenticated;

create function public.save_training_session(p_session jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); sid uuid; rev integer; previous public.training_sessions%rowtype;
  task record; supplied jsonb; normalized jsonb := '[]'; entry jsonb; doc jsonb;
  total integer := 0; completed_count integer := 0; mistakes integer := 0; points integer := 0;
  task_mistakes integer; done boolean; gap boolean := false; session_status text;
  elapsed double precision; task_count integer; log_count integer;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_session->>'userId' is distinct from uid::text then raise exception 'Owner mismatch'; end if;
  sid := (p_session->>'sessionId')::uuid; rev := (p_session->>'revision')::integer;
  if sid is null or rev is null or rev < 1 then raise exception 'Invalid session identity'; end if;
  if p_session->>'scenarioId' is distinct from 'ladder-inspection' then raise exception 'Unknown scenario'; end if;
  if p_session->>'source' is null or p_session->>'source' not in ('unity','demo') then raise exception 'Invalid source'; end if;
  if p_session->>'trainingMode' is null or p_session->>'trainingMode' not in ('desktop','vr') then raise exception 'Invalid training mode'; end if;
  session_status := p_session->>'status';
  if session_status is null or session_status not in ('in-progress','completed','exited') then raise exception 'Invalid status'; end if;
  elapsed := (p_session->>'durationSeconds')::double precision;
  if elapsed is null or not (elapsed >= 0 and elapsed <= 604800) then raise exception 'Invalid duration'; end if;
  if p_session->>'startTime' is null then raise exception 'Start time required'; end if;
  perform (p_session->>'startTime')::timestamptz;
  if session_status <> 'in-progress' then
    if p_session->>'endTime' is null then raise exception 'End time required'; end if;
    if (p_session->>'endTime')::timestamptz < (p_session->>'startTime')::timestamptz then raise exception 'Invalid end time'; end if;
  end if;
  -- Serializes a new ID as well as updates, preventing concurrent ownership changes.
  perform pg_advisory_xact_lock(hashtextextended(sid::text, 0));
  select * into previous from public.training_sessions where id = sid for update;
  if found then
    if previous.user_id <> uid then raise exception 'Owner mismatch'; end if;
    if previous.revision >= rev then return; end if;
    if previous.status <> 'in-progress' then raise exception 'Finalized session is immutable'; end if;
    if previous.source <> p_session->>'source' or previous.payload->>'startTime' <> p_session->>'startTime' then raise exception 'Session identity changed'; end if;
    if elapsed < previous.duration_seconds then raise exception 'Duration cannot go backwards'; end if;
  end if;
  if jsonb_typeof(p_session->'taskResults') is distinct from 'array' then raise exception 'Tasks required'; end if;
  select count(*) into task_count from public.scenario_tasks where scenario_id = p_session->>'scenarioId';
  if jsonb_array_length(p_session->'taskResults') <> task_count then raise exception 'Unexpected task count'; end if;
  for task in select * from public.scenario_tasks where scenario_id = p_session->>'scenarioId' order by position loop
    select value into supplied from jsonb_array_elements(p_session->'taskResults') where value->>'id' = task.task_id;
    if supplied is null then raise exception 'Missing task %', task.task_id; end if;
    if jsonb_typeof(supplied->'completed') is distinct from 'boolean' then raise exception 'Invalid completed flag'; end if;
    done := (supplied->>'completed')::boolean;
    task_mistakes := (supplied->>'mistakes')::integer;
    if task_mistakes is null or task_mistakes < 0 or task_mistakes > 10000 then raise exception 'Invalid mistakes'; end if;
    if exists(select 1 from public.task_results r where r.session_id = sid and r.task_id = task.task_id and ((r.completed and not done) or r.mistakes > task_mistakes)) then raise exception 'Task progress cannot go backwards'; end if;
    if done and gap then raise exception 'Tasks must be completed in order'; end if;
    if not done then gap := true; else completed_count := completed_count + 1; points := points + task.max_score; end if;
    mistakes := mistakes + task_mistakes; total := total + task.max_score;
    normalized := normalized || jsonb_build_array(supplied || jsonb_build_object('title',task.title,'required',task.required,'maxScore',task.max_score));
  end loop;
  if session_status = 'completed' and completed_count <> task_count then raise exception 'Required tasks incomplete'; end if;
  points := greatest(0, points - mistakes * 5);
  if jsonb_typeof(p_session->'interactionLogs') is distinct from 'array' then raise exception 'Logs required'; end if;
  log_count := jsonb_array_length(p_session->'interactionLogs');
  if log_count < 1 or log_count > 10000 then raise exception 'Invalid log count'; end if;
  doc := (p_session - 'runningSince') || jsonb_build_object('userId',uid,'finalScore',points,'maxPossibleScore',total,
    'completedTaskCount',completed_count,'totalTaskCount',task_count,'mistakeCount',mistakes,'taskResults',normalized,
    'passed',session_status = 'completed' and points >= 70,'scenarioName','Ladder Inspection');
  insert into public.training_sessions(id,user_id,scenario_id,source,status,revision,score,duration_seconds,payload)
  values(sid,uid,p_session->>'scenarioId',p_session->>'source',session_status,rev,points,elapsed,doc)
  on conflict(id) do update set status=excluded.status, revision=excluded.revision, score=excluded.score,
    duration_seconds=excluded.duration_seconds,payload=excluded.payload,updated_at=now();
  for entry in select value from jsonb_array_elements(normalized) loop
    insert into public.task_results(session_id,task_id,completed,mistakes,score)
    values(sid,entry->>'id',(entry->>'completed')::boolean,(entry->>'mistakes')::integer,
      case when (entry->>'completed')::boolean then (entry->>'maxScore')::integer else 0 end)
    on conflict(session_id,task_id) do update set completed=excluded.completed,mistakes=excluded.mistakes,score=excluded.score;
  end loop;
  for entry in select value from jsonb_array_elements(p_session->'interactionLogs') loop
    if entry->>'type' is null or entry->>'type' not in ('task-completed','mistake','session-started','session-finished','paused','resumed','exited','xr-changed') then raise exception 'Invalid event type'; end if;
    if length(coalesce(entry->>'message','')) > 1000 then raise exception 'Event message too long'; end if;
    insert into public.interaction_logs(session_id,event_id,event_type,occurred_at,payload)
    values(sid,(entry->>'id')::uuid,entry->>'type',(entry->>'timestamp')::timestamptz,entry)
    on conflict(session_id,event_id) do nothing;
  end loop;
end $$;
revoke all on function public.save_training_session(jsonb) from public, anon;
grant execute on function public.save_training_session(jsonb) to authenticated;
revoke all on function public.create_training_profile() from public, anon, authenticated;
commit;
