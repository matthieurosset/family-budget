import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAnomalies, useCategoryBreakdown, useSummary } from "../lib/hooks";
import { currentMonth, formatCHF, formatMonth, prevMonth } from "../lib/utils";

const COLORS = [
  "#059669", "#0891b2", "#7c3aed", "#db2777", "#ea580c",
  "#ca8a04", "#4f46e5", "#16a34a", "#dc2626", "#2563eb",
  "#9333ea", "#c026d3", "#0d9488", "#d97706",
];

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: summary, isLoading: summaryLoading } = useSummary(month);
  const { data: categories } = useCategoryBreakdown(month, month);
  const { data: anomalies } = useAnomalies(month);

  const pieData = categories
    ?.filter((c) => parseFloat(c.total) < 0)
    .map((c) => ({ name: c.category_name, value: Math.abs(parseFloat(c.total)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(prevMonth(month))} className="rounded-lg p-1.5 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[140px] text-center font-medium">{formatMonth(month)}</span>
          <button
            onClick={() => {
              const [y, m] = month.split("-").map(Number);
              const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
              setMonth(next);
            }}
            className="rounded-lg p-1.5 hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Depenses", value: summary?.total_expenses, color: "text-red-600" },
          { label: "Revenus", value: summary?.total_income, color: "text-emerald-600" },
          { label: "Transferts", value: summary?.total_transfers, color: "text-blue-600" },
          { label: "Solde net", value: summary?.net, color: parseFloat(summary?.net || "0") >= 0 ? "text-emerald-600" : "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold ${color}`}>
              {summaryLoading ? "..." : value ? formatCHF(value) : "-- CHF"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Category pie chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Repartition par categorie</h2>
          {pieData && pieData.length > 0 ? (
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCHF(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {pieData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {d.name}: {formatCHF(d.value)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-gray-400">Aucune donnee pour ce mois</p>
          )}
        </div>

        {/* Anomalies */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Anomalies</h2>
          {anomalies && anomalies.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {anomalies.map((a) => (
                <li key={a.category_name} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                  {a.direction === "up" ? (
                    <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  ) : (
                    <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{a.category_name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCHF(a.current_month_total)} vs moy. {formatCHF(a.average_total)}{" "}
                      <span className={a.direction === "up" ? "text-red-600" : "text-emerald-600"}>
                        ({a.direction === "up" ? "+" : ""}{a.deviation_pct}%)
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-sm text-gray-400">Aucune anomalie detectee</p>
          )}
        </div>
      </div>
    </div>
  );
}
