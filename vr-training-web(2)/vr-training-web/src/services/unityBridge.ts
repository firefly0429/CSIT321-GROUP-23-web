import { CHANNEL, isPlayerStatus, isUnityEvent, type CommandType, type PlayerStatus, type UnityCommand, type UnityEvent } from '../types/unityMessages';
import type { AccessibilitySettings, SessionResult } from '../types';
/** A bridge is scoped to one iframe Window and one attempt. No wildcard origins. */
export class UnityBridge {
  private pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setInterval> }>();
  private hello: ReturnType<typeof setInterval>;
  constructor(private frame: HTMLIFrameElement, private session: SessionResult,
    private status: (s: PlayerStatus) => void, private event: (e: UnityEvent) => { accepted: boolean; reason?: string }) {
    window.addEventListener('message', this.receive);
    this.hello = setInterval(() => this.post({ channel: CHANNEL, version: 1, type: 'HELLO' }), 1000);
    this.post({ channel: CHANNEL, version: 1, type: 'HELLO' });
  }
  private post = (message: unknown) => this.frame.contentWindow?.postMessage(message, window.location.origin);
  private receive = (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== this.frame.contentWindow) return;
    const data = e.data;
    if (isPlayerStatus(data)) { this.status(data); return; }
    if (data?.channel !== CHANNEL || data?.version !== 1 || data?.sessionId !== this.session.sessionId || data?.scenarioId !== this.session.scenarioId) return;
    if (data.type === 'COMMAND_ACK' && typeof data.commandId === 'string') {
      const item = this.pending.get(data.commandId);
      if (!item) return;
      clearInterval(item.timer); this.pending.delete(data.commandId);
      if (data.ok === true) item.resolve(); else item.reject(new Error(typeof data.message === 'string' ? data.message : 'Unity rejected the command.'));
      return;
    }
    if (isUnityEvent(data)) {
      try {
        const result = this.event(data);
        this.post({ channel: CHANNEL, version: 1, type: 'EVENT_ACK', sessionId: data.sessionId, eventId: data.eventId, ...result });
      } catch {
        // No acknowledgement if persistence failed: Unity will retry the same event ID.
      }
    }
  };
  command(type: CommandType, settings?: AccessibilitySettings): Promise<void> {
    const command: UnityCommand = { channel: CHANNEL, version: 1, type, commandId: crypto.randomUUID(), sessionId: this.session.sessionId, scenarioId: this.session.scenarioId, settings };
    if (type === 'START') command.session = this.session;
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const send = () => {
        if (++attempts > 5) { clearInterval(timer); this.pending.delete(command.commandId); reject(new Error(`${type} was not acknowledged by Unity. Check the integration scripts.`)); return; }
        this.post(command);
      };
      const timer = setInterval(send, 1500);
      this.pending.set(command.commandId, { resolve, reject, timer }); send();
    });
  }
  dispose() {
    clearInterval(this.hello); window.removeEventListener('message', this.receive);
    this.pending.forEach(p => { clearInterval(p.timer); p.reject(new Error('Player closed.')); }); this.pending.clear();
  }
}
