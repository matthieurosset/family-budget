import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight, BarChart3, GitCompareArrows, LayoutDashboard } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAnomalies, useCategories, useCategoryBreakdown, useCategoryTrends, usePeriodComparison, useSummary } from "../lib/hooks";
import { currentMonth, formatCHF, formatMonth, prevMonth } from "../lib/utils";

const CHART_COLORS = [
  "#2d8a5e", "#1f6f4a", "#4ea87e", "#7fc3a5",
  "#e85528", "#c4401d", "#f0734d",
  "#73619a", "#5d4e7e", "#8f7db3",
  "#9a856c", "#7d6b55", "#b8a690",
  "#164832",
];

type View = "summary" | "trends" | "comparison";

const TABS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "summary", label: "Résumé", icon: LayoutDashboard },
  { id: "trends", label: "Évolution", icon: BarChart3 },
  { id: "comparison", label: "Comparaison", icon: GitCompareArrows },
];

// ───── Stat Card ─────

function StatCard({ label, value, icon: Icon, accent, delay }: {
  label: string; value: string | undefined; icon: typeof ArrowUpRight; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
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

// ───── Trends View ─────

function TrendsView() {
  const { data: categories } = useCategories();
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const { data: trends, isLoading } = useCategoryTrends(selectedCat, 12);

  const flatCats: { id: number; name: string; group: string }[] = [];
  if (categories) {
    for (const g of categories) {
      for (const c of g.children) {
        flatCats.push({ id: c.id, name: c.name, group: g.name });
      }
    }
  }

  const chartData = trends?.map((t) => ({
    month: t.month.slice(5), // "03" from "2026-03"
    total: Math.abs(parseFloat(t.total)),
    label: formatMonth(t.month),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">
          Évolution par catégorie
        </h2>
        <select
          value={selectedCat ?? ""}
          onChange={(e) => setSelectedCat(e.target.value ? Number(e.target.value) : null)}
          className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5 text-[12px] text-sand-700 focus:border-sand-400 focus:outline-none"
        >
          <option value="">Choisir une catégorie...</option>
          {flatCats.map((c) => (
            <option key={c.id} value={c.id}>{c.group} › {c.name}</option>
          ))}
        </select>
      </div>

      {!selectedCat ? (
        <div className="flex h-[350px] items-center justify-center">
          <p className="text-[13px] text-sand-300">Sélectionnez une catégorie pour voir son évolution</p>
        </div>
      ) : isLoading ? (
        <div className="flex h-[350px] items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
        </div>
      ) : chartData && chartData.length > 0 ? (
        <div className="mt-4 h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9a856c" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9a856c" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
              <Tooltip
                formatter={(v) => formatCHF(String(v))}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                contentStyle={{ borderRadius: "12px", border: "1px solid #e8e0d4", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "13px", fontFamily: "DM Sans" }}
              />
              <Bar dataKey="total" fill="#2d8a5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[350px] items-center justify-center">
          <p className="text-[13px] text-sand-300">Aucune donnée pour cette catégorie</p>
        </div>
      )}
    </motion.div>
  );
}

// ───── Comparison View ─────

function ComparisonView() {
  const [monthA, setMonthA] = useState(prevMonth(currentMonth()));
  const [monthB, setMonthB] = useState(currentMonth());
  const { data: comparison, isLoading } = usePeriodComparison(monthA, monthA, monthB, monthB);

  const sorted = comparison
    ?.map((c) => ({ ...c, p1: Math.abs(parseFloat(c.period1)), p2: Math.abs(parseFloat(c.period2)), d: parseFloat(c.diff) }))
    .sort((a, b) => b.p2 - a.p2);

  const maxVal = sorted ? Math.max(...sorted.map((c) => Math.max(c.p1, c.p2)), 1) : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">
          Comparaison mois par mois
        </h2>
        <div className="flex items-center gap-2 text-[12px]">
          <input type="month" value={monthA} onChange={(e) => setMonthA(e.target.value)}
            className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sand-700 focus:border-sand-400 focus:outline-none" />
          <span className="text-sand-300">vs</span>
          <input type="month" value={monthB} onChange={(e) => setMonthB(e.target.value)}
            className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sand-700 focus:border-sand-400 focus:outline-none" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
        </div>
      ) : sorted && sorted.length > 0 ? (
        <div className="mt-5 space-y-2.5">
          {/* Header */}
          <div className="flex items-center gap-3 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sand-400">
            <span className="w-32 shrink-0">Catégorie</span>
            <span className="flex-1" />
            <span className="w-20 text-right">{formatMonth(monthA).split(" ")[0].slice(0, 3)}</span>
            <span className="w-20 text-right">{formatMonth(monthB).split(" ")[0].slice(0, 3)}</span>
            <span className="w-16 text-right">Diff</span>
          </div>

          {sorted.map((c) => {
            const pct = c.p1 > 0 ? ((c.p2 - c.p1) / c.p1 * 100) : (c.p2 > 0 ? 100 : 0);
            return (
              <div key={c.category} className="group flex items-center gap-3 rounded-xl bg-sand-50 px-3 py-2.5">
                <span className="w-32 shrink-0 text-[12px] font-medium text-sand-700 truncate">{c.category}</span>
                <div className="flex-1 flex gap-0.5 h-4">
                  <div
                    className="rounded-l bg-sand-300/60 h-full transition-all"
                    style={{ width: `${(c.p1 / maxVal) * 100}%` }}
                  />
                  <div
                    className="rounded-r bg-forest-400 h-full transition-all"
                    style={{ width: `${(c.p2 / maxVal) * 100}%` }}
                  />
                </div>
                <span className="w-20 text-right text-[12px] tabular-nums text-sand-500">{formatCHF(c.p1)}</span>
                <span className="w-20 text-right text-[12px] tabular-nums font-medium text-sand-700">{formatCHF(c.p2)}</span>
                <span className={`w-16 text-right text-[11px] tabular-nums font-semibold ${
                  pct > 5 ? "text-ember-600" : pct < -5 ? "text-forest-600" : "text-sand-400"
                }`}>
                  {pct > 0 ? "+" : ""}{pct.toFixed(0)}%
                </span>
              </div>
            );
          })}

          {/* Legend */}
          <div className="flex items-center gap-4 px-1 pt-2 text-[10px] text-sand-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded bg-sand-300/60" />
              {formatMonth(monthA).split(" ")[0]}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded bg-forest-400" />
              {formatMonth(monthB).split(" ")[0]}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-[300px] items-center justify-center">
          <p className="text-[13px] text-sand-300">Aucune donnée pour la comparaison</p>
        </div>
      )}
    </motion.div>
  );
}

// ───── Main Dashboard ─────

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<View>("summary");
  const navigate = useNavigate();
  const { data: summary } = useSummary(month);
  const { data: categories } = useCategoryBreakdown(month, month);
  const { data: anomalies } = useAnomalies(month);

  const pieData = categories
    ?.filter((c) => parseFloat(c.total) < 0)
    .map((c) => ({ name: c.category_name, value: Math.abs(parseFloat(c.total)), categoryId: c.category_id }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const navigateToCategory = (categoryId: number | null) => {
    const params = new URLSearchParams({ month });
    if (categoryId) params.set("category", String(categoryId));
    navigate(`/transactions?${params}`);
  };

  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">
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

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-xl border border-sand-200 bg-white p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-medium transition-all ${
              view === id
                ? "bg-sand-900 text-sand-50 shadow-sm"
                : "text-sand-500 hover:bg-sand-50 hover:text-sand-700"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards (always visible) */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dépenses" value={summary?.total_expenses} icon={ArrowDownRight} accent="text-ember-600" delay={0.05} />
        <StatCard label="Revenus" value={summary?.total_income} icon={ArrowUpRight} accent="text-forest-600" delay={0.1} />
        <StatCard label="Transferts" value={summary?.total_transfers} icon={ArrowUpRight} accent="text-dusk-500" delay={0.15} />
        <StatCard label="Solde net" value={summary?.net}
          icon={parseFloat(summary?.net || "0") >= 0 ? ArrowUpRight : ArrowDownRight}
          accent={parseFloat(summary?.net || "0") >= 0 ? "text-forest-600" : "text-ember-600"} delay={0.2} />
      </div>

      {/* View content */}
      <div className="mt-6">
        {view === "summary" && (
          <div className="grid gap-6 lg:grid-cols-5">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
              className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm lg:col-span-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Répartition des dépenses</h2>
              {pieData && pieData.length > 0 ? (
                <>
                  <div className="mt-4 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={120}
                          paddingAngle={2} dataKey="value" strokeWidth={0} cursor="pointer"
                          onClick={(_, index) => navigateToCategory(pieData[index].categoryId)}>
                          {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => formatCHF(String(v))}
                          contentStyle={{ borderRadius: "12px", border: "1px solid #e8e0d4", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "13px", fontFamily: "DM Sans" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    {pieData.map((d, i) => (
                      <button key={d.name} onClick={() => navigateToCategory(d.categoryId)}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-[12px] text-sand-600 transition-colors hover:bg-sand-100">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="font-medium text-sand-700">{d.name}</span>
                        <span className="text-sand-400">{formatCHF(d.value)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-[300px] items-center justify-center">
                  <p className="text-sm text-sand-300">Aucune donnée pour ce mois</p>
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Évolutions notables</h2>
              {anomalies && anomalies.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {anomalies.map((a, i) => (
                    <motion.li key={a.category_name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }} className="flex items-start gap-3 rounded-xl bg-sand-50 p-3.5">
                      <div className={`mt-0.5 rounded-lg p-1.5 ${a.direction === "up" ? "bg-ember-50" : "bg-forest-50"}`}>
                        {a.direction === "up" ? <TrendingUp className="h-4 w-4 text-ember-500" /> : <TrendingDown className="h-4 w-4 text-forest-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-sand-800">{a.category_name}</p>
                        <p className="mt-0.5 text-[12px] text-sand-500">
                          {formatCHF(a.current_month_total)}<span className="mx-1.5 text-sand-300">vs</span>moy. {formatCHF(a.average_total)}
                        </p>
                        <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          a.direction === "up" ? "bg-ember-100 text-ember-700" : "bg-forest-100 text-forest-700"
                        }`}>
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
        )}

        {view === "trends" && <TrendsView />}
        {view === "comparison" && <ComparisonView />}
      </div>
    </div>
  );
}
