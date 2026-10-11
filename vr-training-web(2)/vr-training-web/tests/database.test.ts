import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { scenarios } from '../src/data/scenarios';
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002', educator='00000000-0000-4000-8000-000000000003';
function sample() { return { sessionId:randomUUID(),userId:a,scenarioId:'ladder-inspection',scenarioName:'Ladder Inspection',source:'unity',trainingMode:'desktop',revision:1,startTime:new Date().toISOString(),durationSeconds:10,finalScore:9999,maxPossibleScore:9999,completedTaskCount:0,totalTaskCount:5,mistakeCount:0,passed:true,status:'in-progress',taskResults:scenarios[0].tasks.map(t=>({...t})),improvementNotes:[],interactionLogs:[{id:randomUUID(),type:'session-started',timestamp:new Date().toISOString()}]}; }
test('database migration, server scoring, idempotency, ownership and educator RLS',async()=>{
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202610110001_training.sql',import.meta.url),'utf8'));
    await db.query('insert into auth.users values ($1),($2),($3)',[a,b,educator]);
    const asUser = async (id:string) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); }
    const save=(s:unknown)=>db.query('select public.save_training_session($1::jsonb)',[JSON.stringify(s)]);
    const s=sample(); await asUser(a); await save(s); await save(s);
    let rows=await db.query<{score:number}>('select score from public.training_sessions'); assert.equal(rows.rows.length,1); assert.equal(rows.rows[0].score,0);
    const logs=await db.query<{count:number}>('select count(*)::int as count from public.interaction_logs'); assert.equal(logs.rows[0].count,1);
    await assert.rejects(db.query("update public.profiles set role='educator'"));
    await assert.rejects(db.query('delete from public.training_sessions'));
    await assert.rejects(save({...s,revision:2,status:'completed',endTime:new Date().toISOString()}));
    await assert.rejects(save({...s,revision:2,taskResults:s.taskResults.map((t,i)=>({...t,completed:i===2}))}));
    await asUser(b); assert.equal((await db.query('select * from public.training_sessions')).rows.length,0); await assert.rejects(save(s)); await assert.rejects(save({...s,userId:b}));
    await asUser(educator); assert.equal((await db.query('select * from public.training_sessions')).rows.length,0);
    await db.exec('reset role'); await db.query('insert into public.educator_assignments values($1,$2)',[educator,a]);
    await asUser(educator); assert.equal((await db.query('select * from public.training_sessions')).rows.length,1); await assert.rejects(save(s));
    await asUser(a);
    const completed={...s,revision:2,status:'completed',endTime:new Date().toISOString(),taskResults:s.taskResults.map((t,i)=>({...t,completed:true,mistakes:i===0?2:0,maxScore:9999}))};
    await save(completed); await save(completed);
    rows=await db.query<{score:number}>('select score from public.training_sessions'); assert.equal(rows.rows[0].score,90);
    await assert.rejects(save({...completed,revision:3}));
    await db.exec('reset role'); await db.exec('set role anon'); await assert.rejects(db.query('select * from public.training_sessions')); await assert.rejects(save(s));
  } finally { await db.close(); }
});
