import type { SessionResult, UserSession } from "../types";

const KEYS = {
  userSession: "vr-user-session",
  activeSession: "vr-active-session",
  sessions: "vr-training-sessions",
} as const;

/** Parses JSON from localStorage, returning a fallback instead of throwing on corrupted data. */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    console.error(`sessionRepository: corrupted JSON in localStorage, falling back to default.`);
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`sessionRepository: failed to write "${key}" to localStorage.`, err);
  }
}

export const sessionRepository = {
  // --- user session ---
  saveUserSession(session: UserSession): void {
    safeWrite(KEYS.userSession, session);
  },
  loadUserSession(): UserSession | null {
    return safeParse<UserSession | null>(localStorage.getItem(KEYS.userSession), null);
  },
  clearUserSession(): void {
    localStorage.removeItem(KEYS.userSession);
  },

  // --- active (in-progress) session ---
  saveActiveSession(session: SessionResult): void {
    safeWrite(KEYS.activeSession, session);
  },
  loadActiveSession(): SessionResult | null {
    return safeParse<SessionResult | null>(localStorage.getItem(KEYS.activeSession), null);
  },
  clearActiveSession(): void {
    localStorage.removeItem(KEYS.activeSession);
  },

  // --- completed / exited session history ---
  loadAllSessions(): SessionResult[] {
    return safeParse<SessionResult[]>(localStorage.getItem(KEYS.sessions), []);
  },
  loadSessionsForUser(userId: string): SessionResult[] {
    return this.loadAllSessions()
      .filter((s) => s.userId === userId)
      .sort((a, b) => (b.endTime ?? b.startTime).localeCompare(a.endTime ?? a.startTime));
  },
  loadSessionsForScenario(scenarioId: string): SessionResult[] {
    return this.loadAllSessions().filter((s) => s.scenarioId === scenarioId);
  },

  /** Saves or replaces a session record by sessionId, so an attempt that is
   * later completed updates its own row instead of creating a duplicate. */
  saveSession(session: SessionResult): void {
    const all = this.loadAllSessions();
    const index = all.findIndex((s) => s.sessionId === session.sessionId);
    if (index >= 0) {
      all[index] = session;
    } else {
      all.push(session);
    }
    safeWrite(KEYS.sessions, all);
  },

  clearAllSessions(): void {
    localStorage.removeItem(KEYS.sessions);
    localStorage.removeItem(KEYS.activeSession);
  },

  /** Removes only generated demo sessions (sessionId starting with
   * "demo-"), leaving real trainee attempts untouched. Previously the
   * dashboard's "Clear Demo Data" button called clearAllSessions(), which
   * deleted every real session (and the in-progress one) right along with
   * the demo data it claimed to target. */
  clearDemoSessions(): SessionResult[] {
    const remaining = this.loadAllSessions().filter((s) => !s.sessionId.startsWith("demo-"));
    this.replaceAllSessions(remaining);
    return remaining;
  },

  replaceAllSessions(sessions: SessionResult[]): void {
    safeWrite(KEYS.sessions, sessions);
  },

  // --- aggregate stats ---
  calculateAverageScore(sessions: SessionResult[]): number {
    const completed = sessions.filter((s) => s.status === "completed");
    if (completed.length === 0) return 0;
    return completed.reduce((sum, s) => sum + s.finalScore, 0) / completed.length;
  },
  calculateAverageDuration(sessions: SessionResult[]): number {
    const completed = sessions.filter((s) => s.status === "completed");
    if (completed.length === 0) return 0;
    return completed.reduce((sum, s) => sum + s.durationSeconds, 0) / completed.length;
  },
  calculateCompletionRate(sessions: SessionResult[]): number {
    if (sessions.length === 0) return 0;
    return (sessions.filter((s) => s.status === "completed").length / sessions.length) * 100;
  },
  calculatePassRate(sessions: SessionResult[]): number {
    const completed = sessions.filter((s) => s.status === "completed");
    if (completed.length === 0) return 0;
    return (completed.filter((s) => s.passed).length / completed.length) * 100;
  },
};
