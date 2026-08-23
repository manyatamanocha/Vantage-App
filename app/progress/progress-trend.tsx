"use client";

import type { ProgressSolveRow } from "./actions";

interface WeeklyData {
  week: string;
  accuracy: number;
  totalSolves: number;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function formatWeekLabel(date: Date): string {
  const start = getWeekStart(new Date(date));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

export function ProgressTrend({ solves }: { solves: ProgressSolveRow[] }) {
  // Group solves by week and compute weekly accuracy
  const weeklyMap = new Map<string, { correct: number; total: number }>();

  for (const solve of solves) {
    const date = new Date(solve.createdAt);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split("T")[0];

    const current = weeklyMap.get(weekKey) || { correct: 0, total: 0 };

    // Only count complete solves (where correct is not null)
    if (solve.correct !== null) {
      current.total += 1;
      if (solve.correct) {
        current.correct += 1;
      }
    }

    weeklyMap.set(weekKey, current);
  }

  const weeklyData: WeeklyData[] = Array.from(weeklyMap.entries())
    .map(([weekKey, data]) => ({
      week: weekKey,
      accuracy: data.total > 0 ? data.correct / data.total : 0,
      totalSolves: data.total,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  if (weeklyData.length === 0) {
    return <p>No data yet</p>;
  }

  const maxAccuracy = Math.max(...weeklyData.map((w) => w.accuracy), 1);
  const chartHeight = 200;

  return (
    <div className="trend-container">
      <svg
        width="100%"
        height={chartHeight}
        className="trend-chart"
        viewBox={`0 0 ${weeklyData.length * 60} ${chartHeight}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {weeklyData.map((data, i) => {
          const barWidth = 40;
          const barHeight = (data.accuracy / maxAccuracy) * (chartHeight - 40);
          const x = i * 60 + 10;
          const y = chartHeight - barHeight - 20;

          return (
            <g key={data.week}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#3b82f6"
                opacity="0.7"
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight - 5}
                textAnchor="middle"
                fontSize="12"
                className="week-label"
              >
                {new Date(data.week).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </text>
              <title>
                {formatWeekLabel(new Date(data.week))}: {Math.round(data.accuracy * 100)}% (
                {data.totalSolves} solves)
              </title>
            </g>
          );
        })}
      </svg>

      <div className="trend-table">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Accuracy</th>
              <th>Solves</th>
            </tr>
          </thead>
          <tbody>
            {weeklyData.map((data) => (
              <tr key={data.week}>
                <td>{formatWeekLabel(new Date(data.week))}</td>
                <td>{Math.round(data.accuracy * 100)}%</td>
                <td>{data.totalSolves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
