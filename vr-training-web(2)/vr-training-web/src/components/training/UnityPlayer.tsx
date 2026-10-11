import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { SessionResult } from '../../types';
import type { CommandType, PlayerStatus } from '../../types/unityMessages';
import { UnityBridge } from '../../services/unityBridge';
import { useTrainingStore } from '../../store/useTrainingStore';
export interface UnityPlayerHandle { command: (type: CommandType) => Promise<void> }
interface Props { session: SessionResult; onReady: (ready: boolean) => void; onFinished: (id: string) => void }
export const UnityPlayer = forwardRef<UnityPlayerHandle, Props>(function UnityPlayer({ session, onReady, onFinished }, ref) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<UnityBridge>();
  const [status, setStatus] = useState<PlayerStatus>();
  const [slow, setSlow] = useState(false);
  const callbacks = useRef({ onReady, onFinished }); callbacks.current = { onReady, onFinished };
  const initial = useRef(session);
  const settings = useTrainingStore(s => s.settings);
  const ready = Boolean(status?.integrated && status.loaded && status.scenarioId === session.scenarioId &&
    (!(initial.current.completedTaskCount || initial.current.mistakeCount) || status.supportsResume));
  useImperativeHandle(ref, () => ({ command: type => {
    if (!bridge.current) return Promise.reject(new Error('Unity player has not loaded.'));
    return bridge.current.command(type, useTrainingStore.getState().settings);
  } }), []);
  useEffect(() => { callbacks.current.onReady(ready); }, [ready]);
  useEffect(() => {
    if (!iframe.current) return;
    const client = new UnityBridge(iframe.current, initial.current, setStatus, event => {
      const store = useTrainingStore.getState();
      const result = store.applyEvent(event);
      if (!result.accepted) store.reportError(result.reason ?? 'Unity event rejected.');
      if (result.accepted && event.type === 'SESSION_FINISHED') callbacks.current.onFinished(event.sessionId);
      return result;
    });
    bridge.current = client;
    const timer = setTimeout(() => setSlow(true), 25000);
    return () => { clearTimeout(timer); client.dispose(); bridge.current = undefined; };
  }, []);
  useEffect(() => {
    if (ready && session.runningSince) void bridge.current?.command('SETTINGS', settings).catch(e => useTrainingStore.getState().reportError(e.message));
  }, [settings, ready, session.runningSince]);
  return <div className="overflow-hidden rounded-xl border border-border bg-surface">
    <div className="p-3 text-sm text-muted" role="status">
      {status?.error ? status.error : ready ? 'Unity connected. Start training below, then use the player’s VR button if available.' :
        status?.integrated && status.scenarioId !== session.scenarioId ? `Scene mismatch: build reports ${status.scenarioId}. Expected ${session.scenarioId}.` :
        status?.integrated && !ready ? 'This build cannot restore a saved scene. Restart the attempt to continue safely.' :
        status?.loaded ? '3D player loaded. Training bridge is missing: import the supplied Unity scripts and rebuild before recording results.' :
        slow ? 'Unity is taking longer than expected. Check the build files and browser console.' : 'Loading Unity…'}
    </div>
    <iframe ref={iframe} title="Unity industrial safety training" src="/unity/index.html" className="h-[620px] w-full border-0" allow="fullscreen; xr-spatial-tracking; autoplay" allowFullScreen />
    <a href="/unity/index.html" target="_blank" rel="noreferrer" className="block p-3 text-xs text-secondary">Open standalone player for headset diagnostics (does not record this session)</a>
  </div>;
});
