import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('React demo UI reaches feedback and keeps saved results after sign-out',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://training.example'});
  for(const key of ['window','document','localStorage','HTMLElement','Element','SVGElement','Node','MutationObserver','navigator']) Object.defineProperty(globalThis,key,{value:dom.window[key as keyof typeof dom.window],configurable:true});
  Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
  const React=await import('react'); const {act}=React;
  const {createRoot}=await import('react-dom/client');
  const {MemoryRouter,Routes,Route}=await import('react-router-dom');
  const {default:TrainingPage}=await import('../src/pages/TrainingPage');
  const {useTrainingStore}=await import('../src/store/useTrainingStore');
  useTrainingStore.getState().selectRole('trainee','Trainee01');
  useTrainingStore.getState().startSession('ladder-inspection','demo');
  const root=createRoot(document.getElementById('root')!);
  try {
    await act(async()=>{root.render(<MemoryRouter initialEntries={['/training/ladder-inspection']}><Routes><Route path="/training/:scenarioId" element={<TrainingPage/>}/><Route path="/feedback/:id" element={<p>Feedback reached</p>}/></Routes></MemoryRouter>)});
    const click=async(label:string)=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,`Missing button: ${label}`);await act(async()=>button.click())};
    await click('Start training');
    await click('Remove the floor hazard'); await click('Put on the safety helmet'); await click('Engage both ladder locks');
    for(let i=1;i<=5;i++) await click(i===3?'Damaged':'Safe');
    await click('Confirm and finish');
    assert.match(document.body.textContent||'',/Feedback reached/);
    const result=useTrainingStore.getState().sessions[0]; assert.equal(result.finalScore,100);assert.equal(result.source,'demo');assert.equal(result.status,'completed');
    await act(async()=>useTrainingStore.getState().signOut());assert.equal(useTrainingStore.getState().activeSession,null);
    useTrainingStore.getState().selectRole('trainee','Trainee01');assert.equal(useTrainingStore.getState().sessions[0].finalScore,100);
  } finally {await act(async()=>root.unmount());dom.window.close()}
});
