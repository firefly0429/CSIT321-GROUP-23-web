import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { UnityPlayer, type UnityPlayerHandle } from '../components/training/UnityPlayer';
import { useTrainingStore } from '../store/useTrainingStore';
import { duration } from '../services/trainingState';
import { CHANNEL, type CommandType, type UnityEvent } from '../types/unityMessages';
export default function TrainingPage() {
  const { scenarioId } = useParams(); const navigate = useNavigate();
  const session = useTrainingStore(s => s.activeSession);
  const paused = useTrainingStore(s => s.isPaused);
  const player = useRef<UnityPlayerHandle>(null);
  const [ready, setReady] = useState(false); const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false); const [elapsed, setElapsed] = useState(0);
  const [confirmation, setConfirmation] = useState<'restart' | 'exit' | null>(null);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const timer = setInterval(() => { const s = useTrainingStore.getState().activeSession; if (s) setElapsed(duration(s)); }, 250);
    return () => { clearInterval(timer); try { useTrainingStore.getState().pauseSession(); } catch { /* error already displayed by store */ } };
  }, []);
  useEffect(() => { setReady(false); setStarted(false); setAnswers({}); setElapsed(0); }, [session?.sessionId]);
  if (!session || session.scenarioId !== scenarioId) return <div className="p-10"><p>No active training for this scenario.</p><Button onClick={() => navigate('/scenarios')}>Choose a scenario</Button></div>;
  const demo = session.source === 'demo';
  const current = session.taskResults.find(t => !t.completed);
  const store = () => useTrainingStore.getState();
  async function command(type: CommandType) {
    if (!demo) { if (!player.current) throw new Error('Player is unavailable.'); await player.current.command(type); }
  }
  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    try { await action(); store().reportError(null); } catch (e) { store().reportError((e as Error).message); }
    finally { setBusy(false); }
  }
  function event(type: UnityEvent['type'], taskId?: string, message?: string) {
    if (!session) return;
    const result = store().applyEvent({ channel: CHANNEL, version: 1, type, taskId, message, eventId: crypto.randomUUID(), sessionId: session.sessionId, scenarioId: session.scenarioId, timestamp: new Date().toISOString() });
    if (!result.accepted) throw new Error(result.reason);
    if (type === 'SESSION_FINISHED') navigate(`/feedback/${session.sessionId}`);
  }
  function inspectRung(index: number, damaged: boolean) {
    if (damaged !== (index === 3)) { event('MISTAKE', 'inspect-rungs', `Rung ${index} identified incorrectly.`); return; }
    const next = { ...answers, [index]: damaged }; setAnswers(next);
    if (Object.keys(next).length === 5) event('TASK_COMPLETED', 'inspect-rungs');
  }
  return <>
    <AppHeader title={session.scenarioName} subtitle={demo ? 'Browser demo — simulated task results' : 'Unity training — results from scene events'} />
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <div className="flex flex-wrap gap-5 text-sm"><span>Time {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}</span><span>Score {session.finalScore}/{session.maxPossibleScore}</span><span>Mistakes {session.mistakeCount}</span><span>{session.trainingMode === 'vr' ? 'Immersive VR' : 'Desktop'} · {paused ? 'Paused / waiting' : 'Running'}</span></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          {demo ? <Card><h2 className="mb-3 font-semibold">Interactive workflow demo</h2><p className="mb-4 text-sm text-muted">This checks the website workflow. It is not a VR competency assessment.</p>
            {!paused && <div className="space-y-3">
              <p>{current?.description ?? 'All steps complete.'}</p>
              {current?.id === 'inspect-area' && <Button onClick={() => void run(() => event('TASK_COMPLETED', current.id))}>Remove the floor hazard</Button>}
              {current?.id === 'wear-equipment' && <Button onClick={() => void run(() => event('TASK_COMPLETED', current.id))}>Put on the safety helmet</Button>}
              {current?.id === 'secure-ladder' && <Button onClick={() => void run(() => event('TASK_COMPLETED', current.id))}>Engage both ladder locks</Button>}
              {current?.id === 'inspect-rungs' && <><p className="text-sm">Rung 3 has a visible crack. Inspect every rung:</p>{[1,2,3,4,5].map(i => <div key={i} className="flex gap-3 items-center"><span>Rung {i}: {i === 3 ? 'cracked' : 'intact'}</span>{i in answers ? <span>✓ Checked</span> : <><Button size="sm" onClick={() => void run(() => inspectRung(i,false))}>Safe</Button><Button size="sm" onClick={() => void run(() => inspectRung(i,true))}>Damaged</Button></>}</div>)}</>}
              {current?.id === 'confirm-inspection' && <Button onClick={() => void run(() => { event('TASK_COMPLETED', current.id); event('SESSION_FINISHED'); })}>Confirm and finish</Button>}
            </div>}
          </Card> : <UnityPlayer key={session.sessionId} ref={player} session={session} onReady={setReady} onFinished={id => navigate(`/feedback/${id}`)} />}
        </div>
        <Card><h2 className="mb-3 font-semibold">Task checklist</h2><ol className="space-y-3">{session.taskResults.map(t => <li key={t.id} className={t.completed ? 'text-success' : 'text-muted'}>{t.completed ? '✓' : '○'} {t.title}<div className="text-xs">{t.mistakes} mistake(s)</div></li>)}</ol></Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy || (!demo && !ready)} onClick={() => void run(async () => {
          if (!started) { await command('START'); store().resumeSession(); setStarted(true); }
          else if (paused) { await command('RESUME'); store().resumeSession(); }
          else { await command('PAUSE'); store().pauseSession(); }
        })}>{!started ? 'Start training' : paused ? 'Resume' : 'Pause'}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setConfirmation('restart')}>Restart attempt</Button>
        <Button variant="danger" disabled={busy} onClick={() => setConfirmation('exit')}>Exit</Button>
      </div>
      {confirmation && <Card><p className="mb-3">{confirmation === 'restart' ? 'End this attempt and start a new one? Unity will reload.' : 'End this attempt and return to the menu?'}</p><div className="flex gap-3"><Button disabled={busy} onClick={() => void run(async () => {
        // Unmount/reload guarantees the scene stops even when the old build has no bridge.
        if (ready && started && !demo) { try { await command('EXIT'); } catch { /* teardown is the fallback */ } }
        if (confirmation === 'restart') store().restartSession(); else { store().exitSession(); navigate('/home'); }
        setConfirmation(null);
      })}>Confirm</Button><Button variant="ghost" onClick={() => setConfirmation(null)}>Cancel</Button></div></Card>}
    </main>
  </>;
}
