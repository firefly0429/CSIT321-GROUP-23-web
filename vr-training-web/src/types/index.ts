export type UserRole = "trainee" | "educator" | "administrator";

export interface UserSession {
  userId: string;
  role: UserRole;
}

export interface TrainingTask {
  id: string;
  title: string;
  description: string;
  required: boolean;
  maxScore: number;
  completed: boolean;
  mistakes: number;
  completionTime?: number;
}

export interface Scenario {
  id: string;
  name: string;
  domain: "Workplace Safety" | "Healthcare Training" | "Technical Maintenance";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedMinutes: number;
  description: string;
  objectives: string[];
  controls: string[];
  safetyInstructions: string;
  passScore: number;
  tasks: TrainingTask[];
  available: boolean;
}

export type SessionStatus = "in-progress" | "completed" | "exited";

export interface InteractionLog {
  id: string;
  timestamp: string;
  type: "task-completed" | "mistake" | "session-started" | "session-finished" | "paused" | "resumed" | "exited";
  taskId?: string;
  message?: string;
}

export interface SessionResult {
  sessionId: string;
  userId: string;
  scenarioId: string;
  scenarioName: string;

  startTime: string;
  endTime?: string;
  durationSeconds: number;

  finalScore: number;
  maxPossibleScore: number;

  completedTaskCount: number;
  totalTaskCount: number;
  mistakeCount: number;

  passed: boolean;
  status: SessionStatus;

  taskResults: TrainingTask[];
  improvementNotes: string[];
  interactionLogs: InteractionLog[];
}

export interface AccessibilitySettings {
  subtitles: boolean;
  highContrast: boolean;
  textSize: number; // 0.8 - 1.6, default 1.0
  movementMode: "teleport" | "smooth";
  postureMode: "seated" | "standing";
  reducedMotion: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  subtitles: true,
  highContrast: false,
  textSize: 1.0,
  movementMode: "teleport",
  postureMode: "seated",
  reducedMotion: false,
  soundEnabled: true,
};
