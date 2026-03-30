import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, Plus, Trash2, Tag, X } from "lucide-react";
import {
  useCategories,
  useRules,
  useCreateCategory,
  useDeleteCategory,
  useCreateRule,
  useDeleteRule,
} from "../lib/hooks";
import type { Category } from "../lib/types";

// ───── Add Category Form ─────

function AddCategoryForm({
  parentId,
  onClose,
}: {
  parentId: number | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const create = useCreateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), parent_id: parentId }, { onSuccess: () => { setName(""); onClose(); } });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={parentId ? "Nouvelle sous-catégorie..." : "Nouveau groupe..."}
        className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[12px] text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:outline-none"
      />
      <button type="submit" disabled={!name.trim() || create.isPending} className="rounded-lg bg-forest-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
        Ajouter
      </button>
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100 hover:text-sand-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

// ───── Category Group ─────

function CategoryGroup({ group }: { group: Category }) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const deleteCategory = useDeleteCategory();

  return (
    <li>
      <div className="group flex items-center gap-1">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2.5 rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-sand-100"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 text-sand-400" /> : <ChevronRight className="h-3.5 w-3.5 text-sand-400" />}
          <span className="text-[13px] font-semibold text-sand-800">{group.name}</span>
          <span className="rounded-md bg-sand-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
            {group.children.length}
          </span>
        </button>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg p-1.5 text-sand-300 opacity-0 transition-all hover:bg-sand-100 hover:text-forest-600 group-hover:opacity-100"
          title="Ajouter une sous-catégorie"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {group.children.length === 0 && (
          <button
            onClick={() => deleteCategory.mutate(group.id)}
            className="rounded-lg p-1.5 text-sand-300 opacity-0 transition-all hover:bg-ember-50 hover:text-ember-600 group-hover:opacity-100"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (group.children.length > 0 || adding) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-5 overflow-hidden border-l-2 border-sand-100 pl-4"
          >
            <ul className="space-y-0.5">
              {group.children.map((cat) => (
                <li
                  key={cat.id}
                  className="group/item flex items-center gap-2 rounded-lg py-1.5 pr-1 text-[12px] text-sand-600"
                >
                  <span className="h-1 w-1 rounded-full bg-sand-300" />
                  <span className="flex-1">{cat.name}</span>
                  {cat.month_shift_days != null && (
                    <span className="rounded-md bg-dusk-100 px-1.5 py-0.5 text-[10px] font-semibold text-dusk-600">
                      J+{cat.month_shift_days}
                    </span>
                  )}
                  <button
                    onClick={() => deleteCategory.mutate(cat.id)}
                    className="rounded-lg p-1 text-sand-300 opacity-0 transition-all hover:bg-ember-50 hover:text-ember-600 group-hover/item:opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
            {adding && <AddCategoryForm parentId={group.id} onClose={() => setAdding(false)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// ───── Add Rule Form ─────

function AddRuleForm({
  categories,
  onClose,
}: {
  categories: Category[];
  onClose: () => void;
}) {
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [direction, setDirection] = useState("");
  const createRule = useCreateRule();

  const flatCats: { id: number; name: string; group: string }[] = [];
  for (const group of categories) {
    for (const cat of group.children) {
      flatCats.push({ id: cat.id, name: cat.name, group: group.name });
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim() || !categoryId) return;
    createRule.mutate(
      {
        pattern: pattern.trim(),
        category_id: Number(categoryId),
        min_amount: minAmount ? parseFloat(minAmount) : null,
        max_amount: maxAmount ? parseFloat(maxAmount) : null,
        direction: direction || null,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="mb-4 rounded-xl border border-sand-200 bg-sand-50 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-sand-700">Nouvelle règle</p>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-sand-400 hover:bg-sand-200 hover:text-sand-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          autoFocus
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Texte à chercher (ex: Coop, Crédit...)"
          className="flex-1 rounded-lg border border-sand-200 bg-white px-3 py-2 text-[12px] font-mono text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:outline-none"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
          className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-[12px] text-sand-700 focus:border-sand-400 focus:outline-none"
        >
          <option value="">Catégorie...</option>
          {flatCats.map((c) => (
            <option key={c.id} value={c.id}>{c.group} › {c.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-[12px] text-sand-700 focus:border-sand-400 focus:outline-none"
        >
          <option value="">Toutes directions</option>
          <option value="expense">Dépenses uniquement</option>
          <option value="income">Revenus uniquement</option>
        </select>
        <input
          type="number"
          step="0.01"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Montant min"
          className="w-28 rounded-lg border border-sand-200 bg-white px-3 py-2 text-[12px] tabular-nums text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:outline-none"
        />
        <input
          type="number"
          step="0.01"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Montant max"
          className="w-28 rounded-lg border border-sand-200 bg-white px-3 py-2 text-[12px] tabular-nums text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!pattern.trim() || !categoryId || createRule.isPending}
        className="rounded-lg bg-forest-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
      >
        Créer la règle
      </button>
    </motion.form>
  );
}

// ───── Page ─────

export function CategoriesPage() {
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: rules, isLoading: rulesLoading } = useRules();
  const [addingGroup, setAddingGroup] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const deleteRule = useDeleteRule();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Configuration</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Catégories & Règles</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Categories tree */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Arbre des catégories</h2>
              {categories && (
                <span className="rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
                  {categories.reduce((sum, g) => sum + g.children.length, 0)}
                </span>
              )}
            </div>
            <button
              onClick={() => setAddingGroup(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-forest-600 transition-colors hover:bg-forest-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Groupe
            </button>
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
              {addingGroup && <li><AddCategoryForm parentId={null} onClose={() => setAddingGroup(false)} /></li>}
            </ul>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex h-24 items-center justify-center text-[13px] text-sand-300">
                Lancez la migration Actual Budget dans Paramètres
              </div>
              {addingGroup && <AddCategoryForm parentId={null} onClose={() => setAddingGroup(false)} />}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Règles de mapping</h2>
              {rules && (
                <span className="rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sand-500">
                  {rules.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setAddingRule(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-forest-600 transition-colors hover:bg-forest-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Règle
            </button>
          </div>

          {rulesLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <AnimatePresence>
                {addingRule && categories && (
                  <AddRuleForm categories={categories} onClose={() => setAddingRule(false)} />
                )}
              </AnimatePresence>

              {rules && rules.length > 0 ? (
                rules.map((r) => (
                  <div
                    key={r.id}
                    className="group flex items-start gap-3 rounded-xl bg-sand-50 px-4 py-3"
                  >
                    <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sand-300" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-[13px] font-semibold text-sand-800">{r.pattern}</code>
                        <span className="text-[11px] text-sand-300">→</span>
                        <span className="rounded-lg bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
                          {r.category_name}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-sand-400">
                        {r.direction && (
                          <span className="rounded bg-dusk-50 px-1.5 py-0.5 text-dusk-600 font-semibold">
                            {r.direction === "income" ? "Revenus" : "Dépenses"}
                          </span>
                        )}
                        {r.min_amount && (
                          <span>min : <span className="text-sand-500 tabular-nums">{r.min_amount} CHF</span></span>
                        )}
                        {r.max_amount && (
                          <span>max : <span className="text-sand-500 tabular-nums">{r.max_amount} CHF</span></span>
                        )}
                        <span className="text-sand-300">{r.source}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteRule.mutate(r.id)}
                      className="rounded-lg p-1.5 text-sand-300 opacity-0 transition-all hover:bg-ember-50 hover:text-ember-600 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex h-24 items-center justify-center text-[13px] text-sand-300">
                  Aucune règle configurée
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
