import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { scenarios } from '../src/data/scenarios';
import { duration, stopClock, reduceTrainingEvent } from '../src/services/trainingState';
import { isUnityEvent, CHANNEL, type UnityEvent } from '../src/types/unityMessages';
import type { SessionResult } from '../src/types';
const scenario = scenarios[0];
export const makeSession = (): SessionResult => ({ sessionId: randomUUID(), userId: '00000000-0000-4000-8000-000000000001', scenarioId: scenario.id, scenarioName: scenario.name, source: 'unity', trainingMode: 'desktop', revision: 1, startTime: new Date().toISOString(), runningSince: Date.now(), durationSeconds: 0, finalScore: 0, maxPossibleScore: 100, completedTaskCount: 0, totalTaskCount: 5, mistakeCount: 0, passed: false, status: 'in-progress', taskResults: scenario.tasks.map(t=>({...t})), improvementNotes: [], interactionLogs: [{id:randomUUID(),timestamp:new Date().toISOString(),type:'session-started'}] });
function event(s: SessionResult, type: UnityEvent['type'], taskId?: string): UnityEvent { return { channel: CHANNEL, version: 1, type, sessionId: s.sessionId, scenarioId: s.scenarioId, eventId: randomUUID(), timestamp: new Date().toISOString(), taskId }; }
test('clock excludes paused time and time spent away after reload', () => {
  const s = {...makeSession(),durationSeconds:20,runningSince:10000};
  assert.equal(duration(s,15000),25);
  const paused=stopClock(s,15000); assert.equal(duration(paused,60000),25);
  assert.equal(duration({...paused,runningSince:60000},65000),30);
});
test('duplicate mistakes and duplicate completions do not increase totals', () => {
  let s=makeSession(); const e=event(s,'MISTAKE','inspect-area');
  s=reduceTrainingEvent(s,scenario,e).session;
  const duplicate=reduceTrainingEvent(s,scenario,e); assert.equal(duplicate.session,s); assert.equal(s.mistakeCount,1);
  const done=event(s,'TASK_COMPLETED','inspect-area'); s=reduceTrainingEvent(s,scenario,done).session;
  s=reduceTrainingEvent(s,scenario,event(s,'TASK_COMPLETED','inspect-area')).session;
  assert.equal(s.completedTaskCount,1); assert.equal(s.finalScore,15);
});
test('rejects stale sessions, out-of-order tasks, unknown tasks, paused tasks and premature finish',()=>{
  const s=makeSession();
  assert.equal(reduceTrainingEvent(s,scenario,{...event(s,'TASK_COMPLETED','inspect-area'),sessionId:'other'}).accepted,false);
  for(const e of [event(s,'TASK_COMPLETED','secure-ladder'),event(s,'MISTAKE','unknown'),event(s,'SESSION_FINISHED')]) assert.equal(reduceTrainingEvent(s,scenario,e).accepted,false);
  assert.equal(reduceTrainingEvent(stopClock(s),scenario,event(s,'TASK_COMPLETED','inspect-area')).accepted,false);
});
test('full training completes with correct score and stopped clock',()=>{
  let s=makeSession(); s=reduceTrainingEvent(s,scenario,event(s,'MISTAKE','inspect-area')).session;
  for(const t of scenario.tasks) s=reduceTrainingEvent(s,scenario,event(s,'TASK_COMPLETED',t.id)).session;
  s=reduceTrainingEvent(s,scenario,event(s,'SESSION_FINISHED')).session;
  assert.equal(s.finalScore,95); assert.equal(s.passed,true); assert.equal(s.status,'completed'); assert.equal(s.runningSince,undefined);
});
test('XR exit stops training until explicit resume',()=>{
  const s=makeSession(); const next=reduceTrainingEvent(s,scenario,{...event(s,'XR_CHANGED'),immersive:false}).session;
  assert.equal(next.runningSince,undefined); assert.equal(next.trainingMode,'desktop');
});
test('wire protocol rejects malformed or oversized messages',()=>{
  const e=event(makeSession(),'TASK_COMPLETED','inspect-area'); assert.equal(isUnityEvent(e),true);
  for(const invalid of [{...e,version:2},{...e,eventId:''},{...e,taskId:4},{...e,timestamp:'bad'}, {...e,message:'x'.repeat(1001)},{...e,type:'ADMIN'}]) assert.equal(isUnityEvent(invalid),false);
});
