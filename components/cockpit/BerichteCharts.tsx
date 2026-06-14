"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatEur, formatNumber } from "@/lib/format";

const axis = { fill: "#6b7689", fontSize: 11 };
const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e2e6ef",
  borderRadius: 12,
  fontSize: 12,
  color: "#0f1b2d",
  boxShadow: "0 10px 28px -16px rgba(16,24,40,0.25)",
};

export function FunnelChart({
  data,
}: {
  data: { stage: string; count: number }[];
}) {
  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="stage"
            tick={axis}
            axisLine={false}
            tickLine={false}
            width={92}
          />
          <Tooltip
            cursor={{ fill: "rgba(37,99,235,0.06)" }}
            contentStyle={tooltipStyle}
            formatter={(v: number) => [formatNumber(v), "Chancen"]}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? "#2563eb" : "#0ea5e9"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastChart({
  data,
}: {
  data: { month: string; value: number }[];
}) {
  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "rgba(37,99,235,0.06)" }}
            contentStyle={tooltipStyle}
            formatter={(v: number) => [formatEur(v), "gewichtet"]}
          />
          <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
