import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Search, Trash2 } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { StatusChip } from "../components/common/StatusChip";
import { Dialog } from "../components/common/Dialog";
import { useTrainingStore } from "../store/useTrainingStore";

type SortKey = "date" | "score";
type StatusFilter = "all" | "completed" | "exited" | "in-progress";

function formatDate(iso?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const currentUser = useTrainingStore((s) => s.currentUser);
  const sessions = useTrainingStore((s) => s.sessions);
  const activeSession = useTrainingStore((s) => s.activeSession);
  const clearAllSessions = useTrainingStore((s) => s.clearAllSessions);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [confirmClear, setConfirmClear] = useState(false);

  const mySessions = useMemo(() => {
    // Educators reviewing sessions need to see every trainee's attempts -
    // filtering to `s.userId === currentUser?.userId` here meant an
    // educator (signed in as Educator01) would only ever see sessions
    // belonging to "Educator01", which is never the account that actually
    // trains, so this page always looked empty for them.
    let list =
      currentUser?.role === "educator"
        ? sessions
        : sessions.filter((s) => s.userId === currentUser?.userId);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.scenarioName.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }

    list = [...list].sort((a, b) => {
      if (sortKey === "score") return b.finalScore - a.finalScore;
      return (b.endTime ?? b.startTime).localeCompare(a.endTime ?? a.startTime);
    });

    return list;
  }, [sessions, currentUser, search, statusFilter, sortKey]);

  return (
    <PageTransition>
      <AppHeader title="Session History" subtitle={`${mySessions.length} record(s)`} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <button
          onClick={() => navigate("/home")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={15} /> Back to menu
        </button>

        {activeSession && (
          <Card raised className="mb-6 flex items-center justify-between border-secondary/40">
            <div>
              <p className="text-sm font-semibold text-ink">Active session: {activeSession.scenarioName}</p>
              <p className="text-xs text-muted">
                {activeSession.completedTaskCount}/{activeSession.totalTaskCount} tasks complete
              </p>
            </div>
            <Button size="sm" icon={<Play size={14} />} onClick={() => navigate(`/training/${activeSession.scenarioId}`)}>
              Resume
            </Button>
          </Card>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <Search size={15} className="text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scenario..."
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="exited">Exited</option>
            <option value="in-progress">In progress</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="date">Sort by date</option>
            <option value="score">Sort by score</option>
          </select>
          {mySessions.length > 0 && (
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirmClear(true)}>
              Clear history
            </Button>
          )}
        </div>

        {mySessions.length === 0 ? (
          <Card className="py-16 text-center text-sm text-muted">
            No training attempts yet. Start a scenario to see your history here.
            <div className="mt-4">
              <Button onClick={() => navigate("/scenarios")}>Browse Scenarios</Button>
            </div>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-raised text-xs uppercase text-muted">
                <tr>
                  {currentUser?.role === "educator" && <th className="px-4 py-3">User</th>}
                  <th className="px-4 py-3">Scenario</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Mistakes</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {mySessions.map((s) => (
                  <tr
                    key={s.sessionId}
                    className="cursor-pointer border-t border-border bg-surface hover:bg-raised"
                    onClick={() => s.status === "completed" && navigate(`/feedback/${s.sessionId}`)}
                  >
                    {currentUser?.role === "educator" && <td className="px-4 py-3 text-ink">{s.userId}</td>}
                    <td className="px-4 py-3 text-ink">{s.scenarioName}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(s.endTime ?? s.startTime)}</td>
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
        title="Clear session history?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAllSessions();
                setConfirmClear(false);
              }}
            >
              Clear all
            </Button>
          </>
        }
      >
        This removes every saved training record from this browser. This cannot be undone.
      </Dialog>
    </PageTransition>
  );
}
