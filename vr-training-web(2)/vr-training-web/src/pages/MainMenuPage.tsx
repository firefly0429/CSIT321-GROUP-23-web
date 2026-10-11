import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { History, LayoutDashboard, ListChecks, Play, Settings as SettingsIcon } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { StatusChip } from "../components/common/StatusChip";
import { useTrainingStore } from "../store/useTrainingStore";

export default function MainMenuPage() {
  const navigate = useNavigate();
  const currentUser = useTrainingStore((s) => s.currentUser);
  const activeSession = useTrainingStore((s) => s.activeSession);
  const sessions = useTrainingStore((s) => s.sessions);

  const myCompletedSessions = sessions
    .filter((s) => s.userId === currentUser?.userId && s.status === "completed")
    .sort((a, b) => (b.endTime ?? "").localeCompare(a.endTime ?? ""));

  const latest = myCompletedSessions[0];

  if (currentUser?.role === "educator") {
    return (
      <PageTransition>
        <AppHeader title="Main Menu" subtitle="Desktop Demonstration Mode" />
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="text-xl font-semibold text-ink">Welcome back, {currentUser.userId}</h2>
          <p className="mt-1 text-sm text-muted">Review trainee performance or adjust your settings.</p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card raised className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/educator")}>
              <LayoutDashboard className="mb-3 text-primary" size={24} />
              <h3 className="font-semibold text-ink">Open Educator Dashboard</h3>
              <p className="mt-1 text-sm text-muted">Metrics, charts, and filterable session records.</p>
            </Card>
            <Card raised className="cursor-pointer hover:border-primary/50" onClick={() => navigate("/history")}>
              <History className="mb-3 text-secondary" size={24} />
              <h3 className="font-semibold text-ink">Review Sessions</h3>
              <p className="mt-1 text-sm text-muted">Browse individual training attempts.</p>
            </Card>
          </div>

          <div className="mt-6">
            <Button variant="ghost" icon={<SettingsIcon size={16} />} onClick={() => navigate("/settings")}>
              Settings
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <AppHeader title="VR Training Simulator" subtitle="Desktop Demonstration Mode" />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-ink"
        >
          Welcome back, {currentUser?.userId}
        </motion.h2>
        <p className="mt-1 text-sm text-muted">Select an option to begin.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card
            raised
            className="cursor-pointer border-primary/40 bg-gradient-to-br from-primary/10 to-transparent hover:border-primary sm:col-span-2"
            onClick={() => navigate(activeSession ? `/training/${activeSession.scenarioId}` : "/scenarios")}
          >
            <Play className="mb-3 text-primary" size={26} />
            <h3 className="text-lg font-semibold text-ink">
              {activeSession ? "Continue Training" : "Start Training"}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {activeSession
                ? `Resume "${activeSession.scenarioName}" - ${activeSession.completedTaskCount}/${activeSession.totalTaskCount} tasks done.`
                : "Choose a scenario and begin a new simulation."}
            </p>
          </Card>

          <Card raised className="cursor-pointer hover:border-secondary/60" onClick={() => navigate("/history")}>
            <History className="mb-3 text-secondary" size={22} />
            <h3 className="font-semibold text-ink">Session History</h3>
            <p className="mt-1 text-xs text-muted">Past attempts and scores.</p>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <ListChecks size={16} className="text-primary" /> Latest result
            </h3>
            {latest ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink">{latest.scenarioName}</p>
                  <p className="text-xs text-muted">Score {latest.finalScore}/{latest.maxPossibleScore}</p>
                </div>
                <StatusChip kind={latest.passed ? "success" : "warning"} label={latest.passed ? "Passed" : "Not passed"} />
              </div>
            ) : (
              <p className="text-sm text-muted">No completed attempts yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-ink">Account</h3>
            <p className="text-sm text-muted">
              Role: <span className="text-ink">{currentUser?.role}</span>
            </p>
            <p className="text-sm text-muted">
              User: <span className="text-ink">{currentUser?.userId}</span>
            </p>
            <div className="mt-3">
              <Button variant="ghost" size="sm" icon={<SettingsIcon size={14} />} onClick={() => navigate("/settings")}>
                Settings
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
