import { useState } from "react";
import { Search } from "lucide-react";
import { useTransactions } from "../lib/hooks";
import { currentMonth, formatCHF, formatMonth } from "../lib/utils";

export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useTransactions({
    month,
    search,
    page,
    page_size: 50,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Chargement...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucune transaction</td></tr>
            ) : (
              data?.items.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{tx.date}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{tx.merchant_name || tx.description.slice(0, 50)}</div>
                    {tx.merchant_name && (
                      <div className="text-xs text-gray-400 truncate max-w-xs">{tx.description.slice(0, 80)}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {tx.category_name ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        {tx.category_name}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                        --
                      </span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${parseFloat(tx.amount) >= 0 ? "text-emerald-600" : "text-gray-900"}`}>
                    {formatCHF(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > data.page_size && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {data.total} transactions — page {page}/{Math.ceil(data.total / data.page_size)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
            >
              Precedent
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * data.page_size >= data.total}
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
