import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, History, RotateCcw, XCircle } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { StatusChip } from "../components/common/StatusChip";
import { useTrainingStore } from "../store/useTrainingStore";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FeedbackPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const sessions = useTrainingStore((s) => s.sessions);
  const user = useTrainingStore(s => s.currentUser);
  const session = sessions.find(s => s.sessionId === sessionId && (s.userId === user?.userId || user?.role === "educator"));

  if (!session) {
    return (
      <PageTransition>
        <AppHeader title="Feedback" />
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-muted">Session not found - it may not have been saved yet.</p>
          <Button className="mt-4" onClick={() => navigate("/history")}>
            View Session History
          </Button>
        </div>
      </PageTransition>
    );
  }

  const scorePct = session.maxPossibleScore > 0 ? (session.finalScore / session.maxPossibleScore) * 100 : 0;
  const ringColor = session.passed ? "#22C55E" : "#F59E0B";
  const circumference = 2 * Math.PI * 54;

  return (
    <PageTransition>
      <AppHeader title="Scenario Complete" subtitle={`${session.scenarioName} · ${session.source === "demo" ? "Demo result" : "Unity result"}`} />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card raised className="flex flex-col items-center py-10 text-center">
          <div className="relative mb-4 h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#33486A" strokeWidth="8" />
              <motion.circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - (circumference * scorePct) / 100 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-ink">{session.finalScore}</span>
              <span className="text-xs text-muted">/ {session.maxPossibleScore}</span>
            </div>
          </div>

          {session.passed ? (
            <StatusChip kind="success" label="Passed" />
          ) : (
            <StatusChip kind="warning" label="Needs Improvement" />
          )}
          <h2 className="mt-3 text-xl font-semibold text-ink">{session.scenarioName}</h2>
        </Card>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Card className="text-center">
            <p className="text-xs text-muted">Time taken</p>
            <p className="mt-1 text-lg font-semibold text-ink">{formatTime(session.durationSeconds)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-muted">Completed tasks</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {session.completedTaskCount}/{session.totalTaskCount}
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-muted">Mistakes</p>
            <p className="mt-1 text-lg font-semibold text-danger">{session.mistakeCount}</p>
          </Card>
        </div>

        <Card className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-ink">Per-task breakdown</h3>
          <ul className="space-y-2">
            {session.taskResults.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted">
                  {t.completed ? (
                    <CheckCircle2 size={15} className="text-success" />
                  ) : (
                    <XCircle size={15} className="text-danger" />
                  )}
                  {t.title}
                </span>
                <span className="text-ink">{t.completed ? t.maxScore : 0}/{t.maxScore}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-ink">What to improve</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            {session.improvementNotes.map((note, i) => (
              <li key={i}>&bull; {note}</li>
            ))}
          </ul>
        </Card>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" icon={<History size={15} />} onClick={() => navigate("/history")}>
            View Session History
          </Button>
          <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={() => navigate(`/briefing/${session.scenarioId}`)}>
            Retry Scenario
          </Button>
          <Button onClick={() => navigate("/home")}>Return to Main Menu</Button>
        </div>
      </div>
    </PageTransition>
  );
}
