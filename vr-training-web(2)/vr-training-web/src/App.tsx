import { SyncStatus } from "./components/common/SyncStatus";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useTrainingStore } from "./store/useTrainingStore";
import { ToastProvider } from "./components/common/Toast";

import RoleSelectionPage from "./pages/RoleSelectionPage";
import MainMenuPage from "./pages/MainMenuPage";
import ScenarioSelectionPage from "./pages/ScenarioSelectionPage";
import BriefingPage from "./pages/BriefingPage";
import TrainingPage from "./pages/TrainingPage";
import FeedbackPage from "./pages/FeedbackPage";
import HistoryPage from "./pages/HistoryPage";
import EducatorDashboardPage from "./pages/EducatorDashboardPage";
import SettingsPage from "./pages/SettingsPage";

function RequireUser({ children }: { children: ReactElement }) {
  const currentUser = useTrainingStore((s) => s.currentUser);
  if (!currentUser) return <Navigate to="/role" replace />;
  return children;
}

/** Previously any signed-in user (including a Trainee) could reach
 * /educator directly by typing the URL, since RequireUser only checked
 * that *someone* was signed in, not their role. */
function RequireRole({ role, children }: { role: "trainee" | "educator" | "administrator"; children: ReactElement }) {
  const currentUser = useTrainingStore((s) => s.currentUser);
  if (!currentUser) return <Navigate to="/role" replace />;
  if (currentUser.role !== role) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const settings = useTrainingStore((s) => s.settings);

  const initialized = useTrainingStore(s => s.initialized);
  useEffect(() => {
    void useTrainingStore.getState().initialize();
    const sync = () => { void useTrainingStore.getState().sync(); };
    const pauseOnLeave = () => { try { useTrainingStore.getState().pauseSession(); } catch { /* persistence error remains visible */ } };
    window.addEventListener('online', sync);
    window.addEventListener('pagehide', pauseOnLeave);
    const timer = setInterval(sync, 30000);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('pagehide', pauseOnLeave); clearInterval(timer); };
  }, []);
  // Apply accessibility settings globally and immediately - text scaling,
  // high contrast, and reduced motion all take effect app-wide the moment
  // they change, not just on the Settings page itself.
  //
  // Text size previously set inline `fontSize` on a wrapper <div>, but
  // almost all of Tailwind's text utilities (text-xs/sm/base/lg/...) are
  // defined in `rem`, which resolves against the *root* (<html>) font
  // size, not an ancestor element's - so that wrapper had no effect on
  // most of the app's text. Scaling the root font-size itself is what
  // actually moves every rem-based Tailwind class together.
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${settings.textSize * 100}%`;
    root.classList.toggle("high-contrast", settings.highContrast);
    root.classList.toggle("reduced-motion", settings.reducedMotion);
  }, [settings.textSize, settings.highContrast, settings.reducedMotion]);

  if (!initialized) return <div className="p-10">Loading account…</div>;
  return (
    <ToastProvider>
      <SyncStatus />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/role" replace />} />
          <Route path="/role" element={<RoleSelectionPage />} />
          <Route
            path="/home"
            element={
              <RequireUser>
                <MainMenuPage />
              </RequireUser>
            }
          />
          <Route
            path="/scenarios"
            element={
              <RequireUser>
                <ScenarioSelectionPage />
              </RequireUser>
            }
          />
          <Route
            path="/briefing/:scenarioId"
            element={
              <RequireUser>
                <BriefingPage />
              </RequireUser>
            }
          />
          <Route
            path="/training/:scenarioId"
            element={
              <RequireUser>
                <TrainingPage />
              </RequireUser>
            }
          />
          <Route
            path="/feedback/:sessionId"
            element={
              <RequireUser>
                <FeedbackPage />
              </RequireUser>
            }
          />
          <Route
            path="/history"
            element={
              <RequireUser>
                <HistoryPage />
              </RequireUser>
            }
          />
          <Route
            path="/educator"
            element={
              <RequireRole role="educator">
                <EducatorDashboardPage />
              </RequireRole>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/role" replace />} />
        </Routes>
      </AnimatePresence>
    </ToastProvider>
  );
}
