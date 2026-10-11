import { useNavigate } from "react-router-dom";
import { Headset, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useTrainingStore } from "../../store/useTrainingStore";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const currentUser = useTrainingStore((s) => s.currentUser);
  const signOut = useTrainingStore((s) => s.signOut);

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface/60 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary">
          <Headset size={18} />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {currentUser && (
          <span className="hidden text-xs text-muted sm:inline">
            {currentUser.userId} &middot; {currentUser.role}
          </span>
        )}
        <button
          onClick={() => navigate("/settings")}
          className="rounded-lg p-2 text-muted hover:bg-raised hover:text-ink"
          aria-label="Settings"
        >
          <SettingsIcon size={18} />
        </button>
        {currentUser && (
          <button
            onClick={async () => {
              try { await signOut(); navigate("/role"); } catch (e) { useTrainingStore.getState().reportError((e as Error).message); }
            }}
            className="rounded-lg p-2 text-muted hover:bg-raised hover:text-danger"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
