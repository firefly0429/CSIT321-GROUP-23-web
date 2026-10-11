import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { UnityBridge } from '../src/services/unityBridge';
import type { SessionResult } from '../src/types';

test('React ↔ host bridge validates source, waits for integration and acknowledges Unity events',async()=>{
  const parentListeners=new Set<(e:unknown)=>void>(); const frameListeners=new Set<(e:unknown)=>void>();
  const origin='https://training.example'; const sent: Record<string, unknown>[]=[];
  const frame={postMessage:(data:unknown,target:string)=>{assert.equal(target,origin);queueMicrotask(()=>frameListeners.forEach(fn=>fn({origin,source:parentWindow,data})))}};
  const parentWindow={location:{origin},postMessage:(data:Record<string,unknown>,target:string)=>{assert.equal(target,origin);sent.push(data);queueMicrotask(()=>parentListeners.forEach(fn=>fn({origin,source:frame,data})))},addEventListener:(_type:string,fn:(e:unknown)=>void)=>parentListeners.add(fn),removeEventListener:(_type:string,fn:(e:unknown)=>void)=>parentListeners.delete(fn)};
  Object.defineProperty(globalThis,'window',{value:parentWindow,configurable:true});
  const timers: ReturnType<typeof setInterval>[]=[];
  const context=vm.createContext({window:frame,parent:parentWindow,location:{origin},navigator:{},isSecureContext:true,document:{readyState:'complete',getElementById:()=>null},setInterval:(f:()=>void,ms:number)=>{const t=setInterval(f,ms);timers.push(t);return t;},console,Map,JSON,Date});
  Object.assign(frame,{addEventListener:(_type:string,fn:(e:unknown)=>void)=>frameListeners.add(fn)});
  vm.runInContext(readFileSync(new URL('../public/unity/training-bridge.js',import.meta.url),'utf8'),context);
  const host=(frame as unknown as {TrainingHost:{attach:(u:unknown)=>void;fromUnity:(json:string)=>void}}).TrainingHost;
  const s={sessionId:'session-1',scenarioId:'ladder-inspection'} as SessionResult;
  let integrated=false; let eventCount=0; let commandCount=0;
  const client=new UnityBridge({contentWindow:frame} as unknown as HTMLIFrameElement,s,status=>{integrated=status.integrated},()=>{eventCount++;return {accepted:true}});
  try {
    host.attach({SendMessage:(_object:string,_method:string,json:string)=>{commandCount++;const c=JSON.parse(json);host.fromUnity(JSON.stringify({...c,type:'COMMAND_ACK',ok:true}))}});
    await new Promise(r=>setTimeout(r,0)); assert.equal(integrated,false);
    host.fromUnity(JSON.stringify({type:'BRIDGE_READY',scenarioId:s.scenarioId,supportsResume:false}));
    await new Promise(r=>setTimeout(r,0)); assert.equal(integrated,true);
    await client.command('START'); assert.equal(commandCount,1);
    const e={channel:'csit321-training',version:1,type:'TASK_COMPLETED',sessionId:s.sessionId,scenarioId:s.scenarioId,eventId:'event-1',timestamp:new Date().toISOString(),taskId:'inspect-area'};
    parentListeners.forEach(fn=>fn({origin:'https://attacker.example',source:frame,data:e}));
    parentListeners.forEach(fn=>fn({origin,source:{},data:e})); assert.equal(eventCount,0);
    host.fromUnity(JSON.stringify(e)); await new Promise(r=>setTimeout(r,0)); assert.equal(eventCount,1);
    assert.ok(sent.some(m=>m.type==='TASK_COMPLETED'));
    await client.command('PAUSE'); assert.equal(commandCount,2);
  } finally {client.dispose();timers.forEach(clearInterval)}
});
