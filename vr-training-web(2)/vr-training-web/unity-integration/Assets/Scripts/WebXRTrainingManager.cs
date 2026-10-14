using UnityEngine;
// Package-neutral hooks: connect the installed exporter's XR state changes here.
// The exporter's own VR button must request immersive-vr directly from a user gesture.
public class WebXRTrainingManager : MonoBehaviour
{
  
    public TrainingEventBridge bridge;

    private void Awake()
    {
        if (bridge == null)
        {
            Debug.LogWarning("WebXRTrainingManager: TrainingEventBridge is not assigned.");
        }
    }

    public void OnEnterVR()
    {
        if (bridge != null)
            bridge.NotifyXRState(true);
    }

    public void OnExitVR()
    {
        if (bridge != null)
            bridge.NotifyXRState(false);
    }

    public void OnHeadsetPause()
    {
        if (bridge != null)
            bridge.PauseFromHeadset();
    }
}

}
