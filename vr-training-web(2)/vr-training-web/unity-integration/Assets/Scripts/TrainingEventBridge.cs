using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

// One instance in the training scene. Object name must be exactly TrainingEventBridge.
public class TrainingEventBridge : MonoBehaviour
{
    public string scenarioId = "ladder-inspection";
    public TrainingSceneAdapter sceneAdapter;
    private string sessionId;
    private bool running;
    public bool IsRunning => running;
    private readonly Dictionary<string, string> acknowledgements = new Dictionary<string, string>();
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern void TrainingBridge_Emit(string json);
#endif
    [Serializable] public class Command {
        public string type, commandId, sessionId, scenarioId;
        public Snapshot session;
        public Settings settings;
    }
    [Serializable] public class Snapshot {
        public int completedTaskCount, mistakeCount;
        public TaskState[] taskResults;
    }
    [Serializable] public class TaskState { public string id; public bool completed; public int mistakes; }
    [Serializable] public class Settings {
        public bool subtitles, highContrast, reducedMotion, soundEnabled;
        public float textSize;
        public string movementMode, postureMode;
    }
    [Serializable] private class Packet {
        public string type, commandId, sessionId, scenarioId, eventId, timestamp, taskId, message;
        public bool ok, supportsResume, immersive;
    }
    private void Start() {
        gameObject.name = "TrainingEventBridge";
        if (sceneAdapter == null) { Debug.LogError("Assign a TrainingSceneAdapter before exporting."); return; }
        sceneAdapter.SetPaused(true);
        Emit(new Packet { type = "BRIDGE_READY", scenarioId = scenarioId, supportsResume = sceneAdapter.SupportsResume });
    }
    private void Emit(Packet packet) {
        EmitJson(JsonUtility.ToJson(packet));
    }
    private void EmitJson(string json) {
#if UNITY_WEBGL && !UNITY_EDITOR
        TrainingBridge_Emit(json);
#else
        Debug.Log(json);
#endif
    }
    public void OnCommand(string json) {
        Command c;
        try { c = JsonUtility.FromJson<Command>(json); } catch { return; }
        if (c == null || string.IsNullOrEmpty(c.commandId) || c.scenarioId != scenarioId || sceneAdapter == null) return;
        if (acknowledgements.TryGetValue(c.commandId, out var previous)) { EmitJson(previous); return; }
        var ack = new Packet { type = "COMMAND_ACK", commandId = c.commandId, sessionId = c.sessionId, scenarioId = scenarioId, ok = true };
        try {
            if (c.type == "START") {
                if (!string.IsNullOrEmpty(sessionId) && sessionId != c.sessionId) throw new InvalidOperationException("Reload player before starting another attempt.");
                if (c.session == null) throw new InvalidOperationException("Missing session snapshot.");
                if ((c.session.completedTaskCount > 0 || c.session.mistakeCount > 0) && !sceneAdapter.SupportsResume)
                    throw new InvalidOperationException("Scene cannot restore progress; restart the attempt.");
                sceneAdapter.Begin(c.session);
                sessionId = c.sessionId;
                sceneAdapter.ApplySettings(c.settings);
                running = true; sceneAdapter.SetPaused(false);
            } else {
                if (sessionId != c.sessionId) throw new InvalidOperationException("No matching active session.");
                switch (c.type) {
                    case "PAUSE": running = false; sceneAdapter.SetPaused(true); break;
                    case "RESUME": running = true; sceneAdapter.SetPaused(false); break;
                    case "EXIT": running = false; sceneAdapter.SetPaused(true); sceneAdapter.End(); break;
                    case "SETTINGS": sceneAdapter.ApplySettings(c.settings); break;
                    default: throw new InvalidOperationException("Unknown command.");
                }
            }
        } catch (Exception e) { ack.ok = false; ack.message = e.Message; running = false; sceneAdapter.SetPaused(true); }
        string payload = JsonUtility.ToJson(ack);
        acknowledgements[c.commandId] = payload; EmitJson(payload);
    }
    private void TrainingEvent(string type, string taskId = null, string message = null, bool immersive = false) {
        if (string.IsNullOrEmpty(sessionId)) return;
        if (!running && (type == "TASK_COMPLETED" || type == "MISTAKE" || type == "SESSION_FINISHED")) return;
        Emit(new Packet { type = type, sessionId = sessionId, scenarioId = scenarioId, eventId = Guid.NewGuid().ToString(), timestamp = DateTime.UtcNow.ToString("o"), taskId = taskId, message = message, immersive = immersive });
    }
    // Connect these to REAL successful scene interactions, not a per-frame callback.
    public void CompleteTask(string taskId) { TrainingEvent("TASK_COMPLETED", taskId); }
    public void RecordMistake(string taskId) { TrainingEvent("MISTAKE", taskId, "Incorrect training action."); }
    public void FinishTraining() { TrainingEvent("SESSION_FINISHED"); running = false; sceneAdapter.SetPaused(true); }
    public void NotifyXRState(bool immersive) {
        TrainingEvent("XR_CHANGED", immersive: immersive);
        if (!immersive) { running = false; sceneAdapter.SetPaused(true); }
    }
    public void PauseFromHeadset() { TrainingEvent("PAUSED"); running = false; sceneAdapter.SetPaused(true); }
    public void OnEventRejected(string json) {
        PauseFromHeadset();
        Debug.LogWarning("Training event rejected; check the website and task order. " + json);
    }
    private void OnDestroy() { Time.timeScale = 1f; }
}
