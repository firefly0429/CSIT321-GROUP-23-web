import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, ListChecks } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { StatusChip } from "../components/common/StatusChip";
import { Button } from "../components/common/Button";
import { scenarios, getDomains } from "../data/scenarios";
import { useTrainingStore } from "../store/useTrainingStore";

export default function ScenarioSelectionPage() {
  const navigate = useNavigate();
  const currentUser = useTrainingStore((s) => s.currentUser);
  const sessions = useTrainingStore((s) => s.sessions);
  const selectScenario = useTrainingStore((s) => s.selectScenario);

  const domains = getDomains();

  function progressFor(scenarioId: string) {
    const attempts = sessions.filter((s) => s.userId === currentUser?.userId && s.scenarioId === scenarioId);
    if (attempts.length === 0) return null;
    const best = attempts.reduce((a, b) => (b.finalScore > a.finalScore ? b : a));
    return best;
  }

  function handleSelect(scenarioId: string, available: boolean) {
    if (!available) return;
    selectScenario(scenarioId);
    navigate(`/briefing/${scenarioId}`);
  }

  return (
    <PageTransition>
      <AppHeader title="Select Training Domain" subtitle="Choose a scenario to begin" />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <button
          onClick={() => navigate("/home")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={15} /> Back to menu
        </button>

        {domains.map((domain) => (
          <section key={domain} className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-ink">{domain}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scenarios
                .filter((s) => s.domain === domain)
                .map((s) => {
                  const progress = progressFor(s.id);
                  return (
                    <Card
                      key={s.id}
                      raised
                      onClick={() => handleSelect(s.id, s.available)}
                      className={`flex flex-col gap-3 transition-all ${
                        s.available
                          ? "cursor-pointer hover:-translate-y-1 hover:border-primary/50"
                          : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h3 className="text-base font-semibold text-ink">{s.name}</h3>
                        {s.available ? (
                          <StatusChip kind="success" label="Available" />
                        ) : (
                          <StatusChip kind="locked" label="Coming Soon" />
                        )}
                      </div>
                      <p className="text-sm text-muted">
                        {s.available ? s.description : "Content ready for future Unity integration."}
                      </p>
                      {s.available && (
                        <div className="flex items-center gap-4 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock size={13} /> ~{s.estimatedMinutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <ListChecks size={13} /> {s.tasks.length} tasks
                          </span>
                          <span>{s.difficulty}</span>
                        </div>
                      )}
                      {progress && (
                        <p className="text-xs text-secondary">
                          Best attempt: {progress.finalScore}/{progress.maxPossibleScore} (
                          {progress.passed ? "Passed" : "Not passed"})
                        </p>
                      )}
                    </Card>
                  );
                })}
            </div>
          </section>
        ))}

        <Button variant="ghost" onClick={() => navigate("/home")}>
          Return to Main Menu
        </Button>
      </div>
    </PageTransition>
  );
}
