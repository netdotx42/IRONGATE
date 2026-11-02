"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function Trend({
  data,
}: {
  data: { date: string; score: number }[];
}) {
  if (!data.length)
    return (
      <p className="empty">Saved scans will build your configuration trend.</p>
    );
  return (
    <div
      style={{ width: "100%", height: 240 }}
      aria-label="Configuration score over recent saved scans"
    >
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="#263449" vertical={false} />
          <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} stroke="#94A3B8" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#172438", borderColor: "#263449" }}
          />
          <Line
            dataKey="score"
            type="monotone"
            stroke="#34D399"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
