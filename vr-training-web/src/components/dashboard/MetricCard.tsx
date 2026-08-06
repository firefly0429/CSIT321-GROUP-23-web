import type { ReactNode } from "react";
import { Card } from "../common/Card";

export function MetricCard({ label, value, icon, accent }: { label: string; value: string; icon: ReactNode; accent?: string }) {
  return (
    <Card raised className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-canvas ${accent ?? "text-primary"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-semibold text-ink">{value}</p>
      </div>
    </Card>
  );
}
