"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BestandPoint } from "@/lib/types";
import { formatEur } from "@/lib/format";

/**
 * Wachstumskurve des wiederkehrenden Bestands (12 Monate).
 * Daten kommen aus commissions (ctype = 'closer_recurring').
 */
export function BestandChart({ data }: { data: BestandPoint[] }) {
  return (
    <div className="h-48 w-full sm:h-56" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="bestandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.28} />
              <stop offset="65%" stopColor="#a855f7" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="bestandStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6b7689", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            hide
            domain={[0, (max: number) => Math.ceil((max * 1.15) / 100) * 100]}
          />
          <Tooltip
            cursor={{ stroke: "#22d3ee", strokeOpacity: 0.3, strokeWidth: 1 }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e6ef",
              borderRadius: 12,
              fontSize: 12,
              color: "#0f172a",
              boxShadow: "0 10px 28px -16px rgba(16,24,40,0.25)",
            }}
            labelStyle={{ color: "#48566b", marginBottom: 4 }}
            formatter={(value: number) => [formatEur(value), "Bestandsprovision"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="url(#bestandStroke)"
            strokeWidth={2.5}
            fill="url(#bestandFill)"
            dot={false}
            activeDot={{ r: 4, fill: "#7c3aed", stroke: "#ffffff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
