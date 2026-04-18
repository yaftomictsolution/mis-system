"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

import { useTheme } from "../../../app/context/ThemeContext";
import type { ReportChart } from "@/modules/reports/reports.types";

const PIE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#14b8a6", "#f97316"];

function valueFormatter(value: number | string): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return String(value ?? "");
}

export function ReportCharts({ charts }: { charts: ReportChart[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axisColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const border = isDark ? "#2a2a3e" : "#e2e8f0";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const tooltipText = isDark ? "#e2e8f0" : "#0f172a";
  const tooltipLabel = isDark ? "#cbd5e1" : "#475569";

  const tooltipContentStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${border}`,
    borderRadius: 12,
    color: tooltipText,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.16)",
  } as const;

  const tooltipItemStyle = {
    color: tooltipText,
  } as const;

  const tooltipLabelStyle = {
    color: tooltipLabel,
    fontWeight: 600,
  } as const;

  if (!charts.length) return null;

  return (
    <div className={`grid gap-6 ${charts.length > 1 ? "xl:grid-cols-2" : ""}`}>
      {charts.map((chart, index) => (
        <motion.div
          key={chart.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.06 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a3e] dark:bg-[#12121a]"
        >
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{chart.title}</h3>
            {chart.subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{chart.subtitle}</p> : null}
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chart.type === "pie" ? (
                <PieChart>
                  <Pie
                    data={chart.data}
                    dataKey={chart.series[0]?.key ?? "value"}
                    nameKey={chart.categoryKey}
                    innerRadius={64}
                    outerRadius={104}
                    paddingAngle={3}
                  >
                    {chart.data.map((entry, entryIndex) => (
                      <Cell key={`${chart.key}-${String(entry[chart.categoryKey])}`} fill={PIE_COLORS[entryIndex % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value: number | string | undefined) => [valueFormatter(value ?? ""), chart.series[0]?.label ?? "Value"]}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: axisColor, fontWeight: 500 }}>{value}</span>}
                  />
                </PieChart>
              ) : chart.type === "line" ? (
                <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey={chart.categoryKey} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: axisColor, fontWeight: 500 }}>{value}</span>}
                  />
                  {chart.series.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.label}
                      stroke={series.color}
                      strokeWidth={3}
                      dot={{ r: 3, fill: series.color }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey={chart.categoryKey} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: axisColor, fontWeight: 500 }}>{value}</span>}
                  />
                  {chart.series.map((series) => (
                    <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[6, 6, 0, 0]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
