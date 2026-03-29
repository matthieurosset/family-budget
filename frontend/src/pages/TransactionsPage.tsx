import { useState } from "react";
import { motion } from "motion/react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useTransactions } from "../lib/hooks";
import { currentMonth, formatCHF } from "../lib/utils";

export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTransactions({ month, search, page, page_size: 50 });

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Historique</p>
          <h1 className="mt-1 font-display text-3xl text-sand-900">Transactions</h1>
        </div>
        {data && (
          <p className="text-[13px] text-sand-400">
            <span className="font-semibold text-sand-600">{data.total}</span> transactions
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-[13px] text-sand-700 shadow-sm transition-colors focus:border-sand-400 focus:outline-none"
        />
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-300" />
          <input
            type="text"
            placeholder="Rechercher un marchand, une description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-sand-200 bg-white py-2 pl-10 pr-4 text-[13px] text-sand-700 shadow-sm placeholder:text-sand-300 transition-colors focus:border-sand-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-5 overflow-hidden rounded-2xl border border-sand-200/60 bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-sand-100 bg-sand-50/60">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-400">Date</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-400">Description</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-400">Catégorie</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-400">Montant</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-sand-300">
                    <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-16 text-center text-sand-300">Aucune transaction</td></tr>
              ) : (
                data?.items.map((tx, i) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="group border-b border-sand-100/60 transition-colors hover:bg-sand-50/50"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-sand-400 tabular-nums">{tx.date}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-sand-800">
                        {tx.merchant_name || tx.description.slice(0, 45)}
                      </div>
                      {tx.merchant_name && (
                        <div className="mt-0.5 max-w-xs truncate text-[11px] text-sand-300">
                          {tx.description.slice(0, 70)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {tx.category_name ? (
                        <span className="inline-flex rounded-lg bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
                          {tx.category_name}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-lg bg-sand-100 px-2.5 py-1 text-[11px] text-sand-400">
                          Non classé
                        </span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${
                      parseFloat(tx.amount) >= 0 ? "text-forest-600" : "text-sand-800"
                    }`}>
                      {formatCHF(tx.amount)}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12px] text-sand-400">
            Page {page} sur {Math.ceil(data.total / data.page_size)}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[12px] font-medium text-sand-600 transition-colors hover:bg-sand-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Préc.
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * data.page_size >= data.total}
              className="flex items-center gap-1 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[12px] font-medium text-sand-600 transition-colors hover:bg-sand-50 disabled:opacity-30"
            >
              Suiv. <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
