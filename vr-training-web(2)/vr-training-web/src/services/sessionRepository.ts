import type { SessionResult, UserSession } from '../types';
import { stopClock } from './trainingState';
interface Cache { active: SessionResult | null; sessions: SessionResult[]; pending: SessionResult[] }
const USER_KEY = 'vr-user-v2';
let owner: UserSession | null = null;
const empty = (): Cache => ({ active: null, sessions: [], pending: [] });
function key() { return owner?.authMode === 'cloud' ? `vr-cache-v2:${owner.userId}` : 'vr-cache-v2:demo'; }
function read(): Cache {
  const raw = localStorage.getItem(key());
  if (!raw) return empty();
  const value = JSON.parse(raw) as Cache;
  if (!Array.isArray(value.sessions) || !Array.isArray(value.pending)) throw new Error('Training cache is damaged. Export or clear browser data before continuing.');
  return value;
}
function write(value: Cache) {
  try { localStorage.setItem(key(), JSON.stringify(value)); }
  catch { throw new Error('Cannot save training data in this browser. Free storage space or enable site storage, then retry.'); }
}
function upsert(list: SessionResult[], session: SessionResult) {
  return [...list.filter(s => s.sessionId !== session.sessionId), session];
}
export const sessionRepository = {
  setOwner(user: UserSession | null) { owner = user; },
  saveUserSession(user: UserSession) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  loadUserSession(): UserSession | null { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  clearUserSession() { localStorage.removeItem(USER_KEY); owner = null; },
  commit(session: SessionResult) {
    if (!owner || owner.userId !== session.userId) throw new Error('This training session belongs to another account.');
    const cache = read(); const snapshot = stopClock(session);
    cache.active = session.status === 'in-progress' ? snapshot : null;
    cache.sessions = upsert(cache.sessions, snapshot);
    if (owner.authMode === 'cloud') cache.pending = upsert(cache.pending, snapshot);
    write(cache);
  },
  loadActiveSession(): SessionResult | null { const s = read().active; return s?.userId === owner?.userId ? s : null; },
  clearActiveSession() { const c = read(); c.active = null; write(c); },
  loadAllSessions(): SessionResult[] {
    const list = read().sessions;
    return owner?.authMode === 'cloud' || owner?.role === 'educator' ? list : list.filter(s => s.userId === owner?.userId);
  },
  pending(): SessionResult[] { return read().pending.filter(s => s.userId === owner?.userId); },
  acknowledge(session: SessionResult) {
    const c = read(); c.pending = c.pending.filter(s => s.sessionId !== session.sessionId || (s.revision ?? 0) > (session.revision ?? 0)); write(c);
  },
  mergeRemote(sessions: SessionResult[]) {
    const c = read();
    const pendingIds = new Set(c.pending.map(s => s.sessionId));
    // Cloud query is RLS-filtered: never carry revoked educator records into a refreshed view.
    c.sessions = [...sessions.filter(s => !pendingIds.has(s.sessionId)), ...c.pending];
    write(c);
  },
  clearAllSessions() {
    if (owner?.authMode === 'cloud') throw new Error('Cloud history is retained. Use the database administration workflow to delete records.');
    const c = read(); c.sessions = c.sessions.filter(s => s.userId !== owner?.userId); c.active = null; write(c);
  },
  clearDemoSessions() { const c = read(); c.sessions = c.sessions.filter(s => !s.sessionId.startsWith('demo-')); write(c); return c.sessions; },
  replaceAllSessions(sessions: SessionResult[]) { const c = read(); c.sessions = sessions; write(c); },
  calculateAverageScore(sessions: SessionResult[]) { const list = sessions.filter(s => s.status === 'completed'); return list.length ? list.reduce((n,s) => n+s.finalScore,0)/list.length : 0; },
  calculateAverageDuration(sessions: SessionResult[]) { const list = sessions.filter(s => s.status === 'completed'); return list.length ? list.reduce((n,s) => n+s.durationSeconds,0)/list.length : 0; },
  calculateCompletionRate(sessions: SessionResult[]) { return sessions.length ? sessions.filter(s => s.status === 'completed').length/sessions.length*100 : 0; },
  calculatePassRate(sessions: SessionResult[]) { const list = sessions.filter(s => s.status === 'completed'); return list.length ? list.filter(s => s.passed).length/list.length*100 : 0; }
};
