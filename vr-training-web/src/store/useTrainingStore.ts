import { create } from "zustand";
import type {
  AccessibilitySettings,
  InteractionLog,
  Scenario,
  SessionResult,
  UserRole,
  UserSession,
} from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { sessionRepository } from "../services/sessionRepository";
import { settingsService } from "../services/settingsService";
import { getScenarioById } from "../data/scenarios";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers).
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function log(type: InteractionLog["type"], taskId?: string, message?: string): InteractionLog {
  return { id: uuid(), timestamp: new Date().toISOString(), type, taskId, message };
}

interface AppState {
  currentUser: UserSession | null;
  selectedScenario: Scenario | null;
  activeSession: SessionResult | null;
  sessions: SessionResult[];
  settings: AccessibilitySettings;
  isPaused: boolean;

  // lifecycle
  selectRole: (role: UserRole, userId: string) => void;
  signOut: () => void;
  selectScenario: (scenarioId: string) => void;
  startSession: (scenarioId: string) => SessionResult | null;
  resumeActiveSession: () => void;
  completeTask: (taskId: string) => void;
  recordMistake: (taskId: string, message: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  restartSession: () => void;
  exitSession: () => void;
  finishSession: () => SessionResult | null;

  // data
  loadSessions: () => void;
  clearAllSessions: () => void;
  clearDemoData: () => void;
  seedDemoData: (sessions: SessionResult[]) => void;

  // settings
  updateSettings: (partial: Partial<AccessibilitySettings>) => void;
}

const MISTAKE_PENALTY = 5;

function computeScore(session: SessionResult): number {
  const completedScore = session.taskResults.reduce((total, t) => total + (t.completed ? t.maxScore : 0), 0);
  const penalty = session.mistakeCount * MISTAKE_PENALTY;
  return Math.max(0, Math.min(session.maxPossibleScore, completedScore - penalty));
}

function buildImprovementNotes(session: SessionResult): string[] {
  const notes: string[] = [];

  const incomplete = session.taskResults.filter((t) => !t.completed);
  if (incomplete.length > 0) {
    notes.push(
      `${incomplete.length} task(s) not completed: ${incomplete.map((t) => t.title).join(", ")}.`
    );
  }

  session.taskResults
    .filter((t) => t.mistakes > 0)
    .forEach((t) => {
      notes.push(
        t.mistakes === 1
          ? `One mistake recorded on "${t.title}" - review the correct steps and try again.`
          : `${t.mistakes} mistakes recorded on "${t.title}" - this step needs more practice.`
      );
    });

  if (notes.length === 0) {
    notes.push("No mistakes recorded - great work, keep this pace on the next scenario.");
  }

  return notes;
}

export const useTrainingStore = create<AppState>((set, get) => ({
  currentUser: sessionRepository.loadUserSession(),
  selectedScenario: null,
  activeSession: sessionRepository.loadActiveSession(),
  sessions: sessionRepository.loadAllSessions(),
  settings: settingsService.load(),
  isPaused: false,

  selectRole: (role, userId) => {
    const session: UserSession = { userId, role };
    sessionRepository.saveUserSession(session);
    set({ currentUser: session });
  },

  signOut: () => {
    sessionRepository.clearUserSession();
    set({ currentUser: null, selectedScenario: null });
  },

  selectScenario: (scenarioId) => {
    const scenario = getScenarioById(scenarioId) ?? null;
    set({ selectedScenario: scenario });
  },

  startSession: (scenarioId) => {
    const scenario = getScenarioById(scenarioId);
    const user = get().currentUser;
    if (!scenario || !scenario.available || !user) return null;

    const session: SessionResult = {
      sessionId: uuid(),
      userId: user.userId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startTime: new Date().toISOString(),
      durationSeconds: 0,
      finalScore: 0,
      maxPossibleScore: scenario.tasks.reduce((total, t) => total + t.maxScore, 0),
      completedTaskCount: 0,
      totalTaskCount: scenario.tasks.length,
      mistakeCount: 0,
      passed: false,
      status: "in-progress",
      taskResults: scenario.tasks.map((t) => ({ ...t, completed: false, mistakes: 0, completionTime: undefined })),
      improvementNotes: [],
      interactionLogs: [log("session-started")],
    };

    sessionRepository.saveActiveSession(session);
    set({ activeSession: session, selectedScenario: scenario, isPaused: false });
    return session;
  },

  resumeActiveSession: () => {
    const active = sessionRepository.loadActiveSession();
    if (!active) return;
    const scenario = getScenarioById(active.scenarioId) ?? null;
    set({ activeSession: active, selectedScenario: scenario, isPaused: false });
  },

  completeTask: (taskId) => {
    const session = get().activeSession;
    if (!session || session.status !== "in-progress") return;

    const target = session.taskResults.find((t) => t.id === taskId);
    if (!target || target.completed) return;

    // Enforce in-order completion: a task can only complete if every task
    // before it in the list is already done. Attempting a later task early
    // is handled by the caller (recordMistake + a "do the current task
    // first" toast), not here.
    const index = session.taskResults.findIndex((t) => t.id === taskId);
    const prerequisitesMet = session.taskResults.slice(0, index).every((t) => t.completed);
    if (!prerequisitesMet) return;

    const elapsed = (Date.now() - new Date(session.startTime).getTime()) / 1000;

    const updatedTasks = session.taskResults.map((t) =>
      t.id === taskId ? { ...t, completed: true, completionTime: elapsed } : t
    );

    const updated: SessionResult = {
      ...session,
      taskResults: updatedTasks,
      completedTaskCount: updatedTasks.filter((t) => t.completed).length,
      durationSeconds: elapsed,
      interactionLogs: [...session.interactionLogs, log("task-completed", taskId)],
    };
    updated.finalScore = computeScore(updated);

    sessionRepository.saveActiveSession(updated);
    set({ activeSession: updated });
  },

  recordMistake: (taskId, message) => {
    const session = get().activeSession;
    if (!session || session.status !== "in-progress") return;

    const updatedTasks = session.taskResults.map((t) =>
      t.id === taskId ? { ...t, mistakes: t.mistakes + 1 } : t
    );

    const updated: SessionResult = {
      ...session,
      taskResults: updatedTasks,
      mistakeCount: session.mistakeCount + 1,
      interactionLogs: [...session.interactionLogs, log("mistake", taskId, message)],
    };
    updated.finalScore = computeScore(updated);

    sessionRepository.saveActiveSession(updated);
    set({ activeSession: updated });
  },

  pauseSession: () => {
    const session = get().activeSession;
    if (!session) return;
    const updated = { ...session, interactionLogs: [...session.interactionLogs, log("paused")] };
    sessionRepository.saveActiveSession(updated);
    set({ activeSession: updated, isPaused: true });
  },

  resumeSession: () => {
    const session = get().activeSession;
    if (!session) return;
    const updated = { ...session, interactionLogs: [...session.interactionLogs, log("resumed")] };
    sessionRepository.saveActiveSession(updated);
    set({ activeSession: updated, isPaused: false });
  },

  restartSession: () => {
    const scenario = get().selectedScenario;
    const user = get().currentUser;
    if (!scenario || !user) return;
    get().startSession(scenario.id);
  },

  exitSession: () => {
    const session = get().activeSession;
    if (!session) return;

    const exited: SessionResult = {
      ...session,
      status: "exited",
      endTime: new Date().toISOString(),
      interactionLogs: [...session.interactionLogs, log("exited")],
    };

    sessionRepository.saveSession(exited);
    sessionRepository.clearActiveSession();

    set({
      activeSession: null,
      isPaused: false,
      sessions: sessionRepository.loadAllSessions(),
    });
  },

  finishSession: () => {
    const session = get().activeSession;
    const scenario = get().selectedScenario;
    if (!session || !scenario) return null;

    const finalScore = computeScore(session);
    const finished: SessionResult = {
      ...session,
      endTime: new Date().toISOString(),
      finalScore,
      passed: finalScore >= scenario.passScore,
      status: "completed",
      improvementNotes: buildImprovementNotes(session),
      interactionLogs: [...session.interactionLogs, log("session-finished")],
    };

    sessionRepository.saveSession(finished);
    sessionRepository.clearActiveSession();

    set({
      activeSession: null,
      isPaused: false,
      sessions: sessionRepository.loadAllSessions(),
    });

    return finished;
  },

  loadSessions: () => {
    set({ sessions: sessionRepository.loadAllSessions() });
  },

  clearAllSessions: () => {
    sessionRepository.clearAllSessions();
    set({ sessions: [], activeSession: null });
  },

  /** Removes only generated demo data, leaving real trainee attempts
   * (and the active session, if any) untouched - see sessionRepository
   * .clearDemoSessions for why this is distinct from clearAllSessions. */
  clearDemoData: () => {
    const remaining = sessionRepository.clearDemoSessions();
    set({ sessions: remaining });
  },

  seedDemoData: (demoSessions) => {
    // Remove any previously-generated demo sessions first, rather than
    // appending on top of them - clicking "Generate Demo Data" repeatedly
    // previously kept adding another 12 rows each time, quickly producing
    // dozens of duplicate-looking records instead of refreshing the same
    // ~12.
    const realSessions = sessionRepository.loadAllSessions().filter((s) => !s.sessionId.startsWith("demo-"));
    const combined = [...realSessions, ...demoSessions];
    sessionRepository.replaceAllSessions(combined);
    set({ sessions: combined });
  },

  updateSettings: (partial) => {
    const updated = { ...get().settings, ...partial };
    settingsService.save(updated);
    set({ settings: updated });
  },
}));
