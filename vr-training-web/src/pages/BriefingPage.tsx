import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Gamepad2, ShieldAlert, Target } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { getScenarioById } from "../data/scenarios";
import { useTrainingStore } from "../store/useTrainingStore";

export default function BriefingPage() {
  const { scenarioId } = useParams();
  const navigate = useNavigate();
  const scenario = getScenarioById(scenarioId);
  const startSession = useTrainingStore((s) => s.startSession);

  if (!scenario) {
    return (
      <PageTransition>
        <AppHeader title="Scenario Briefing" />
        <div className="mx-auto max-w-2xl px-6 py-16 text-center">
          <p className="text-muted">Scenario not found.</p>
          <Button className="mt-4" onClick={() => navigate("/scenarios")}>
            Back to Scenario Selection
          </Button>
        </div>
      </PageTransition>
    );
  }

  function handleStart() {
    if (!scenario) return;
    startSession(scenario.id);
    navigate(`/training/${scenario.id}`);
  }

  return (
    <PageTransition>
      <AppHeader title={scenario.name} subtitle={`${scenario.domain} \u2022 ${scenario.difficulty}`} />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button
          onClick={() => navigate("/scenarios")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <Card raised className="mb-6">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Clock size={15} /> ~{scenario.estimatedMinutes} minutes
            </span>
            <span>{scenario.tasks.length} tasks</span>
            <span>Pass score: {scenario.passScore}/100</span>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Target size={16} className="text-primary" /> Training objectives
            </h3>
            <ul className="space-y-2 text-sm text-muted">
              {scenario.objectives.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">{i + 1}.</span> {o}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Gamepad2 size={16} className="text-secondary" /> Controls
            </h3>
            <ul className="space-y-2 text-sm text-muted">
              {scenario.controls.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldAlert size={16} className="text-warning" /> Safety instructions
          </h3>
          <p className="text-sm text-muted">{scenario.safetyInstructions}</p>
        </Card>

        <Card className="mt-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <CheckCircle2 size={16} className="text-primary" /> Task list
          </h3>
          <ol className="space-y-2">
            {scenario.tasks.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 text-sm text-muted">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-xs text-ink">
                  {i + 1}
                </span>
                {t.title}
              </li>
            ))}
          </ol>
        </Card>

        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={handleStart}>
            Start Simulation
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
