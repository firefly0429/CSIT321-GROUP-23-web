import type { ReactNode } from "react";
import { CheckCircle2, XCircle, Clock, Lock, AlertTriangle } from "lucide-react";
import { clsx } from "../../lib/clsx";

export type StatusKind = "success" | "warning" | "danger" | "info" | "locked";

const CONFIG: Record<StatusKind, { classes: string; icon: ReactNode }> = {
  success: { classes: "bg-success/15 text-success border-success/30", icon: <CheckCircle2 size={14} /> },
  warning: { classes: "bg-warning/15 text-warning border-warning/30", icon: <AlertTriangle size={14} /> },
  danger: { classes: "bg-danger/15 text-danger border-danger/30", icon: <XCircle size={14} /> },
  info: { classes: "bg-secondary/15 text-secondary border-secondary/30", icon: <Clock size={14} /> },
  locked: { classes: "bg-muted/10 text-muted border-border", icon: <Lock size={14} /> },
};

export function StatusChip({ kind, label }: { kind: StatusKind; label: string }) {
  const cfg = CONFIG[kind];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        cfg.classes
      )}
    >
      {cfg.icon}
      {label}
    </span>
  );
}
