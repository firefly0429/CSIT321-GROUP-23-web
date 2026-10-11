import { create } from 'zustand';
import type { AccessibilitySettings, Scenario, SessionResult, UserRole, UserSession } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import type { UnityEvent } from '../types/unityMessages';
import { sessionRepository as repo } from '../services/sessionRepository';
import { settingsService } from '../services/settingsService';
import { authService } from '../services/authService';
import { trainingApi } from '../services/trainingApi';
import { getScenarioById } from '../data/scenarios';
import { reduceTrainingEvent, stopClock } from '../services/trainingState';
interface AppState {
  currentUser: UserSession | null; selectedScenario: Scenario | null; activeSession: SessionResult | null;
  sessions: SessionResult[]; settings: AccessibilitySettings; isPaused: boolean; initialized: boolean;
  syncStatus: 'local' | 'saving' | 'saved' | 'error'; error: string | null;
  initialize: () => Promise<void>; setUser: (user: UserSession) => void;
  selectRole: (role: UserRole, userId: string) => void; signOut: () => Promise<void>;
  selectScenario: (id: string) => void; startSession: (id: string, source?: 'unity' | 'demo') => SessionResult | null;
  resumeActiveSession: () => void; pauseSession: () => void; resumeSession: () => void;
  restartSession: () => void; exitSession: () => void;
  applyEvent: (event: UnityEvent) => { accepted: boolean; reason?: string };
  sync: () => Promise<void>; loadSessions: () => void; clearAllSessions: () => void;
  clearDemoData: () => void; seedDemoData: (sessions: SessionResult[]) => void;
  updateSettings: (partial: Partial<AccessibilitySettings>) => void; reportError: (message: string | null) => void;
}
let initializing: Promise<void> | undefined;
let syncing: Promise<void> | undefined;
let identityVersion = 0;
export const useTrainingStore = create<AppState>((set, get) => {
  const persist = (session: SessionResult) => {
    try { repo.commit(session); }
    catch (e) { set({ error: (e as Error).message }); throw e; }
    set({ activeSession: session.status === 'in-progress' ? session : null, sessions: repo.loadAllSessions(), isPaused: !session.runningSince });
    void get().sync();
  };
  const clock = (running: boolean) => {
    const session = get().activeSession;
    if (!session || Boolean(session.runningSince) === running) return;
    const next = running ? { ...session, runningSince: Date.now() } : stopClock(session);
    next.revision = (next.revision ?? 0) + 1;
    next.interactionLogs = [...next.interactionLogs, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: running ? 'resumed' : 'paused' }];
    persist(next);
  };
  return {
    currentUser: null, selectedScenario: null, activeSession: null, sessions: [], settings: settingsService.load() ?? DEFAULT_SETTINGS,
    isPaused: true, initialized: false, syncStatus: 'local', error: null,
    initialize: () => {
      if (initializing) return initializing;
      initializing = (async () => {
        try {
          const cached = repo.loadUserSession();
          const user = cached?.authMode === 'demo' ? cached : await authService.restore();
          if (user) get().setUser(user);
        } catch (e) { set({ error: (e as Error).message }); }
        finally { set({ initialized: true }); }
      })();
      return initializing;
    },
    setUser: user => {
      identityVersion++; repo.setOwner(user); repo.saveUserSession(user);
      const active = repo.loadActiveSession();
      set({ currentUser: user, activeSession: active, selectedScenario: active ? getScenarioById(active.scenarioId) ?? null : null,
        sessions: repo.loadAllSessions(), isPaused: true, error: null, syncStatus: user.authMode === 'cloud' ? 'saving' : 'local' });
      // An old-account request must finish before starting a new account's sync.
      if (syncing) void syncing.finally(() => get().sync()); else void get().sync();
    },
    selectRole: (role, userId) => get().setUser({ role, userId, authMode: 'demo' }),
    signOut: async () => {
      get().pauseSession();
      if (get().currentUser?.authMode === 'cloud') await authService.logout();
      identityVersion++; repo.clearUserSession();
      set({ currentUser: null, activeSession: null, selectedScenario: null, sessions: [], isPaused: true, syncStatus: 'local', error: null });
    },
    selectScenario: id => set({ selectedScenario: getScenarioById(id) ?? null }),
    startSession: (id, source = 'unity') => {
      const scenario = getScenarioById(id); const user = get().currentUser;
      if (!scenario?.available || !user) return null;
      if (get().activeSession) get().exitSession();
      const session: SessionResult = {
        sessionId: crypto.randomUUID(), userId: user.userId, scenarioId: id, scenarioName: scenario.name,
        source, trainingMode: 'desktop', revision: 1, startTime: new Date().toISOString(), durationSeconds: 0,
        finalScore: 0, maxPossibleScore: scenario.tasks.reduce((n,t) => n+t.maxScore,0), completedTaskCount: 0,
        totalTaskCount: scenario.tasks.length, mistakeCount: 0, passed: false, status: 'in-progress',
        taskResults: scenario.tasks.map(t => ({ ...t, completed: false, mistakes: 0 })), improvementNotes: [],
        interactionLogs: [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'session-started' }]
      };
      set({ selectedScenario: scenario }); persist(session); return session;
    },
    resumeActiveSession: () => {
      const active = repo.loadActiveSession();
      set({ activeSession: active, selectedScenario: active ? getScenarioById(active.scenarioId) ?? null : null, isPaused: true });
    },
    pauseSession: () => clock(false), resumeSession: () => clock(true),
    restartSession: () => { const s = get().activeSession; if (s) get().startSession(s.scenarioId, s.source); },
    exitSession: () => {
      const s = get().activeSession; if (!s) return;
      persist({ ...stopClock(s), revision: (s.revision ?? 0)+1, status: 'exited', endTime: new Date().toISOString(),
        interactionLogs: [...s.interactionLogs, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'exited' }] });
    },
    applyEvent: event => {
      const s = get().activeSession; const scenario = getScenarioById(event.scenarioId);
      if (!s || !scenario) return { accepted: false, reason: 'No active session.' };
      const result = reduceTrainingEvent(s, scenario, event);
      if (result.accepted && result.session !== s) persist(result.session);
      return { accepted: result.accepted, reason: result.reason };
    },
    sync: () => {
      if (get().currentUser?.authMode !== 'cloud') { set({ syncStatus: 'local' }); return Promise.resolve(); }
      if (syncing) return syncing;
      const version = identityVersion;
      set({ syncStatus: 'saving' });
      syncing = (async () => {
        try {
          while (version === identityVersion && repo.pending().length) {
            for (const session of repo.pending()) {
              if (version !== identityVersion) return;
              await trainingApi.save(session);
              if (version !== identityVersion) return;
              repo.acknowledge(session);
            }
          }
          const sessions = await trainingApi.list();
          if (version !== identityVersion) return;
          repo.mergeRemote(sessions); set({ sessions: repo.loadAllSessions(), syncStatus: repo.pending().length ? 'saving' : 'saved', error: null });
          if (repo.pending().length) setTimeout(() => { void get().sync(); }, 0);
        } catch (e) { if (version === identityVersion) set({ syncStatus: 'error', error: `Cloud sync failed; records remain in this browser. ${(e as Error).message}` }); }
        finally { syncing = undefined; }
      })();
      return syncing;
    },
    loadSessions: () => { set({ sessions: repo.loadAllSessions() }); void get().sync(); },
    clearAllSessions: () => { repo.clearAllSessions(); set({ sessions: repo.loadAllSessions(), activeSession: null }); },
    clearDemoData: () => { if (get().currentUser?.authMode === 'demo') set({ sessions: repo.clearDemoSessions() }); },
    seedDemoData: sessions => { if (get().currentUser?.authMode !== 'demo') return; repo.replaceAllSessions([...repo.loadAllSessions().filter(s => !s.sessionId.startsWith('demo-')), ...sessions.map(s => ({ ...s, source: 'demo' as const }))]); set({ sessions: repo.loadAllSessions() }); },
    updateSettings: partial => { const settings = { ...get().settings, ...partial }; settingsService.save(settings); set({ settings }); },
    reportError: error => set({ error })
  };
});
