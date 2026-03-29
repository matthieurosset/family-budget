import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { useCategories, useRules } from "../lib/hooks";

function CategoryGroup({ group }: { group: { id: number; name: string; children: { id: number; name: string; month_shift_days: number | null }[] } }) {
  const [open, setOpen] = useState(true);

  return (
    <li>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-sand-100"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-sand-400" /> : <ChevronRight className="h-3.5 w-3.5 text-sand-400" />}
        <span className="text-[13px] font-semibold text-sand-800">{group.name}</span>
        <span className="rounded-md bg-sand-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
          {group.children.length}
        </span>
      </button>
      {open && group.children.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="ml-5 space-y-0.5 overflow-hidden border-l-2 border-sand-100 pl-4"
        >
          {group.children.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center gap-2 rounded-lg py-1.5 text-[12px] text-sand-600"
            >
              <span className="h-1 w-1 rounded-full bg-sand-300" />
              {cat.name}
              {cat.month_shift_days != null && (
                <span className="rounded-md bg-dusk-100 px-1.5 py-0.5 text-[10px] font-semibold text-dusk-600">
                  J+{cat.month_shift_days}
                </span>
              )}
            </li>
          ))}
        </motion.ul>
      )}
    </li>
  );
}

export function CategoriesPage() {
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: rules, isLoading: rulesLoading } = useRules();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Configuration</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Categories & Regles</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Categories tree */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Arbre des categories</h2>
            {categories && (
              <span className="rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
                {categories.reduce((sum, g) => sum + g.children.length, 0)}
              </span>
            )}
          </div>
          {catLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
            </div>
          ) : categories && categories.length > 0 ? (
            <ul className="mt-4 space-y-1">
              {categories.map((group) => (
                <CategoryGroup key={group.id} group={group} />
              ))}
            </ul>
          ) : (
            <div className="flex h-40 items-center justify-center text-[13px] text-sand-300">
              Lancez la migration Actual Budget dans Parametres
            </div>
          )}
        </motion.div>

        {/* Mapping rules */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Regles de mapping</h2>
            {rules && (
              <span className="rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
                {rules.length}
              </span>
            )}
          </div>
          {rulesLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
            </div>
          ) : rules && rules.length > 0 ? (
            <div className="mt-4 max-h-[500px] overflow-y-auto">
              <div className="space-y-2">
                {rules.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="flex items-center gap-3 rounded-xl bg-sand-50 px-4 py-2.5"
                  >
                    <Tag className="h-3.5 w-3.5 shrink-0 text-sand-300" />
                    <code className="flex-1 text-[12px] font-medium text-sand-700">{r.pattern}</code>
                    <span className="rounded-lg bg-forest-50 px-2 py-0.5 text-[10px] font-semibold text-forest-700">
                      {r.category_name}
                    </span>
                    <span className="text-[10px] text-sand-300">{r.source}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-[13px] text-sand-300">
              Aucune regle configuree
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
