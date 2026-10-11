import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "../components/layout/AppHeader";
import { PageTransition } from "../components/layout/PageTransition";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { useTrainingStore } from "../store/useTrainingStore";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-raised"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useTrainingStore((s) => s.settings);
  const updateSettings = useTrainingStore((s) => s.updateSettings);

  return (
    <PageTransition>
      <AppHeader title="Settings" subtitle="Accessibility & comfort" />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <Card className="mb-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">Movement & posture</h3>
          <p className="mb-3 text-xs text-muted">Matches the accessibility options planned for the VR build.</p>

          <div className="mb-4 flex gap-2">
            {(["teleport", "smooth"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateSettings({ movementMode: mode })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                  settings.movementMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(["seated", "standing"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateSettings({ postureMode: mode })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                  settings.postureMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </Card>

        <Card className="mb-4">
          <h3 className="mb-1 text-sm font-semibold text-ink">Text size</h3>
          <p className="mb-3 text-xs text-muted">Applies immediately across the whole application.</p>
          <input
            type="range"
            min={0.8}
            max={1.6}
            step={0.05}
            value={settings.textSize}
            onChange={(e) => updateSettings({ textSize: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <p className="mt-1 text-right text-xs text-muted">{Math.round(settings.textSize * 100)}%</p>
        </Card>

        <Card className="divide-y divide-border">
          <Toggle label="Subtitles" checked={settings.subtitles} onChange={(v) => updateSettings({ subtitles: v })} />
          <Toggle label="High contrast mode" checked={settings.highContrast} onChange={(v) => updateSettings({ highContrast: v })} />
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} />
          <Toggle label="Sound effects" checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        </Card>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => navigate(-1)}>Done</Button>
        </div>
      </div>
    </PageTransition>
  );
}
