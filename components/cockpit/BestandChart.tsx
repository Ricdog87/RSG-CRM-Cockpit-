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
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.55} />
              <stop offset="60%" stopColor="#a855f7" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
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
            tick={{ fill: "#71717a", fontSize: 11 }}
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
              background: "#0f0f17",
              border: "1px solid #22222e",
              borderRadius: 12,
              fontSize: 12,
              color: "#f4f4f5",
            }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            formatter={(value: number) => [formatEur(value), "Bestandsprovision"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="url(#bestandStroke)"
            strokeWidth={2.5}
            fill="url(#bestandFill)"
            dot={false}
            activeDot={{ r: 4, fill: "#a855f7", stroke: "#09090f", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
