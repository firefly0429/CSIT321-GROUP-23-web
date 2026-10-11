import type { Scenario, SessionResult } from '../types';
import type { UnityEvent } from '../types/unityMessages';
export function duration(session: SessionResult, now = Date.now()): number {
  return session.durationSeconds + (session.runningSince ? Math.max(0, now - session.runningSince) / 1000 : 0);
}
export function stopClock(session: SessionResult, now = Date.now()): SessionResult {
  return { ...session, durationSeconds: duration(session, now), runningSince: undefined };
}
export function score(session: SessionResult): number {
  return Math.max(0, session.taskResults.reduce((sum, t) => sum + (t.completed ? t.maxScore : 0), 0) - session.mistakeCount * 5);
}
export function reduceTrainingEvent(session: SessionResult, scenario: Scenario, event: UnityEvent): { session: SessionResult; accepted: boolean; reason?: string } {
  const reject = (reason: string) => ({ session, accepted: false, reason });
  if (event.sessionId !== session.sessionId || event.scenarioId !== session.scenarioId) return reject('Wrong session.');
  if (session.interactionLogs.some(log => log.id === event.eventId)) return { session, accepted: true };
  if (session.status !== 'in-progress') return reject('Session is closed.');
  if (['TASK_COMPLETED', 'MISTAKE', 'SESSION_FINISHED'].includes(event.type) && !session.runningSince) return reject('Training is paused or not started.');
  let next: SessionResult = { ...session, taskResults: session.taskResults.map(t => ({ ...t })) };
  const task = next.taskResults.find(t => t.id === event.taskId);
  let type: SessionResult['interactionLogs'][number]['type'] = 'task-completed';
  if (event.type === 'TASK_COMPLETED') {
    if (!task) return reject('Unknown task.');
    const index = next.taskResults.indexOf(task);
    if (next.taskResults.slice(0, index).some(t => !t.completed)) return reject('Complete the preceding task first.');
    task.completed = true; task.completionTime ??= duration(session);
  } else if (event.type === 'MISTAKE') {
    if (!task || task.completed) return reject('Invalid or completed task.');
    task.mistakes++; next.mistakeCount++; type = 'mistake';
  } else if (event.type === 'SESSION_FINISHED') {
    if (next.taskResults.some(t => t.required && !t.completed)) return reject('Required tasks are incomplete.');
    next = { ...stopClock(next), status: 'completed', endTime: new Date().toISOString() }; type = 'session-finished';
  } else if (event.type === 'PAUSED') {
    next = stopClock(next); type = 'paused';
  } else {
    next.trainingMode = event.immersive ? 'vr' : 'desktop';
    next.usedVR = Boolean(next.usedVR || event.immersive); type = 'xr-changed';
    if (!event.immersive) next = stopClock(next);
  }
  next.completedTaskCount = next.taskResults.filter(t => t.completed).length;
  next.finalScore = score(next);
  next.passed = next.status === 'completed' && next.finalScore >= scenario.passScore;
  next.interactionLogs = [...next.interactionLogs, { id: event.eventId, timestamp: event.timestamp, type, taskId: event.taskId, message: event.message }];
  next.revision = (next.revision ?? 0) + 1;
  if (next.status === 'completed') {
    next.improvementNotes = next.taskResults.filter(t => t.mistakes).map(t => `${t.title}: ${t.mistakes} mistake(s). Review this step.`);
    if (!next.improvementNotes.length) next.improvementNotes = ['All required tasks completed without recorded mistakes.'];
  }
  return { session: next, accepted: true };
}
