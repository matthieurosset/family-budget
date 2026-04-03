import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Tag, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useEnvelopes, useCategories } from "../lib/hooks";
import { formatCHF } from "../lib/utils";
import { api } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { Category, Envelope } from "../lib/types";

// ───── Envelope Form (create + edit) ─────

function EnvelopeForm({
  envelope,
  categories,
  onClose,
}: {
  envelope: Envelope | null; // null = create mode
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(envelope?.name ?? "");
  const [monthly, setMonthly] = useState(envelope?.monthly_amount ?? "0");
  const [initialBalance, setInitialBalance] = useState(envelope?.initial_balance ?? "0");
  const [categoryId, setCategoryId] = useState<string>(envelope?.category_id ? String(envelope.category_id) : "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const flatCats: { id: number; name: string; group: string }[] = [];
  for (const g of categories) {
    for (const c of g.children) {
      flatCats.push({ id: c.id, name: c.name, group: g.name });
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const body = {
      name: name.trim(),
      monthly_amount: parseFloat(monthly) || 0,
      initial_balance: parseFloat(initialBalance) || 0,
      category_id: categoryId ? Number(categoryId) : null,
    };
    try {
      if (envelope) {
        await api.put(`/envelopes/${envelope.id}`, body);
      } else {
        await api.post("/envelopes", body);
      }
      qc.invalidateQueries({ queryKey: ["envelopes"] });
      onClose();
    } catch {
      // keep form open
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!envelope) return;
    await api.delete(`/envelopes/${envelope.id}`);
    qc.invalidateQueries({ queryKey: ["envelopes"] });
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
        className="w-full max-w-md rounded-2xl border border-sand-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-sand-800">
            {envelope ? "Modifier l'enveloppe" : "Nouvelle enveloppe"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Nom</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Électricité"
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 placeholder:text-sand-300 focus:border-sand-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Montant mensuel (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 tabular-nums focus:border-sand-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Solde initial (CHF)</label>
            <input
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 tabular-nums focus:border-sand-400 focus:bg-white focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-sand-300">Report de l'année précédente ou montant de départ</p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Catégorie liée</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2.5 text-[13px] text-sand-700 focus:border-sand-400 focus:bg-white focus:outline-none"
            >
              <option value="">Aucune</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>{c.group} › {c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-sand-300">Les dépenses de cette catégorie seront auto-déduites</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {envelope ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-ember-600 transition-colors hover:bg-ember-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-[12px] font-medium text-sand-500 hover:bg-sand-50">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-forest-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "..." : envelope ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ───── Envelope Detail Modal ─────

function EnvelopeDetail({
  envelope,
  onClose,
  onEdit,
}: {
  envelope: Envelope;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [history, setHistory] = useState<{ id: number; type: string; amount: string; date: string; note: string | null; transaction_id: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("expense");
  const [addAmount, setAddAmount] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10));
  const [addNote, setAddNote] = useState("");
  const qc = useQueryClient();

  const loadHistory = () => {
    api.get(`/envelopes/${envelope.id}/history`).then((r) => { setHistory(r.data); setLoading(false); });
  };

  useState(() => { loadHistory(); });

  const handleAdd = async () => {
    if (!addAmount) return;
    await api.post(`/envelopes/${envelope.id}/transactions`, {
      type: addType,
      amount: parseFloat(addAmount),
      date: addDate,
      note: addNote || null,
    });
    setShowAdd(false);
    setAddAmount("");
    setAddNote("");
    setLoading(true);
    loadHistory();
    qc.invalidateQueries({ queryKey: ["envelopes"] });
  };

  const handleDelete = async (txId: number) => {
    await api.delete(`/envelopes/${envelope.id}/transactions/${txId}`);
    setHistory((prev) => prev.filter((h) => h.id !== txId));
    qc.invalidateQueries({ queryKey: ["envelopes"] });
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
        className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-sand-800">{envelope.name}</h2>
            <p className="text-[11px] text-sand-400">{formatCHF(envelope.monthly_amount)} / mois</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-sand-400 hover:bg-sand-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 border-b border-sand-100 px-6 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-sand-400">Provisions</p>
            <p className="text-[14px] font-semibold text-forest-600">{formatCHF(envelope.total_provisions)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-sand-400">Dépenses</p>
            <p className="text-[14px] font-semibold text-ember-600">{formatCHF(envelope.total_expenses)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-sand-400">Solde</p>
            <p className={`text-[14px] font-semibold ${parseFloat(envelope.balance) >= 0 ? "text-forest-600" : "text-ember-600"}`}>
              {formatCHF(envelope.balance)}
            </p>
          </div>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Historique</h3>
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-forest-600 hover:bg-forest-50">
              <Plus className="h-3 w-3" /> Ajouter
            </button>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mb-3 overflow-hidden">
                <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <select value={addType} onChange={(e) => setAddType(e.target.value)}
                      className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-700">
                      <option value="expense">Dépense</option>
                      <option value="provision">Provision</option>
                    </select>
                    <input type="number" step="0.01" value={addAmount} onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="Montant" className="flex-1 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] tabular-nums text-sand-700" />
                    <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)}
                      className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-700" />
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={addNote} onChange={(e) => setAddNote(e.target.value)}
                      placeholder="Note (optionnel)" className="flex-1 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-700" />
                    <button onClick={handleAdd} disabled={!addAmount}
                      className="rounded-lg bg-forest-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
                      OK
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-sand-50">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${h.type === "provision" ? "bg-forest-400" : "bg-ember-400"}`} />
                  <span className="text-[11px] tabular-nums text-sand-400 w-20 shrink-0">{h.date}</span>
                  <span className="flex-1 min-w-0 text-[12px] text-sand-600 truncate">{h.note || (h.type === "provision" ? "Provision" : "Dépense")}</span>
                  <span className={`text-[12px] font-semibold tabular-nums ${h.type === "provision" ? "text-forest-600" : "text-ember-600"}`}>
                    {h.type === "provision" ? "+" : "-"}{formatCHF(h.amount)}
                  </span>
                  <button onClick={() => handleDelete(h.id)}
                    className="rounded p-1 text-sand-300 opacity-0 transition-opacity hover:bg-ember-50 hover:text-ember-600 group-hover:opacity-100">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[12px] text-sand-300 py-8">Aucun mouvement</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ───── Bills Assignment Section ─────

function BillsAssignment({ envelopes }: { envelopes: Envelope[] }) {
  const [bills, setBills] = useState<{ id: number; date: string; description: string; merchant_name: string; amount: string; assigned: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useState(() => {
    api.get("/envelopes/bills-transactions").then((r) => { setBills(r.data); setLoading(false); });
  });

  const unassigned = bills.filter((b) => !b.assigned);
  if (loading || unassigned.length === 0) return null;

  const handleAssign = async (txId: number, envelopeId: number) => {
    const formData = new FormData();
    formData.append("envelope_id", String(envelopeId));
    await api.post(`/envelopes/assign-transaction/${txId}`, formData);
    setBills((prev) => prev.map((b) => b.id === txId ? { ...b, assigned: true } : b));
    qc.invalidateQueries({ queryKey: ["envelopes"] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dusk-200 bg-dusk-50/30 p-5 shadow-sm"
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dusk-500">
        Factures à assigner ({unassigned.length})
      </h2>
      <p className="mt-1 text-[11px] text-sand-400">
        Transactions du compte factures en attente d'assignation à une enveloppe
      </p>
      <div className="mt-4 space-y-2">
        {unassigned.map((bill) => (
          <div key={bill.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
            <span className="text-[12px] tabular-nums text-sand-400">{bill.date}</span>
            <span className="flex-1 min-w-0 text-[13px] font-medium text-sand-800 truncate">
              {bill.merchant_name || bill.description.slice(0, 40)}
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-ember-600">{formatCHF(bill.amount)}</span>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) handleAssign(bill.id, Number(e.target.value)); }}
              className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-[11px] text-sand-700 focus:border-dusk-400 focus:outline-none"
            >
              <option value="">Assigner à...</option>
              {envelopes.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ───── Page ─────

export function EnvelopesPage() {
  const { data: envelopes, isLoading } = useEnvelopes();
  const { data: categories } = useCategories();
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null | "new">(null);
  const [detailEnvelope, setDetailEnvelope] = useState<Envelope | null>(null);

  const totalProvisions = envelopes?.reduce((s, e) => s + parseFloat(e.total_provisions), 0) ?? 0;
  const totalExpenses = envelopes?.reduce((s, e) => s + parseFloat(e.total_expenses), 0) ?? 0;
  const totalBalance = envelopes?.reduce((s, e) => s + parseFloat(e.balance), 0) ?? 0;
  const totalMonthly = envelopes?.reduce((s, e) => s + parseFloat(e.monthly_amount), 0) ?? 0;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Provisions annuelles</p>
          <h1 className="mt-1 font-display text-3xl text-sand-900">Enveloppes</h1>
        </div>
        <button
          onClick={() => setEditingEnvelope("new")}
          className="flex items-center gap-1.5 rounded-lg bg-forest-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-forest-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Enveloppe
        </button>
      </div>


      {/* Totals */}
      {envelopes && envelopes.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Mensuel total", value: totalMonthly, color: "text-dusk-600" },
            { label: "Provisions cumulées", value: totalProvisions, color: "text-forest-600" },
            { label: "Dépenses", value: totalExpenses, color: "text-ember-600" },
            { label: "Solde", value: totalBalance, color: totalBalance >= 0 ? "text-forest-600" : "text-ember-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-sand-200/60 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sand-400">{label}</p>
              <p className={`mt-1 font-display text-xl ${color}`}>{formatCHF(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bills assignment */}
      {envelopes && envelopes.length > 0 && (
        <div className="mt-6">
          <BillsAssignment envelopes={envelopes} />
        </div>
      )}

      {/* Envelope cards */}
      {isLoading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sand-200 border-t-forest-500" />
        </div>
      ) : envelopes && envelopes.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {envelopes.map((env, i) => {
            const balance = parseFloat(env.balance);
            const provisions = parseFloat(env.total_provisions);
            const expenses = parseFloat(env.total_expenses);
            const progress = provisions > 0 ? Math.min((expenses / provisions) * 100, 100) : 0;

            return (
              <motion.div
                key={env.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setDetailEnvelope(env)}
                className="group cursor-pointer rounded-2xl border border-sand-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-sand-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold text-sand-800">{env.name}</h3>
                    <p className="mt-0.5 text-[11px] text-sand-400">
                      {formatCHF(env.monthly_amount)} / mois
                    </p>
                  </div>
                  <Pencil className="h-3.5 w-3.5 text-sand-300 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                {env.category_name && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-sand-300" />
                    <span className="rounded-md bg-forest-50 px-1.5 py-0.5 text-[10px] font-semibold text-forest-700">
                      {env.category_name}
                    </span>
                  </div>
                )}

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sand-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + i * 0.03, ease: "easeOut" }}
                    className={`h-full rounded-full ${progress > 80 ? "bg-ember-400" : "bg-forest-400"}`}
                  />
                </div>

                <div className="mt-4 space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-sand-400">Provisions</span>
                    <span className="font-medium text-forest-600">{formatCHF(env.total_provisions)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-400">Dépenses</span>
                    <span className="font-medium text-ember-600">{formatCHF(env.total_expenses)}</span>
                  </div>
                  <div className="flex justify-between border-t border-sand-100 pt-2">
                    <span className="font-semibold text-sand-700">Solde</span>
                    <span className={`font-display text-lg leading-none ${balance >= 0 ? "text-forest-600" : "text-ember-600"}`}>
                      {formatCHF(env.balance)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-sand-200" strokeWidth={1.2} />
          <p className="mt-3 text-[13px] text-sand-400">Aucune enveloppe configurée</p>
          <p className="mt-1 text-[11px] text-sand-300">Importez votre fichier Excel ou créez-en une</p>
        </motion.div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {detailEnvelope && (
          <EnvelopeDetail
            envelope={detailEnvelope}
            onClose={() => setDetailEnvelope(null)}
            onEdit={() => { setEditingEnvelope(detailEnvelope); setDetailEnvelope(null); }}
          />
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingEnvelope && categories && (
          <EnvelopeForm
            envelope={editingEnvelope === "new" ? null : editingEnvelope}
            categories={categories}
            onClose={() => setEditingEnvelope(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
