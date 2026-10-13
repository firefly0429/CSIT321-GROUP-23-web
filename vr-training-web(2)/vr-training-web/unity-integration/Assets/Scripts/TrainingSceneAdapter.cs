using UnityEngine;
using UnityEngine.Events;

// Wire these UnityEvents to your existing scene scripts in the Inspector.
// This adapter does not invent scene objects, grabbing logic or a WebXR camera rig.
public class TrainingSceneAdapter : MonoBehaviour
{
    [System.Serializable] public class TextEvent : UnityEvent<string> { }
    [System.Serializable] public class BoolEvent : UnityEvent<bool> { }
    [Tooltip("Enable ONLY after implementing and testing onRestoreJson for every task state.")]
    public bool supportsResume = false;
    public UnityEvent onReset;
    public TextEvent onRestoreJson;
    public TextEvent onSettingsJson;
    public BoolEvent onPaused;
    public UnityEvent onExit;
    public bool SupportsResume => supportsResume;
    public void Begin(TrainingEventBridge.Snapshot snapshot) {
        if (snapshot.completedTaskCount > 0 || snapshot.mistakeCount > 0) {
            if (!supportsResume) throw new System.InvalidOperationException("Restore is not configured.");
            onRestoreJson.Invoke(JsonUtility.ToJson(snapshot));
        } else onReset.Invoke();
    }
    public void SetPaused(bool paused) {
        // Also disable task input through onPaused. Unscaled XR input can continue at timeScale=0.
        Time.timeScale = paused ? 0f : 1f;
        onPaused.Invoke(paused);
    }
    public void ApplySettings(TrainingEventBridge.Settings settings) {
        if (settings == null) return;
        AudioListener.volume = settings.soundEnabled ? 1f : 0f;
        onSettingsJson.Invoke(JsonUtility.ToJson(settings));
    }
    public void End() { onExit.Invoke(); }
    private void OnDisable()
    {
        Time.timeScale = 1f;
    }
}
