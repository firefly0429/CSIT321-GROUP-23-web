import type { SessionResult, TrainingTask } from "../types";
import { scenarios } from "../data/scenarios";

const DEMO_USERS = ["Trainee01", "Trainee02", "Trainee03", "Trainee04"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgoIso(days: number, hourOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + hourOffset, randomInt(0, 59), 0, 0);
  return d.toISOString();
}

/** Builds ~12 realistic-looking session records for the Ladder Inspection
 * scenario, spread across a few demo users and the last two weeks, so the
 * Educator Dashboard's charts and table are populated for a presentation
 * without needing anyone to actually play through the simulation first. */
export function generateDemoSessions(count = 12): SessionResult[] {
  const scenario = scenarios.find((s) => s.id === "ladder-inspection")!;
  const results: SessionResult[] = [];

  for (let i = 0; i < count; i++) {
    const user = DEMO_USERS[randomInt(0, DEMO_USERS.length - 1)];
    const mistakeCount = randomInt(0, 4);
    const completedAll = Math.random() > 0.15;
    const durationSeconds = randomInt(180, 520);

    const taskResults: TrainingTask[] = scenario.tasks.map((task, idx) => {
      const completed = completedAll || idx < scenario.tasks.length - randomInt(1, 2);
      return {
        ...task,
        completed,
        mistakes: Math.random() > 0.6 ? randomInt(0, 2) : 0,
        completionTime: completed ? randomInt(20, durationSeconds) : undefined,
      };
    });

    const completedScore = taskResults.reduce((sum, t) => sum + (t.completed ? t.maxScore : 0), 0);
    const finalScore = Math.max(0, Math.min(100, completedScore - mistakeCount * 5));
    const status: SessionResult["status"] = completedAll ? "completed" : Math.random() > 0.5 ? "exited" : "in-progress";

    const startTime = daysAgoIso(randomInt(0, 13), randomInt(0, 8));
    const endTime = new Date(new Date(startTime).getTime() + durationSeconds * 1000).toISOString();

    results.push({
      sessionId: `demo-${i}-${Math.random().toString(36).slice(2, 9)}`,
      userId: user,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      startTime,
      endTime: status !== "in-progress" ? endTime : undefined,
      durationSeconds,
      finalScore,
      maxPossibleScore: 100,
      completedTaskCount: taskResults.filter((t) => t.completed).length,
      totalTaskCount: taskResults.length,
      mistakeCount,
      passed: status === "completed" && finalScore >= scenario.passScore,
      status,
      taskResults,
      improvementNotes:
        mistakeCount > 0
          ? [`${mistakeCount} mistake(s) recorded - review the task order and try again.`]
          : ["No mistakes recorded - great work."],
      interactionLogs: [],
    });
  }

  return results;
}
