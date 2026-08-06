import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { SessionResult } from "../../types";
import { Card } from "../common/Card";

const AXIS_COLOR = "#93A4BC";
const GRID_COLOR = "#33486A";

const TOOLTIP_STYLE = {
  backgroundColor: "#16243A",
  border: "1px solid #33486A",
  borderRadius: 8,
  color: "#E8EEF6",
  fontSize: 12,
};

export function ScoreLineChart({ sessions }: { sessions: SessionResult[] }) {
  const data = [...sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => (a.endTime ?? "").localeCompare(b.endTime ?? ""))
    .slice(-15)
    .map((s, i) => ({ name: `#${i + 1}`, score: s.finalScore }));

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Recent scores</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={11} />
          <YAxis stroke={AXIS_COLOR} fontSize={11} domain={[0, 100]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="score" stroke="#2DD4BF" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function PassFailDonut({ sessions }: { sessions: SessionResult[] }) {
  const completed = sessions.filter((s) => s.status === "completed");
  const passed = completed.filter((s) => s.passed).length;
  const failed = completed.length - passed;
  const data = [
    { name: "Passed", value: passed, color: "#22C55E" },
    { name: "Not passed", value: failed, color: "#F59E0B" },
  ];

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Pass vs fail</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12, color: AXIS_COLOR }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function ScenarioAverageBarChart({ sessions }: { sessions: SessionResult[] }) {
  const completed = sessions.filter((s) => s.status === "completed");
  const byScenario = new Map<string, { total: number; count: number }>();
  completed.forEach((s) => {
    const entry = byScenario.get(s.scenarioName) ?? { total: 0, count: 0 };
    entry.total += s.finalScore;
    entry.count += 1;
    byScenario.set(s.scenarioName, entry);
  });
  const data = Array.from(byScenario.entries()).map(([name, { total, count }]) => ({
    name,
    average: Math.round(total / count),
  }));

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Average score by scenario</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={11} />
          <YAxis stroke={AXIS_COLOR} fontSize={11} domain={[0, 100]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="average" fill="#38BDF8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function MistakesOverTimeChart({ sessions }: { sessions: SessionResult[] }) {
  const data = [...sessions]
    .filter((s) => s.status === "completed")
    .sort((a, b) => (a.endTime ?? "").localeCompare(b.endTime ?? ""))
    .slice(-15)
    .map((s, i) => ({ name: `#${i + 1}`, mistakes: s.mistakeCount }));

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-ink">Mistakes over time</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="name" stroke={AXIS_COLOR} fontSize={11} />
          <YAxis stroke={AXIS_COLOR} fontSize={11} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="mistakes" fill="#EF4444" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
