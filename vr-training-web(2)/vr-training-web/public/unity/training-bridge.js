/* Include in the final WebXR template BEFORE createUnityInstance. Never handles auth tokens. */
(() => {
  'use strict';
  const channel = 'csit321-training';
  let instance = null, loaded = false, integrated = false, scenarioId = '', supportsResume = false;
  let error = '', current = null;
  const pendingEvents = new Map(), commandAcks = new Map();
  function post(data) { if (parent !== window) parent.postMessage({ channel, version: 1, ...data }, location.origin); }
  function status() { post({ type: 'PLAYER_STATUS', loaded, integrated, scenarioId, supportsResume, error }); }
  function show(message) { const el = document.getElementById('training-status'); if (el) el.textContent = message; }
  window.TrainingHost = {
    attach(unityInstance) { instance = unityInstance; loaded = true; status(); show(integrated ? 'Training bridge ready.' : '3D loaded. Import the training bridge into Unity and rebuild to record results.'); },
    fail(message) { error = String(message); status(); show(error); },
    // Called by TrainingBridge.jslib. Only explicit C# readiness enables training.
    fromUnity(json) {
      let data; try { data = JSON.parse(json); } catch { return; }
      if (data.type === 'BRIDGE_READY') {
        integrated = true; scenarioId = data.scenarioId; supportsResume = data.supportsResume === true;
        error = ''; status(); show('Training bridge ready. Start training from the website.'); return;
      }
      if (!current || data.sessionId !== current.sessionId || data.scenarioId !== current.scenarioId) return;
      if (data.type === 'COMMAND_ACK') { commandAcks.set(data.commandId, data); post(data); return; }
      if (['TASK_COMPLETED','MISTAKE','SESSION_FINISHED','XR_CHANGED','PAUSED'].includes(data.type)) {
        data.timestamp = new Date().toISOString();
        if (data.message == null) delete data.message;
        if (data.taskId == null) delete data.taskId;
        pendingEvents.set(data.eventId, data); post(data);
      }
    }
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || parent === window) return;
    const data = event.data;
    if (!data || data.channel !== channel || data.version !== 1) return;
    if (data.type === 'HELLO') { status(); return; }
    if (data.type === 'EVENT_ACK' && current && data.sessionId === current.sessionId) {
      pendingEvents.delete(data.eventId);
      if (data.accepted === false) {
        show(`Website rejected an event: ${data.reason || 'invalid state'}`);
        instance?.SendMessage('TrainingEventBridge', 'OnEventRejected', JSON.stringify(data));
      }
      return;
    }
    if (!['START','PAUSE','RESUME','EXIT','SETTINGS'].includes(data.type) || typeof data.commandId !== 'string' || typeof data.sessionId !== 'string') return;
    if (!integrated || !instance || data.scenarioId !== scenarioId) return;
    if (commandAcks.has(data.commandId)) { post(commandAcks.get(data.commandId)); return; }
    if (data.type === 'START') {
      if (current && current.sessionId !== data.sessionId) return;
      current = { sessionId: data.sessionId, scenarioId: data.scenarioId };
    }
    if (!current || current.sessionId !== data.sessionId) return;
    try { instance.SendMessage('TrainingEventBridge', 'OnCommand', JSON.stringify(data)); }
    catch (e) { window.TrainingHost.fail(e.message); }
  });
  setInterval(() => pendingEvents.forEach(post), 1500);
  async function checkXR() {
    const el = document.getElementById('xr-status'); if (!el) return;
    if (!isSecureContext) { el.textContent = 'VR requires HTTPS (or localhost for development).'; return; }
    try {
      const supported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr');
      el.textContent = supported ? 'Browser supports immersive VR. The Unity build must also include WebXR; use its native VR button.' : 'Immersive VR is unavailable in this browser/device. Desktop 3D may still work.';
    } catch { el.textContent = 'VR capability check failed. Check browser permissions.'; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkXR); else void checkXR();
})();
