import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Plus, Tag, X, Check, Trash2, Pencil, Filter } from "lucide-react";
import { useCategories, useRules, useCreateRule, useUpdateRule, useDeleteRule } from "../lib/hooks";
import type { Category, MappingRule } from "../lib/types";

// ───── Rule Modal (create + edit) ─────

function RuleModal({
  rule,
  categories,
  onClose,
}: {
  rule: MappingRule | null; // null = create
  categories: Category[];
  onClose: () => void;
}) {
  const [pattern, setPattern] = useState(rule?.pattern ?? "");
  const [categoryId, setCategoryId] = useState<string>(rule?.category_id ? String(rule.category_id) : "");
  const [direction, setDirection] = useState(rule?.direction ?? "");
  const [minAmount, setMinAmount] = useState(rule?.min_amount ?? "");
  const [maxAmount, setMaxAmount] = useState(rule?.max_amount ?? "");
  const [priority, setPriority] = useState(String(rule?.priority ?? 0));
  const [saving, setSaving] = useState(false);

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const flatCats: { id: number; name: string; group: string }[] = [];
  for (const g of categories) {
    for (const c of g.children) {
      flatCats.push({ id: c.id, name: c.name, group: g.name });
    }
  }

  const handleSave = () => {
    if (!pattern.trim() || !categoryId) return;
    setSaving(true);
    const data = {
      pattern: pattern.trim(),
      category_id: Number(categoryId),
      priority: parseInt(priority) || 0,
      min_amount: minAmount ? parseFloat(String(minAmount)) : null,
      max_amount: maxAmount ? parseFloat(String(maxAmount)) : null,
      direction: direction || null,
    };
    if (rule) {
      updateRule.mutate({ id: rule.id, ...data }, { onSuccess: () => onClose() });
    } else {
      createRule.mutate(data, { onSuccess: () => onClose() });
    }
  };

  const handleDelete = () => {
    if (!rule) return;
    deleteRule.mutate(rule.id, { onSuccess: () => onClose() });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/30 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="w-full max-w-lg rounded-2xl border border-sand-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-sand-800">
            {rule ? "Modifier la règle" : "Nouvelle règle"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Texte à chercher</label>
            <input
              autoFocus
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Ex: Coop, Crédit, AMAG..."
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] font-mono text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Catégorie cible</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none"
            >
              <option value="">Choisir...</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>{c.group} › {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Direction</label>
            <div className="mt-1 flex gap-2">
              {[
                { value: "", label: "Toutes" },
                { value: "expense", label: "Dépenses" },
                { value: "income", label: "Revenus" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDirection(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all ${
                    direction === opt.value
                      ? "border-forest-400 bg-forest-50 text-forest-700"
                      : "border-sand-200 bg-white text-sand-500 hover:border-sand-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Montant min (CHF)</label>
              <input
                type="number"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="—"
                className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] tabular-nums text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Montant max (CHF)</label>
              <input
                type="number"
                step="0.01"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="—"
                className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] tabular-nums text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Priorité</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-24 rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] tabular-nums text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-sand-300">Plus la valeur est haute, plus la règle est prioritaire</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {rule ? (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-ember-600 transition-colors hover:bg-ember-50">
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] font-medium text-sand-500 hover:bg-sand-50">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!pattern.trim() || !categoryId || saving}
              className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "..." : rule ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ───── Page ─────

export function RulesPage() {
  const { data: rules, isLoading } = useRules();
  const { data: categories } = useCategories();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingRule, setEditingRule] = useState<MappingRule | null | "new">(null);

  const flatCats: { id: number; name: string; group: string }[] = [];
  if (categories) {
    for (const g of categories) {
      for (const c of g.children) {
        flatCats.push({ id: c.id, name: c.name, group: g.name });
      }
    }
  }

  const filtered = rules?.filter((r) => {
    if (search && !r.pattern.toLowerCase().includes(search.toLowerCase()) && !r.category_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && String(r.category_id) !== categoryFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Configuration</p>
          <h1 className="mt-1 font-display text-3xl text-sand-900">Règles de mapping</h1>
        </div>
        <div className="flex items-center gap-3">
          {rules && (
            <p className="text-[13px] text-sand-400">
              <span className="font-semibold text-sand-600">{filtered?.length}</span> / {rules.length} règles
            </p>
          )}
          <button
            onClick={() => setEditingRule("new")}
            className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-forest-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Règle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand-300 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none rounded-xl border border-sand-200 bg-white py-2 pl-9 pr-8 text-[13px] text-sand-700 shadow-sm focus:border-sand-400 focus:outline-none"
          >
            <option value="">Toutes les catégories</option>
            {flatCats.map((c) => (
              <option key={c.id} value={c.id}>{c.group} › {c.name}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-300" />
          <input
            type="text"
            placeholder="Filtrer par pattern ou catégorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-sand-200 bg-white py-2 pl-10 pr-4 text-[13px] text-sand-700 shadow-sm placeholder:text-sand-300 focus:border-sand-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Rules grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-5"
      >
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => setEditingRule(r)}
              className="group cursor-pointer rounded-xl border border-sand-200/60 bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md hover:border-sand-300"
            >
              <div className="flex items-center justify-between">
                <code className="text-[13px] font-semibold text-sand-800 truncate">{r.pattern}</code>
                <Pencil className="h-3 w-3 shrink-0 text-sand-300 opacity-0 transition-opacity group-hover:opacity-100 ml-2" />
              </div>
              <div className="mt-1.5">
                <span className="rounded-md bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
                  {r.category_name}
                </span>
              </div>
              {(r.direction || r.min_amount || r.max_amount) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {r.direction && (
                    <span className="rounded bg-dusk-50 px-1.5 py-0.5 text-[9px] font-semibold text-dusk-600">
                      {r.direction === "income" ? "Revenus" : "Dépenses"}
                    </span>
                  )}
                  {r.min_amount && (
                    <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[9px] tabular-nums text-sand-600">
                      ≥{r.min_amount}
                    </span>
                  )}
                  {r.max_amount && (
                    <span className="rounded bg-sand-100 px-1.5 py-0.5 text-[9px] tabular-nums text-sand-600">
                      ≤{r.max_amount}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-[13px] text-sand-300">
            {rules && rules.length > 0 ? "Aucune règle ne correspond aux filtres" : "Aucune règle configurée"}
          </div>
        )}
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {editingRule && categories && (
          <RuleModal
            rule={editingRule === "new" ? null : editingRule}
            categories={categories}
            onClose={() => setEditingRule(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
