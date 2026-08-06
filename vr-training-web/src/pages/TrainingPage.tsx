import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  HardHat,
  Lock,
  Pause,
  RotateCcw,
  LogOut,
  Unlock,
  X,
} from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { ProgressBar } from "../components/common/ProgressBar";
import { Dialog } from "../components/common/Dialog";
import { useToast } from "../components/common/Toast";
import { sound } from "../lib/sound";
import { getScenarioById } from "../data/scenarios";
import { useTrainingStore } from "../store/useTrainingStore";

const RUNG_COUNT = 5;
const DAMAGED_RUNG = 3; // 1-indexed - rung 3 is damaged

type RungAnswer = "unchecked" | "safe" | "damaged";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Explicitly typed to avoid Object.fromEntries inferring a loose
 * (string | number)[] shape from the mixed-type array literal, which can
 * fail to satisfy Record<number, RungAnswer> under strict mode. */
function createInitialRungAnswers(): Record<number, RungAnswer> {
  const result: Record<number, RungAnswer> = {};
  for (let i = 1; i <= RUNG_COUNT; i++) {
    result[i] = "unchecked";
  }
  return result;
}

export default function TrainingPage() {
  const { scenarioId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  /** Wraps showToast so every success/warning toast also plays the
   * matching tone when Sound Effects is enabled, instead of the setting
   * having no observable effect anywhere in the app. */
  function notify(kind: "success" | "warning" | "info", message: string) {
    showToast(kind, message);
    if (!settings.soundEnabled) return;
    if (kind === "success") sound.success();
    if (kind === "warning") sound.mistake();
  }

  const scenario = getScenarioById(scenarioId);
  const activeSession = useTrainingStore((s) => s.activeSession);
  const isPaused = useTrainingStore((s) => s.isPaused);
  const settings = useTrainingStore((s) => s.settings);
  const completeTask = useTrainingStore((s) => s.completeTask);
  const recordMistake = useTrainingStore((s) => s.recordMistake);
  const pauseSession = useTrainingStore((s) => s.pauseSession);
  const resumeSession = useTrainingStore((s) => s.resumeSession);
  const restartSession = useTrainingStore((s) => s.restartSession);
  const exitSession = useTrainingStore((s) => s.exitSession);
  const finishSession = useTrainingStore((s) => s.finishSession);
  const resumeActiveSession = useTrainingStore((s) => s.resumeActiveSession);
  const selectScenario = useTrainingStore((s) => s.selectScenario);

  // --- scene-local interactive state ---
  const [hazardRemoved, setHazardRemoved] = useState(false);
  const [helmetWorn, setHelmetWorn] = useState(false);
  const [leftLock, setLeftLock] = useState(false);
  const [rightLock, setRightLock] = useState(false);
  const [rungAnswers, setRungAnswers] = useState<Record<number, RungAnswer>>(createInitialRungAnswers());
  const [activeRung, setActiveRung] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Resume an in-progress session on refresh / direct navigation, or bounce
  // back to Briefing if there is genuinely nothing to train.
  useEffect(() => {
    if (!activeSession && scenarioId) {
      resumeActiveSession();
    }
    if (scenario) selectScenario(scenario.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeSession || activeSession.scenarioId !== scenarioId) return;
    if (isPaused) return;
    const interval = setInterval(() => {
      setElapsed((Date.now() - new Date(activeSession.startTime).getTime()) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession, isPaused, scenarioId]);

  // Restore the *visual* scene state to match persisted task data.
  // completeTask()/recordMistake() already persist task completion to
  // localStorage, so the checklist survives a refresh - but hazardRemoved,
  // helmetWorn, leftLock/rightLock, and rungAnswers only ever lived in
  // this component's own useState, so a refresh previously left the
  // checklist showing tasks as done while the hazard cone, helmet, locks,
  // and rungs all visually reset to their starting state. This keyed on
  // sessionId (not the whole activeSession object, which changes on every
  // task/mistake) so it only re-runs when a genuinely different session
  // is loaded, not on every keystroke of progress within the same one.
  useEffect(() => {
    if (!activeSession) return;

    const completedIds = new Set(activeSession.taskResults.filter((t) => t.completed).map((t) => t.id));

    setHazardRemoved(completedIds.has("inspect-area"));
    setHelmetWorn(completedIds.has("wear-equipment"));

    if (completedIds.has("secure-ladder")) {
      setLeftLock(true);
      setRightLock(true);
    }

    if (completedIds.has("inspect-rungs")) {
      // Reconstruct the correct answer for every rung from the same
      // DAMAGED_RUNG constant the scoring logic uses, rather than
      // hardcoding a duplicate copy of the answer key that could drift
      // out of sync with it.
      const restored: Record<number, RungAnswer> = {};
      for (let i = 1; i <= RUNG_COUNT; i++) {
        restored[i] = i === DAMAGED_RUNG ? "damaged" : "safe";
      }
      setRungAnswers(restored);
    }
    // Only re-run when the underlying attempt changes, not on every
    // in-session task/mistake update to activeSession.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.sessionId]);

  const currentTaskId = useMemo(() => {
    if (!activeSession) return null;
    const next = activeSession.taskResults.find((t) => !t.completed);
    return next?.id ?? null;
  }, [activeSession]);

  if (!scenario) {
    return (
      <PageTransition>
        <AppHeader title="Training" />
        <div className="mx-auto max-w-xl px-6 py-16 text-center text-muted">Scenario not found.</div>
      </PageTransition>
    );
  }

  if (!activeSession || activeSession.scenarioId !== scenario.id) {
    return (
      <PageTransition>
        <AppHeader title={scenario.name} />
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <p className="text-muted">No active session for this scenario yet.</p>
          <Button className="mt-4" onClick={() => navigate(`/briefing/${scenario.id}`)}>
            Go to Briefing
          </Button>
        </div>
      </PageTransition>
    );
  }

  function warnEarly(taskLabel: string) {
    recordMistake(currentTaskId!, `Warning: ${taskLabel} first.`);
    notify("warning", `Warning: ${taskLabel} first.`);
  }

  // --- Task 1: hazard ---
  function handleHazardClick() {
    if (currentTaskId !== "inspect-area") return;
    setHazardRemoved(true);
    completeTask("inspect-area");
    notify("success", "Hazard removed. Area is clear.");
  }

  // --- Task 2: helmet drag ---
  function handleHelmetDragEnd(_e: unknown, info: { point: { x: number; y: number } }) {
    if (currentTaskId === "inspect-area") {
      warnEarly("Inspect the surrounding area");
      return;
    }
    if (currentTaskId !== "wear-equipment") return;

    const zone = dropZoneRef.current?.getBoundingClientRect();
    if (!zone) return;
    const inZone =
      info.point.x >= zone.left && info.point.x <= zone.right && info.point.y >= zone.top && info.point.y <= zone.bottom;

    if (inZone) {
      setHelmetWorn(true);
      completeTask("wear-equipment");
      notify("success", "Safety helmet worn correctly.");
    } else {
      recordMistake("wear-equipment", "Drag the helmet onto the trainee to wear it.");
      notify("warning", "Drag the helmet onto the trainee to wear it.");
    }
  }

  // --- Task 3: locks ---
  function toggleLock(side: "left" | "right") {
    if (currentTaskId === "inspect-area") return warnEarly("Inspect the surrounding area");
    if (currentTaskId === "wear-equipment") return warnEarly("Wear your safety equipment");
    if (currentTaskId !== "secure-ladder") return;

    const nextLeft = side === "left" ? !leftLock : leftLock;
    const nextRight = side === "right" ? !rightLock : rightLock;
    if (side === "left") setLeftLock(nextLeft);
    else setRightLock(nextRight);

    if (nextLeft && nextRight) {
      completeTask("secure-ladder");
      notify("success", "Ladder secured on both sides.");
    }
  }

  // --- Task 4: rungs ---
  function selectRung(rung: number) {
    if (currentTaskId === "inspect-area") return warnEarly("Inspect the surrounding area");
    if (currentTaskId === "wear-equipment") return warnEarly("Wear your safety equipment");
    if (currentTaskId === "secure-ladder") return warnEarly("Secure the ladder");
    if (currentTaskId !== "inspect-rungs") return;
    setActiveRung(rung);
  }

  function answerRung(rung: number, answer: "safe" | "damaged") {
    const correct = rung === DAMAGED_RUNG ? "damaged" : "safe";
    if (answer !== correct) {
      recordMistake("inspect-rungs", `Rung ${rung} was marked incorrectly.`);
      notify("warning", `Incorrect - look more closely at rung ${rung}.`);
      return;
    }

    const updated = { ...rungAnswers, [rung]: answer as RungAnswer };
    setRungAnswers(updated);
    setActiveRung(null);
    notify("success", `Rung ${rung} inspected correctly.`);

    const allDone = Object.values(updated).every((v) => v !== "unchecked");
    if (allDone) {
      completeTask("inspect-rungs");
    }
  }

  // --- Task 5: confirm ---
  function handleConfirmInspection() {
    if (currentTaskId !== "confirm-inspection") return;
    completeTask("confirm-inspection");
    const finished = finishSession();
    if (finished) {
      navigate(`/feedback/${finished.sessionId}`);
    }
  }

  function handleHint() {
    if (!activeSession) return;
    const task = activeSession.taskResults.find((t) => t.id === currentTaskId);
    notify("info", task ? task.description : "All tasks complete - review and confirm.");
  }

  function handleExit() {
    exitSession();
    navigate("/home");
  }

  function handleRestart() {
    setHazardRemoved(false);
    setHelmetWorn(false);
    setLeftLock(false);
    setRightLock(false);
    setRungAnswers(createInitialRungAnswers());
    setActiveRung(null);
    setElapsed(0);
    restartSession();
    setConfirmRestart(false);
    setShowPauseMenu(false);
  }

  const allRequiredDoneBeforeConfirm = activeSession.taskResults
    .filter((t) => t.id !== "confirm-inspection")
    .every((t) => t.completed);

  return (
    <PageTransition>
      <AppHeader title={scenario.name} subtitle="Training Simulation" />

      {/* HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/60 px-6 py-3 text-sm">
        <div className="flex items-center gap-5">
          <span className="text-muted">
            Time <span className="font-mono text-ink">{formatTime(elapsed)}</span>
          </span>
          <span className="text-muted">
            Score <span className="font-semibold text-primary">{activeSession.finalScore}</span>
          </span>
          <span className="text-muted">
            Mistakes <span className="font-semibold text-danger">{activeSession.mistakeCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<CircleHelp size={15} />} onClick={handleHint}>
            Hint
          </Button>
          <Button variant="secondary" size="sm" icon={<Pause size={15} />} onClick={() => { pauseSession(); setShowPauseMenu(true); }}>
            Pause
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[1fr_320px]">
        {/* Training area */}
        <Card raised className="relative min-h-[420px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 via-transparent to-primary/5" />
          {!settings.reducedMotion && (
            <motion.div
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent"
              animate={{ y: [0, 400, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
          )}

          <div className="relative flex h-full flex-col items-center justify-center gap-8 py-10">
            {/* Hazard */}
            {!hazardRemoved && (
              <motion.button
                onClick={handleHazardClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={settings.reducedMotion ? {} : { y: [0, -4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="absolute bottom-8 left-8 flex flex-col items-center gap-1"
                aria-label="Floor hazard"
              >
                <AlertTriangle className="text-warning drop-shadow-glow" size={40} />
                <span className="rounded bg-warning/20 px-2 py-0.5 text-xs text-warning">Hazard</span>
              </motion.button>
            )}

            {/* Trainee + helmet drop zone */}
            <div className="flex items-center gap-10">
              <div
                ref={dropZoneRef}
                className={`flex h-28 w-24 flex-col items-center justify-end rounded-xl border-2 border-dashed ${
                  helmetWorn ? "border-success bg-success/10" : "border-border"
                }`}
              >
                <div className="mb-1 text-xs text-muted">{helmetWorn ? "Equipped" : "Trainee"}</div>
                {helmetWorn && <HardHat className="mb-2 text-success" size={26} />}
                <div className="h-16 w-6 rounded-t-full bg-raised" />
              </div>

              {!helmetWorn && (
                <motion.div
                  drag
                  dragMomentum={false}
                  onDragEnd={handleHelmetDragEnd}
                  whileDrag={{ scale: 1.1 }}
                  className="flex cursor-grab flex-col items-center gap-1 active:cursor-grabbing"
                >
                  <HardHat className="text-secondary" size={34} />
                  <span className="text-xs text-muted">Drag to trainee</span>
                </motion.div>
              )}
            </div>

            {/* Ladder with locks and rungs */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleLock("left")}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                    leftLock ? "border-success/50 bg-success/10 text-success" : "border-border text-muted hover:text-ink"
                  }`}
                >
                  {leftLock ? <Lock size={13} /> : <Unlock size={13} />} Left lock
                </button>

                <div className="grid grid-cols-1 gap-1.5">
                  {Array.from({ length: RUNG_COUNT }, (_, i) => i + 1).map((rung) => {
                    const answer = rungAnswers[rung];
                    return (
                      <button
                        key={rung}
                        onClick={() => selectRung(rung)}
                        className={`h-3 w-40 rounded-full border transition-colors ${
                          answer === "unchecked"
                            ? "border-border bg-raised hover:border-secondary"
                            : answer === "safe"
                              ? "border-success/50 bg-success/20"
                              : "border-danger/50 bg-danger/20"
                        }`}
                        aria-label={`Rung ${rung}`}
                      />
                    );
                  })}
                </div>

                <button
                  onClick={() => toggleLock("right")}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                    rightLock ? "border-success/50 bg-success/10 text-success" : "border-border text-muted hover:text-ink"
                  }`}
                >
                  {rightLock ? <Lock size={13} /> : <Unlock size={13} />} Right lock
                </button>
              </div>
              <p className="text-xs text-muted">Click a rung to inspect it</p>
            </div>
          </div>

          {/* Rung answer popover */}
          {activeRung !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-2xl"
            >
              <span className="text-sm text-ink">Rung {activeRung}:</span>
              <Button size="sm" variant="secondary" onClick={() => answerRung(activeRung, "safe")}>
                Safe
              </Button>
              <Button size="sm" variant="danger" onClick={() => answerRung(activeRung, "damaged")}>
                Damaged
              </Button>
              <button onClick={() => setActiveRung(null)} className="text-muted hover:text-ink">
                <X size={16} />
              </button>
            </motion.div>
          )}

          {/* Task 5 confirmation panel */}
          {currentTaskId === "confirm-inspection" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-6 bottom-6 rounded-xl border border-primary/40 bg-surface/95 p-4"
            >
              <h4 className="mb-2 text-sm font-semibold text-ink">Final inspection checklist</h4>
              <ul className="mb-3 space-y-1 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className={hazardRemoved ? "text-success" : "text-muted"} /> Area clear
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className={helmetWorn ? "text-success" : "text-muted"} /> Safety equipment worn
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className={leftLock && rightLock ? "text-success" : "text-muted"} /> Ladder secured
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-success" /> Rungs inspected
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-success" /> Damage identified
                </li>
              </ul>
              <Button disabled={!allRequiredDoneBeforeConfirm} onClick={handleConfirmInspection} fullWidth>
                Complete Inspection
              </Button>
            </motion.div>
          )}
        </Card>

        {/* Task checklist */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-ink">Task Checklist</h3>
          <ProgressBar value={activeSession.completedTaskCount} max={activeSession.totalTaskCount} />
          <ul className="mt-4 space-y-3">
            {activeSession.taskResults.map((task, idx) => {
              const isCurrent = task.id === currentTaskId;
              return (
                <li
                  key={task.id}
                  className={`rounded-lg border p-3 text-sm transition-colors ${
                    task.completed
                      ? "border-success/30 bg-success/5"
                      : isCurrent
                        ? "border-secondary/50 bg-secondary/5"
                        : "border-border bg-transparent opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {task.completed ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted">
                        {idx + 1}
                      </span>
                    )}
                    <span className={task.completed ? "text-ink line-through" : "text-ink"}>{task.title}</span>
                  </div>
                  {isCurrent && <p className="mt-1 pl-6 text-xs text-muted">{task.description}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Pause menu */}
      <Dialog open={showPauseMenu} onClose={() => { resumeSession(); setShowPauseMenu(false); }} title="Paused">
        <div className="flex flex-col gap-2">
          <Button onClick={() => { resumeSession(); setShowPauseMenu(false); }}>Resume</Button>
          <Button variant="secondary" onClick={() => setConfirmRestart(true)}>
            Restart Scenario
          </Button>
          {/* Resumes the session before leaving, rather than just
              navigating away while isPaused stays true. Navigating to
              Settings unmounts this page entirely, so the pause dialog
              disappears with no way to re-open it - but isPaused (and
              Time.timeScale-equivalent: the timer interval) stayed paused
              forever, leaving the scene looking "not paused" while
              actually stuck. The trade-off: the timer keeps running while
              the trainee is on the Settings screen, which is preferable
              to a session that can never be resumed. */}
          <Button
            variant="secondary"
            onClick={() => {
              resumeSession();
              setShowPauseMenu(false);
              navigate("/settings");
            }}
          >
            Settings
          </Button>
          <Button variant="danger" icon={<LogOut size={15} />} onClick={() => setConfirmExit(true)}>
            Exit Scenario
          </Button>
        </div>
      </Dialog>

      {/* Restart confirmation */}
      <Dialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="Restart this scenario?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRestart(false)}>Cancel</Button>
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={handleRestart}>
              Restart
            </Button>
          </>
        }
      >
        Your current progress on this attempt will be discarded and a new attempt will begin.
      </Dialog>

      {/* Exit confirmation */}
      <Dialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        title="Exit this scenario?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmExit(false)}>Cancel</Button>
            <Button variant="danger" icon={<LogOut size={15} />} onClick={handleExit}>
              Exit
            </Button>
          </>
        }
      >
        Your progress will be saved as an exited attempt. You can review it in Session History.
      </Dialog>
    </PageTransition>
  );
}
