import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, LineChart, ShieldAlert, Headset } from "lucide-react";
import { Card } from "../components/common/Card";
import { StatusChip } from "../components/common/StatusChip";
import { PageTransition } from "../components/layout/PageTransition";
import { useTrainingStore } from "../store/useTrainingStore";

const ROLES = [
  {
    role: "trainee" as const,
    userId: "Trainee01",
    title: "Trainee",
    description: "Practice scenarios, track your progress, and review past attempts.",
    icon: Headset,
    available: true,
  },
  {
    role: "educator" as const,
    userId: "Educator01",
    title: "Educator",
    description: "Review trainee performance and monitor training outcomes.",
    icon: LineChart,
    available: true,
  },
  {
    role: "administrator" as const,
    userId: "Admin01",
    title: "Administrator",
    description: "Manage modules and configure scenarios.",
    icon: ShieldAlert,
    available: false,
  },
];

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const selectRole = useTrainingStore((s) => s.selectRole);

  function handleSelect(role: (typeof ROLES)[number]) {
    if (!role.available) return;
    selectRole(role.role, role.userId);
    navigate(role.role === "educator" ? "/educator" : "/home");
  }

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/40 text-primary">
            <GraduationCap size={28} />
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">VR Training Simulator</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            Select a role to continue. This is a web demonstration prototype - choose Trainee or Educator to explore
            the full experience.
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
          {ROLES.map((r, idx) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Card
                  raised
                  onClick={() => handleSelect(r)}
                  className={`flex h-full cursor-pointer flex-col gap-4 transition-all hover:border-primary/50 ${
                    !r.available ? "cursor-not-allowed opacity-60 hover:border-border" : "hover:-translate-y-1"
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas text-primary">
                    <Icon size={22} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-ink">{r.title}</h2>
                    <p className="mt-1 text-sm text-muted">{r.description}</p>
                  </div>
                  {r.available ? (
                    <StatusChip kind="success" label="Available" />
                  ) : (
                    <StatusChip kind="locked" label="Coming Soon" />
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-10 max-w-lg text-center text-xs text-muted">
          This browser prototype demonstrates the complete user journey and interface behaviour of the proposed VR
          Training Simulator. Physical XR interactions are represented using web-based animation and pointer
          interactions pending Unity integration.
        </p>
      </div>
    </PageTransition>
  );
}
