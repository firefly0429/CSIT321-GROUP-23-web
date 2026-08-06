import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Database, Download, Gauge, Target, Trash2, Users } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { StatusChip } from "../components/common/StatusChip";
import { Dialog } from "../components/common/Dialog";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ScoreLineChart, PassFailDonut, ScenarioAverageBarChart, MistakesOverTimeChart } from "../components/dashboard/Charts";
import { useTrainingStore } from "../store/useTrainingStore";
import { sessionRepository } from "../services/sessionRepository";
import { generateDemoSessions } from "../services/demoDataService";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function EducatorDashboardPage() {
  const navigate = useNavigate();
  const sessions = useTrainingStore((s) => s.sessions);
  const seedDemoData = useTrainingStore((s) => s.seedDemoData);
  const clearDemoData = useTrainingStore((s) => s.clearDemoData);

  const [userFilter, setUserFilter] = useState("all");
  const [scenarioFilter, setScenarioFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const users = useMemo(() => Array.from(new Set(sessions.map((s) => s.userId))), [sessions]);
  const scenarioNames = useMemo(() => Array.from(new Set(sessions.map((s) => s.scenarioName))), [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (userFilter !== "all" && s.userId !== userFilter) return false;
      if (scenarioFilter !== "all" && s.scenarioName !== scenarioFilter) return false;
      if (statusFilter === "passed" && !(s.status === "completed" && s.passed)) return false;
      if (statusFilter === "failed" && !(s.status === "completed" && !s.passed)) return false;
      if (statusFilter !== "all" && statusFilter !== "passed" && statusFilter !== "failed" && s.status !== statusFilter) return false;
      if (startDate && new Date(s.startTime) < new Date(startDate)) return false;
      if (endDate && new Date(s.startTime) > new Date(`${endDate}T23:59:59`)) return false;
      return true;
    });
  }, [sessions, userFilter, scenarioFilter, statusFilter, startDate, endDate]);

  const avgScore = sessionRepository.calculateAverageScore(filtered);
  const avgDuration = sessionRepository.calculateAverageDuration(filtered);
  const completionRate = sessionRepository.calculateCompletionRate(filtered);
  const passRate = sessionRepository.calculatePassRate(filtered);
  const totalMistakes = filtered.reduce((sum, s) => sum + s.mistakeCount, 0);

  function handleGenerateDemoData() {
    seedDemoData(generateDemoSessions(12));
  }

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vr-training-sessions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageTransition>
      <AppHeader title="Educator Dashboard" subtitle={`${filtered.length} of ${sessions.length} session(s) shown`} />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/home")}>
            Back to menu
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Database size={14} />} onClick={handleGenerateDemoData}>
              Generate Demo Data
            </Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportJson}>
              Export JSON
            </Button>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirmClear(true)}>
              Clear Demo Data
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Total Sessions" value={String(filtered.length)} icon={<Users size={18} />} />
          <MetricCard label="Average Score" value={avgScore.toFixed(1)} icon={<Gauge size={18} />} accent="text-secondary" />
          <MetricCard label="Completion Rate" value={`${completionRate.toFixed(0)}%`} icon={<CheckCircle2 size={18} />} accent="text-success" />
          <MetricCard label="Pass Rate" value={`${passRate.toFixed(0)}%`} icon={<Target size={18} />} accent="text-primary" />
          <MetricCard label="Avg Duration" value={formatDuration(avgDuration)} icon={<Clock size={18} />} accent="text-warning" />
          <MetricCard label="Total Mistakes" value={String(totalMistakes)} icon={<Trash2 size={18} />} accent="text-danger" />
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ScoreLineChart sessions={filtered} />
          <PassFailDonut sessions={filtered} />
          <ScenarioAverageBarChart sessions={filtered} />
          <MistakesOverTimeChart sessions={filtered} />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="all">All users</option>
            {users.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <select value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="all">All scenarios</option>
            {scenarioNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="exited">Exited</option>
            <option value="in-progress">In progress</option>
            <option value="passed">Passed only</option>
            <option value="failed">Not passed only</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start date"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End date"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-xs text-muted hover:text-ink"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Session table */}
        {filtered.length === 0 ? (
          <Card className="py-16 text-center text-sm text-muted">
            No session data yet. Click "Generate Demo Data" to populate the dashboard for a presentation.
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-raised text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Scenario</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Mistakes</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => (b.endTime ?? b.startTime).localeCompare(a.endTime ?? a.startTime))
                  .map((s) => (
                    <tr key={s.sessionId} className="border-t border-border bg-surface">
                      <td className="px-4 py-3 text-ink">{s.userId}</td>
                      <td className="px-4 py-3 text-muted">{s.scenarioName}</td>
                      <td className="px-4 py-3 text-ink">{s.finalScore}/{s.maxPossibleScore}</td>
                      <td className="px-4 py-3 text-muted">{formatDuration(s.durationSeconds)}</td>
                      <td className="px-4 py-3 text-muted">{s.mistakeCount}</td>
                      <td className="px-4 py-3">
                        {s.status === "completed" ? (
                          <StatusChip kind={s.passed ? "success" : "warning"} label={s.passed ? "Passed" : "Not passed"} />
                        ) : s.status === "exited" ? (
                          <StatusChip kind="danger" label="Exited" />
                        ) : (
                          <StatusChip kind="info" label="In progress" />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear demo data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { clearDemoData(); setConfirmClear(false); }}>
              Clear demo data
            </Button>
          </>
        }
      >
        This removes only the generated demo sessions from this browser. Real trainee attempts are not affected.
      </Dialog>
    </PageTransition>
  );
}
