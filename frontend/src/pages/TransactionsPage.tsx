import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronLeft, ChevronRight, X, Plus, Tag, Sparkles, Filter, Trash2, Check } from "lucide-react";
import { useTransactions, useCategories, useRules, useUpdateTransaction, useCreateRule, useApplyRules } from "../lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { formatCHF } from "../lib/utils";
import { api } from "../lib/api";
import type { Category, MappingRule, Transaction } from "../lib/types";

function CategoryPicker({
  categories,
  currentId,
  onSelect,
  onClose,
}: {
  categories: Category[];
  currentId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const flat: { id: number; name: string; group: string }[] = [];
  for (const g of categories) {
    for (const c of g.children) {
      flat.push({ id: c.id, name: c.name, group: g.name });
    }
  }
  const filtered = search
    ? flat.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.group.toLowerCase().includes(search.toLowerCase()))
    : flat;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-sand-200 bg-white shadow-xl"
    >
      <div className="border-b border-sand-100 p-2">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer..."
          className="w-full rounded-lg bg-sand-50 px-3 py-1.5 text-[12px] text-sand-700 placeholder:text-sand-300 focus:outline-none"
        />
      </div>
      <div className="max-h-60 overflow-y-auto p-1">
        {currentId && (
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-ember-600 hover:bg-ember-50"
          >
            <X className="h-3 w-3" />
            Retirer la catégorie
          </button>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => { onSelect(c.id); onClose(); }}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] transition-colors hover:bg-sand-50 ${
              c.id === currentId ? "bg-forest-50 text-forest-700" : "text-sand-700"
            }`}
          >
            <span>{c.name}</span>
            <span className="text-[10px] text-sand-400">{c.group}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-[11px] text-sand-300">Aucun résultat</p>
        )}
      </div>
    </motion.div>
  );
}

// ───── Transaction Modal (edit + create) ─────

function TransactionModal({
  transaction,
  categories,
  onClose,
  onSplit,
}: {
  transaction: Transaction | null; // null = create
  categories: Category[];
  onClose: () => void;
  onSplit?: (tx: Transaction) => void;
}) {
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [merchantName, setMerchantName] = useState(transaction?.merchant_name ?? "");
  const [amount, setAmount] = useState(transaction?.amount ?? "0");
  const [categoryId, setCategoryId] = useState<string>(transaction?.category_id ? String(transaction.category_id) : "");
  const [note, setNote] = useState(transaction?.note ?? "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const flatCats: { id: number; name: string; group: string }[] = [];
  for (const g of categories) {
    for (const c of g.children) {
      flatCats.push({ id: c.id, name: c.name, group: g.name });
    }
  }

  const handleSave = async () => {
    setSaving(true);
    if (transaction) {
      await api.patch(`/transactions/${transaction.id}`, {
        date,
        description,
        merchant_name: merchantName || null,
        amount: parseFloat(String(amount)),
        category_id: categoryId ? Number(categoryId) : null,
        note: note || null,
      });
    } else {
      await api.post("/transactions", {
        date,
        description,
        merchant_name: merchantName || null,
        amount: parseFloat(String(amount)),
        category_id: categoryId ? Number(categoryId) : null,
        note: note || null,
      });
    }
    qc.invalidateQueries({ queryKey: ["transactions"] });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!transaction) return;
    await api.delete(`/transactions/${transaction.id}`);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    onClose();
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
            {transaction ? "Modifier la transaction" : "Nouvelle transaction"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Montant (CHF)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] tabular-nums text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none" />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Marchand</label>
            <input type="text" value={merchantName} onChange={(e) => setMerchantName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none" />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Catégorie</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none">
              <option value="">Aucune</option>
              {flatCats.map((c) => <option key={c.id} value={c.id}>{c.group} › {c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionnel"
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:bg-white focus:outline-none" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {transaction ? (
            <div className="flex gap-2">
              {onSplit && (
                <button onClick={() => { onSplit(transaction); onClose(); }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-dusk-600 transition-colors hover:bg-dusk-50">
                  Splitter
                </button>
              )}
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-ember-600 transition-colors hover:bg-ember-50">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            </div>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] font-medium text-sand-500 hover:bg-sand-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={!description.trim() || saving}
              className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />
              {saving ? "..." : transaction ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ───── Split Modal ─────

function SplitModal({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  const parentAmount = Math.abs(parseFloat(transaction.amount));
  const [lines, setLines] = useState([
    { category_id: "", amount: "", note: "" },
    { category_id: "", amount: "", note: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveAsRule, setSaveAsRule] = useState(false);
  const qc = useQueryClient();

  const flatCats: { id: number; name: string; group: string }[] = [];
  for (const g of categories) {
    for (const c of g.children) {
      flatCats.push({ id: c.id, name: c.name, group: g.name });
    }
  }

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const diff = total - parentAmount;
  const isBalanced = Math.abs(diff) <= 0.02;
  const allValid = lines.every((l) => l.category_id && parseFloat(l.amount) > 0);

  const addLine = () => setLines([...lines, { category_id: "", amount: "", note: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));
  const updateLine = (i: number, field: string, value: string) =>
    setLines(lines.map((l, j) => j === i ? { ...l, [field]: value } : l));

  const handleSplit = async () => {
    if (!isBalanced || !allValid) return;
    setSaving(true);
    const splitLines = lines.map((l) => ({
      category_id: Number(l.category_id),
      amount: parseFloat(l.amount),
      note: l.note || null,
    }));
    await api.post(`/transactions/${transaction.id}/split`, splitLines);

    if (saveAsRule) {
      await api.post("/split-rules", {
        pattern: transaction.merchant_name || transaction.description.split(" ").slice(0, 3).join(" "),
        min_amount: parentAmount - 1,
        max_amount: parentAmount + 1,
        splits: splitLines,
      });
    }

    qc.invalidateQueries({ queryKey: ["transactions"] });
    setSaving(false);
    onClose();
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
        className="w-full max-w-lg rounded-2xl border border-sand-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-sand-800">Splitter la transaction</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 rounded-xl bg-sand-50 px-4 py-3">
          <p className="text-[12px] text-sand-500">{transaction.merchant_name || transaction.description.slice(0, 40)}</p>
          <p className="text-[16px] font-semibold text-sand-800">{formatCHF(parentAmount)}</p>
        </div>

        {/* Lines */}
        <div className="mt-4 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={line.category_id} onChange={(e) => updateLine(i, "category_id", e.target.value)}
                className="flex-1 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-2 text-[12px] text-sand-700 focus:border-sand-400 focus:outline-none">
                <option value="">Catégorie...</option>
                {flatCats.map((c) => <option key={c.id} value={c.id}>{c.group} › {c.name}</option>)}
              </select>
              <input type="number" step="0.01" value={line.amount} onChange={(e) => updateLine(i, "amount", e.target.value)}
                placeholder="Montant" className="w-24 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-2 text-right text-[12px] tabular-nums text-sand-700 focus:border-sand-400 focus:outline-none" />
              <input type="text" value={line.note} onChange={(e) => updateLine(i, "note", e.target.value)}
                placeholder="Note" className="w-28 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-2 text-[12px] text-sand-700 focus:border-sand-400 focus:outline-none" />
              {lines.length > 2 && (
                <button onClick={() => removeLine(i)} className="rounded p-1 text-sand-300 hover:text-ember-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addLine} className="mt-2 flex items-center gap-1 text-[11px] font-medium text-forest-600 hover:text-forest-700">
          <Plus className="h-3 w-3" /> Ajouter une ligne
        </button>

        {/* Summary */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-sand-50 px-4 py-2.5">
          <span className="text-[12px] text-sand-500">Total : <span className={`font-semibold ${isBalanced ? "text-forest-600" : "text-ember-600"}`}>{formatCHF(total)}</span></span>
          <span className={`text-[12px] font-semibold ${isBalanced ? "text-forest-600" : "text-ember-600"}`}>
            {isBalanced ? "Équilibré" : `Diff: ${diff > 0 ? "+" : ""}${formatCHF(diff)}`}
          </span>
        </div>

        {/* Save as rule */}
        <label className="mt-3 flex items-center gap-2 text-[12px] text-sand-600">
          <input type="checkbox" checked={saveAsRule} onChange={(e) => setSaveAsRule(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-sand-300 accent-forest-600" />
          Sauvegarder comme règle de split automatique
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] font-medium text-sand-500 hover:bg-sand-50">Annuler</button>
          <button onClick={handleSplit} disabled={!isBalanced || !allValid || saving}
            className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" />
            {saving ? "..." : "Splitter"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(searchParams.get("month") || "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get("category") || "");
  const [editingTx, setEditingTx] = useState<number | null>(null);
  const [modalTx, setModalTx] = useState<Transaction | null | "new">(null);
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [ruleProposal, setRuleProposal] = useState<{
    txId: number;
    pattern: string;
    categoryId: number;
    categoryName: string;
  } | null>(null);

  const params: Record<string, string | number | boolean> = { search, page, page_size: 50 };
  if (month) params.month = month;
  if (categoryFilter === "uncategorized") {
    params.uncategorized = true;
  } else if (categoryFilter) {
    params.category_id = categoryFilter;
  }
  const { data, isLoading } = useTransactions(params);
  const { data: categories } = useCategories();
  const { data: rules } = useRules();
  const updateTx = useUpdateTransaction();
  const createRule = useCreateRule();
  const applyRules = useApplyRules();

  const hasMatchingRule = (merchantName: string | null, description: string, existingRules: MappingRule[]) => {
    const text = ((merchantName || "") + " " + description).toLowerCase();
    return existingRules.some((r) => text.includes(r.pattern.toLowerCase()));
  };

  const getCategoryName = (categoryId: number): string => {
    if (!categories) return "";
    for (const g of categories) {
      for (const c of g.children) {
        if (c.id === categoryId) return c.name;
      }
    }
    return "";
  };

  const handleCategorySelect = (txId: number, categoryId: number | null) => {
    // Capture transaction info BEFORE mutation (it may disappear from filtered list after refetch)
    const tx = data?.items.find((t) => t.id === txId);

    updateTx.mutate({ id: txId, category_id: categoryId });
    setEditingTx(null);

    if (!categoryId || !rules || !tx) {
      setRuleProposal(null);
      return;
    }

    if (!hasMatchingRule(tx.merchant_name, tx.description, rules)) {
      const pattern = tx.merchant_name || tx.description.split(" ").slice(0, 3).join(" ");
      setRuleProposal({
        txId,
        pattern,
        categoryId,
        categoryName: getCategoryName(categoryId),
      });
    } else {
      setRuleProposal(null);
    }
  };

  const handleCreateRule = () => {
    if (!ruleProposal) return;
    createRule.mutate(
      { pattern: ruleProposal.pattern, category_id: ruleProposal.categoryId },
      { onSuccess: () => setRuleProposal(null) },
    );
  };

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Historique</p>
          <h1 className="mt-1 font-display text-3xl text-sand-900">Transactions</h1>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <p className="text-[13px] text-sand-400">
              <span className="font-semibold text-sand-600">{data.total}</span> transactions
            </p>
          )}
          <button
            onClick={() => setModalTx("new")}
            className="flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-sand-600 transition-colors hover:bg-sand-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Transaction
          </button>
          <button
            onClick={() => applyRules.mutate()}
            disabled={applyRules.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-forest-700 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {applyRules.isPending ? "En cours..." : "Catégoriser"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-3">
        <select
          value={month}
          onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="rounded-xl border border-sand-200 bg-white px-3.5 py-2 text-[13px] text-sand-700 shadow-sm transition-colors focus:border-sand-400 focus:outline-none"
        >
          <option value="">Tous les mois</option>
          {/* Generate last 12 months */}
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
            return <option key={val} value={val}>{label}</option>;
          })}
        </select>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sand-300 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border border-sand-200 bg-white py-2 pl-9 pr-8 text-[13px] text-sand-700 shadow-sm transition-colors focus:border-sand-400 focus:outline-none"
          >
            <option value="">Toutes les catégories</option>
            <option value="uncategorized">Non classé</option>
            {categories?.map((g) =>
              g.children.map((c) => (
                <option key={c.id} value={c.id}>{g.name} › {c.name}</option>
              ))
            )}
          </select>
        </div>
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
      {/* Rule proposal banner — above table, always visible */}
      <AnimatePresence>
        {ruleProposal && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-0 z-40 mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-dusk-50 border border-dusk-200 px-4 py-3 shadow-md"
          >
            <Tag className="h-3.5 w-3.5 text-dusk-400" />
            <span className="text-[12px] text-dusk-600">Créer une règle ?</span>
            <input
              type="text"
              value={ruleProposal.pattern}
              onChange={(e) => setRuleProposal({ ...ruleProposal, pattern: e.target.value })}
              className="rounded-lg border border-dusk-200 bg-white px-3 py-1 text-[12px] font-mono text-sand-700 focus:border-dusk-400 focus:outline-none"
            />
            <span className="text-[11px] text-dusk-400">→</span>
            <span className="rounded-lg bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
              {ruleProposal.categoryName}
            </span>
            <button
              onClick={handleCreateRule}
              disabled={!ruleProposal.pattern.trim() || createRule.isPending}
              className="flex items-center gap-1 rounded-lg bg-dusk-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-dusk-700 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Créer
            </button>
            <button
              onClick={() => setRuleProposal(null)}
              className="rounded-lg px-2 py-1 text-[11px] text-dusk-400 hover:bg-dusk-100 hover:text-dusk-600"
            >
              Ignorer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-4 rounded-2xl border border-sand-200/60 bg-white shadow-sm"
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
                    <td className="whitespace-nowrap px-5 py-3 text-sand-400 tabular-nums cursor-pointer hover:text-sand-600" onClick={() => setModalTx(tx)}>{tx.date}</td>
                    <td className="px-5 py-3 cursor-pointer" onClick={() => setModalTx(tx)}>
                      <div className="font-medium text-sand-800">
                        {tx.merchant_name || tx.description.slice(0, 45)}
                      </div>
                      {tx.merchant_name && (
                        <div className="mt-0.5 max-w-xs truncate text-[11px] text-sand-300">
                          {tx.description.slice(0, 70)}
                        </div>
                      )}
                    </td>
                    <td className="relative px-5 py-3">
                      <button
                        onClick={() => setEditingTx(editingTx === tx.id ? null : tx.id)}
                        className="transition-colors"
                      >
                        {tx.category_name ? (
                          <span className="inline-flex rounded-lg bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700 hover:bg-forest-100">
                            {tx.category_name}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-lg bg-sand-100 px-2.5 py-1 text-[11px] text-sand-400 hover:bg-sand-200">
                            Non classé
                          </span>
                        )}
                      </button>
                      <AnimatePresence>
                        {editingTx === tx.id && categories && (
                          <CategoryPicker
                            categories={categories}
                            currentId={tx.category_id}
                            onSelect={(catId) => handleCategorySelect(tx.id, catId)}
                            onClose={() => setEditingTx(null)}
                          />
                        )}
                      </AnimatePresence>
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

      {/* Transaction modal */}
      <AnimatePresence>
        {modalTx && categories && (
          <TransactionModal
            transaction={modalTx === "new" ? null : modalTx}
            categories={categories}
            onClose={() => setModalTx(null)}
            onSplit={(tx) => { setModalTx(null); setSplitTx(tx); }}
          />
        )}
      </AnimatePresence>

      {/* Split modal */}
      <AnimatePresence>
        {splitTx && categories && (
          <SplitModal
            transaction={splitTx}
            categories={categories}
            onClose={() => setSplitTx(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
