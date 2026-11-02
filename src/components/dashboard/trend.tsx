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
          <CartesianGrid stroke="#E8EAED" vertical={false} />
          <XAxis dataKey="date" stroke="#5F6368" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} stroke="#5F6368" tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", borderColor: "#DADCE0" }}
          />
          <Line
            dataKey="score"
            type="monotone"
            stroke="#1967D2"
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
