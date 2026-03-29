import { ChevronRight } from "lucide-react";
import { useCategories, useRules } from "../lib/hooks";

export function CategoriesPage() {
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: rules, isLoading: rulesLoading } = useRules();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Categories & Regles</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Categories tree */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Categories</h2>
          {catLoading ? (
            <p className="mt-4 text-sm text-gray-400">Chargement...</p>
          ) : categories && categories.length > 0 ? (
            <ul className="mt-4 space-y-1">
              {categories.map((group) => (
                <li key={group.id}>
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-gray-900 bg-gray-50">
                    {group.name}
                    <span className="text-xs text-gray-400">({group.children.length})</span>
                  </div>
                  {group.children.length > 0 && (
                    <ul className="ml-4 space-y-0.5">
                      {group.children.map((cat) => (
                        <li key={cat.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                          <ChevronRight className="h-3 w-3 text-gray-300" />
                          {cat.name}
                          {cat.month_shift_days && (
                            <span className="text-xs text-blue-500">(shift {cat.month_shift_days}j)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Aucune categorie. Lancez la migration Actual Budget.</p>
          )}
        </div>

        {/* Mapping rules */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Regles de mapping</h2>
          {rulesLoading ? (
            <p className="mt-4 text-sm text-gray-400">Chargement...</p>
          ) : rules && rules.length > 0 ? (
            <div className="mt-4 max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-3 py-2">Pattern</th>
                    <th className="px-3 py-2">Categorie</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{r.pattern}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                          {r.category_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Aucune regle.</p>
          )}
        </div>
      </div>
    </div>
  );
}
