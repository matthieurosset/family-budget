import { useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAnomalies, useCategoryBreakdown, useSummary } from "../lib/hooks";
import { currentMonth, formatCHF, formatMonth, prevMonth } from "../lib/utils";

const CHART_COLORS = [
  "#2d8a5e", "#1f6f4a", "#4ea87e", "#7fc3a5",
  "#e85528", "#c4401d", "#f0734d",
  "#73619a", "#5d4e7e", "#8f7db3",
  "#9a856c", "#7d6b55", "#b8a690",
  "#164832",
];

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string | undefined;
  icon: typeof ArrowUpRight;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">{label}</p>
          <p className={`mt-2 font-display text-[28px] leading-none ${accent}`}>
            {value != null ? formatCHF(value) : "--"}
          </p>
        </div>
        <div className={`rounded-lg p-2 ${accent.includes("forest") ? "bg-forest-50" : accent.includes("ember") ? "bg-ember-50" : "bg-dusk-50"}`}>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
      </div>
    </motion.div>
  );
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: summary } = useSummary(month);
  const { data: categories } = useCategoryBreakdown(month, month);
  const { data: anomalies } = useAnomalies(month);

  const pieData = categories
    ?.filter((c) => parseFloat(c.total) < 0)
    .map((c) => ({ name: c.category_name, value: Math.abs(parseFloat(c.total)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400"
          >
            Aperçu mensuel
          </motion.p>
          <h1 className="mt-1 font-display text-3xl text-sand-900 md:text-4xl">
            {formatMonth(month)}
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-sand-200 bg-white p-1">
          <button onClick={() => setMonth(prevMonth(month))} className="rounded-lg p-2 text-sand-500 transition-colors hover:bg-sand-100 hover:text-sand-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={nextMonth} className="rounded-lg p-2 text-sand-500 transition-colors hover:bg-sand-100 hover:text-sand-700">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dépenses" value={summary?.total_expenses} icon={ArrowDownRight} accent="text-ember-600" delay={0.05} />
        <StatCard label="Revenus" value={summary?.total_income} icon={ArrowUpRight} accent="text-forest-600" delay={0.1} />
        <StatCard label="Transferts" value={summary?.total_transfers} icon={ArrowUpRight} accent="text-dusk-500" delay={0.15} />
        <StatCard
          label="Solde net"
          value={summary?.net}
          icon={parseFloat(summary?.net || "0") >= 0 ? ArrowUpRight : ArrowDownRight}
          accent={parseFloat(summary?.net || "0") >= 0 ? "text-forest-600" : "text-ember-600"}
          delay={0.2}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Category pie chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm lg:col-span-3"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">
            Répartition des dépenses
          </h2>
          {pieData && pieData.length > 0 ? (
            <>
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatCHF(String(v))}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e8e0d4",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "13px",
                        fontFamily: "DM Sans",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {pieData.map((d, i) => (
                  <span key={d.name} className="flex items-center gap-2 text-[12px] text-sand-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="font-medium text-sand-700">{d.name}</span>
                    <span className="text-sand-400">{formatCHF(d.value)}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center">
              <p className="text-sm text-sand-300">Aucune donnée pour ce mois</p>
            </div>
          )}
        </motion.div>

        {/* Anomalies */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">
            Évolutions notables
          </h2>
          {anomalies && anomalies.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {anomalies.map((a, i) => (
                <motion.li
                  key={a.category_name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05 }}
                  className="flex items-start gap-3 rounded-xl bg-sand-50 p-3.5"
                >
                  <div className={`mt-0.5 rounded-lg p-1.5 ${a.direction === "up" ? "bg-ember-50" : "bg-forest-50"}`}>
                    {a.direction === "up" ? (
                      <TrendingUp className="h-4 w-4 text-ember-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-forest-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-sand-800">{a.category_name}</p>
                    <p className="mt-0.5 text-[12px] text-sand-500">
                      {formatCHF(a.current_month_total)}
                      <span className="mx-1.5 text-sand-300">vs</span>
                      moy. {formatCHF(a.average_total)}
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        a.direction === "up"
                          ? "bg-ember-100 text-ember-700"
                          : "bg-forest-100 text-forest-700"
                      }`}
                    >
                      {a.direction === "up" ? "+" : ""}{a.deviation_pct}%
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-sm text-sand-300">Aucune anomalie détectée</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
