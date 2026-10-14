using System.Collections.Generic;
using UnityEngine;

// Connect verified interaction success to CompleteTask(taskId).
// Do not award success merely because an object was clicked.
public class TrainingScoring : MonoBehaviour
{
    public TrainingEventBridge bridge;
    private readonly string[] order = { "inspect-area", "wear-equipment", "secure-ladder", "inspect-rungs", "confirm-inspection" };
    private readonly HashSet<string> completed = new HashSet<string>();
    public void ResetProgress() { completed.Clear(); }
    public void RestoreProgress(string json) {
        completed.Clear();
        var snapshot = JsonUtility.FromJson<TrainingEventBridge.Snapshot>(json);
        if (snapshot?.taskResults == null) return;
        
foreach (var task in snapshot.taskResults)
{
    if (task != null &&
        task.completed &&
        !string.IsNullOrEmpty(task.id) &&
        System.Array.IndexOf(order, task.id) >= 0)
    {
        completed.Add(task.id);
    }
}

    }
    public void CompleteTask(string taskId) {
        if (bridge == null || !bridge.IsRunning || completed.Contains(taskId)) return;
        var index = System.Array.IndexOf(order, taskId);
        if (index < 0) { Debug.LogWarning("Unknown task: " + taskId); return; }
        for (var i = 0; i < index; i++) if (!completed.Contains(order[i])) {
            bridge.RecordMistake(order[i]); return;
        }
        completed.Add(taskId); bridge.CompleteTask(taskId);
        if (completed.Count == order.Length) bridge.FinishTraining();
    }
    public void RecordCurrentMistake() {
        if (bridge == null || !bridge.IsRunning) return;
        foreach (var taskId in order) if (!completed.Contains(taskId)) { bridge.RecordMistake(taskId); return; }
    }
}
