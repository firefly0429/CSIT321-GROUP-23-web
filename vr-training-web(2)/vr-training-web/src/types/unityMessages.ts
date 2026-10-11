import type { AccessibilitySettings, SessionResult } from './index';
export const CHANNEL = 'csit321-training';
export const PROTOCOL_VERSION = 1;
export type CommandType = 'START' | 'PAUSE' | 'RESUME' | 'EXIT' | 'SETTINGS';
export interface UnityCommand {
  channel: typeof CHANNEL; version: 1; type: CommandType; commandId: string;
  sessionId: string; scenarioId: string;
  settings?: AccessibilitySettings; session?: SessionResult;
}
export interface UnityEvent {
  channel: typeof CHANNEL; version: 1;
  type: 'TASK_COMPLETED' | 'MISTAKE' | 'SESSION_FINISHED' | 'XR_CHANGED' | 'PAUSED';
  eventId: string; sessionId: string; scenarioId: string; timestamp: string;
  taskId?: string; message?: string; immersive?: boolean;
}
export interface PlayerStatus {
  channel: typeof CHANNEL; version: 1; type: 'PLAYER_STATUS';
  loaded: boolean; integrated: boolean; scenarioId: string; supportsResume: boolean; error?: string;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function isUnityEvent(value: unknown): value is UnityEvent {
  if (!record(value) || value.channel !== CHANNEL || value.version !== 1) return false;
  if (!['TASK_COMPLETED','MISTAKE','SESSION_FINISHED','XR_CHANGED','PAUSED'].includes(String(value.type))) return false;
  for (const key of ['eventId','sessionId','scenarioId','timestamp']) {
    if (typeof value[key] !== 'string' || !value[key] || (value[key] as string).length > 160) return false;
  }
  if (!Number.isFinite(Date.parse(value.timestamp as string))) return false;
  if (['TASK_COMPLETED','MISTAKE'].includes(String(value.type)) && (typeof value.taskId !== 'string' || !value.taskId || value.taskId.length > 100)) return false;
  if (value.type === 'XR_CHANGED' && typeof value.immersive !== 'boolean') return false;
  return value.message === undefined || (typeof value.message === 'string' && value.message.length <= 1000);
}
export function isPlayerStatus(v: unknown): v is PlayerStatus {
  return record(v) && v.channel === CHANNEL && v.version === 1 && v.type === 'PLAYER_STATUS'
    && typeof v.loaded === 'boolean' && typeof v.integrated === 'boolean'
    && typeof v.scenarioId === 'string' && typeof v.supportsResume === 'boolean'
    && (v.error === undefined || typeof v.error === 'string');
}
