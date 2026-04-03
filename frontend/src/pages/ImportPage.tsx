import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileUp, Check, AlertCircle, Sparkles, Upload, FileText, LinkIcon } from "lucide-react";
import { useUploadImport, useApplyRules } from "../lib/hooks";
import { api } from "../lib/api";
import { formatCHF } from "../lib/utils";
import type { ImportResponse } from "../lib/types";

type CcLine = { id: number; date: string; description: string; merchant_name: string; amount: string };

// ───── Reconciliation Detail (line-by-line) ─────

function ReconciliationDetail({
  batchId,
  paymentLineId,
  paymentAmount,
  ccLines,
  onReconciled,
}: {
  batchId: number;
  paymentLineId: number;
  paymentAmount: number;
  ccLines: CcLine[];
  onReconciled: () => void;
}) {
  const [lines, setLines] = useState(
    ccLines.map((l) => ({ ...l, checked: true, editedAmount: Math.abs(parseFloat(l.amount)) }))
  );
  const [saving, setSaving] = useState(false);

  const checkedTotal = lines.filter((l) => l.checked).reduce((s, l) => s + l.editedAmount, 0);
  const diff = checkedTotal - paymentAmount;
  const isBalanced = Math.abs(diff) <= 1;

  const toggleAll = (checked: boolean) => setLines((prev) => prev.map((l) => ({ ...l, checked })));

  const handleValidate = async () => {
    setSaving(true);
    const included = lines.filter((l) => l.checked).map((l) => ({ id: l.id, amount: l.editedAmount }));
    const excluded = lines.filter((l) => !l.checked).map((l) => l.id);
    await api.post(`/import/batches/${batchId}/reconcile-detail`, { payment_line_id: paymentLineId, included, excluded });
    setSaving(false);
    onReconciled();
  };

  return (
    <div className="rounded-2xl border border-dusk-200 bg-white p-5 shadow-sm">
      <h3 className="text-[13px] font-semibold text-sand-800">
        <LinkIcon className="mr-1.5 inline h-4 w-4 text-dusk-500" />
        Rapprochement ligne par ligne
      </h3>

      {/* Summary bar */}
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-sand-50 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase text-sand-400">Paiement</p>
          <p className="text-[14px] font-semibold text-sand-800">{formatCHF(paymentAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-sand-400">Sélectionné</p>
          <p className={`text-[14px] font-semibold ${isBalanced ? "text-forest-600" : "text-ember-600"}`}>{formatCHF(checkedTotal)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-sand-400">Différence</p>
          <p className={`text-[14px] font-semibold ${isBalanced ? "text-forest-600" : "text-ember-600"}`}>
            {diff > 0 ? "+" : ""}{formatCHF(diff)}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2 text-[11px]">
          <button onClick={() => toggleAll(true)} className="rounded-lg px-2 py-1 text-sand-500 hover:bg-sand-100">Tout cocher</button>
          <button onClick={() => toggleAll(false)} className="rounded-lg px-2 py-1 text-sand-500 hover:bg-sand-100">Tout décocher</button>
        </div>
      </div>

      {/* Lines */}
      <div className="mt-3 max-h-80 overflow-y-auto space-y-1">
        {lines.map((line, i) => (
          <div key={line.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${line.checked ? "bg-white" : "bg-sand-50 opacity-60"}`}>
            <input
              type="checkbox"
              checked={line.checked}
              onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, checked: e.target.checked } : l))}
              className="h-4 w-4 rounded border-sand-300 text-forest-600 accent-forest-600"
            />
            <span className="text-[11px] tabular-nums text-sand-400 w-20 shrink-0">{line.date}</span>
            <span className="flex-1 min-w-0 text-[12px] text-sand-700 truncate">{line.merchant_name || line.description}</span>
            <input
              type="number"
              step="0.01"
              value={line.editedAmount}
              onChange={(e) => setLines((prev) => prev.map((l, j) => j === i ? { ...l, editedAmount: parseFloat(e.target.value) || 0 } : l))}
              disabled={!line.checked}
              className="w-24 rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 text-right text-[12px] tabular-nums text-sand-700 disabled:opacity-40 focus:border-sand-400 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {/* Validate */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-sand-400">
          {lines.filter((l) => l.checked).length}/{lines.length} lignes sélectionnées
        </p>
        <button
          onClick={handleValidate}
          disabled={!isBalanced || saving}
          className="flex items-center gap-2 rounded-xl bg-forest-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md hover:bg-forest-700 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          {saving ? "Validation..." : "Valider le rapprochement"}
        </button>
      </div>
    </div>
  );
}

// ───── Reconciliation Picker ─────

function ReconciliationPicker({
  batchId,
  ccTotal,
  candidates,
  onReconciled,
}: {
  batchId: number;
  ccTotal: string;
  candidates: CcLine[];
  onReconciled: () => void;
}) {
  const [detailData, setDetailData] = useState<{ paymentLineId: number; paymentAmount: number; ccLines: CcLine[] } | null>(null);
  const [linking, setLinking] = useState(false);

  const handleSelect = async (txId: number, _txAmount: string) => {
    setLinking(true);
    const formData = new FormData();
    formData.append("payment_line_id", String(txId));
    const res = await api.post(`/import/batches/${batchId}/reconcile-manual`, formData);
    setLinking(false);

    if (res.data.status === "need_detail") {
      setDetailData({
        paymentLineId: res.data.payment_line_id,
        paymentAmount: parseFloat(res.data.payment_amount),
        ccLines: res.data.cc_lines,
      });
    } else {
      onReconciled();
    }
  };

  if (detailData) {
    return (
      <ReconciliationDetail
        batchId={batchId}
        paymentLineId={detailData.paymentLineId}
        paymentAmount={detailData.paymentAmount}
        ccLines={detailData.ccLines}
        onReconciled={onReconciled}
      />
    );
  }

  return (
    <div className="rounded-xl border border-dusk-200 bg-dusk-50/30 p-4">
      <p className="text-[12px] font-semibold text-dusk-700">
        <LinkIcon className="mr-1.5 inline h-3.5 w-3.5" />
        Aucune transaction de {formatCHF(ccTotal)} trouvée. Choisissez la ligne bancaire correspondante :
      </p>
      <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
        {candidates.length > 0 ? candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c.id, c.amount)}
            disabled={linking}
            className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:shadow-md hover:border-dusk-300 border border-sand-200/60 disabled:opacity-50"
          >
            <span className="text-[11px] tabular-nums text-sand-400 shrink-0">{c.date}</span>
            <span className="flex-1 min-w-0 text-[12px] text-sand-700 truncate">{c.merchant_name || c.description}</span>
            <span className="text-[12px] font-semibold tabular-nums text-sand-800">{formatCHF(c.amount)}</span>
          </button>
        )) : (
          <p className="text-[11px] text-sand-400 py-2">Aucun candidat trouvé</p>
        )}
      </div>
    </div>
  );
}

const ACCOUNT_TYPES = [
  { value: "salary", label: "Compte salaire", desc: "Transactions courantes, salaire, dépenses" },
  { value: "bills", label: "Compte factures", desc: "Factures annuelles — ne compte pas dans les dépenses, met à jour les enveloppes" },
  { value: "credit_card", label: "Carte de crédit", desc: "Relevé Viseca PDF" },
];

export function ImportPage() {
  const [accountType, setAccountType] = useState("salary");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadImport();
  const applyRules = useApplyRules();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".xml") || f.name.endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...dropped]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleUpload = () => {
    if (files.length === 0) return;
    const formData = new FormData();
    formData.append("account_type", accountType);
    files.forEach((f) => formData.append("files", f));
    upload.mutate(formData, { onSuccess: (data) => setResult(data) });
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Importer</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Import des relevés</h1>
      <p className="mt-2 text-[13px] text-sand-500">
        Déposez vos fichiers camt.053 (XML) et Viseca (PDF) pour importer les transactions du mois.
      </p>

      <div className="mt-6 space-y-5">

        {/* Account type */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Type de compte</label>
          <div className="mt-1.5 flex gap-2">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setAccountType(t.value)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  accountType === t.value
                    ? "border-forest-400 bg-forest-50 shadow-sm"
                    : "border-sand-200 bg-white hover:border-sand-300"
                }`}
              >
                <p className={`text-[12px] font-semibold ${accountType === t.value ? "text-forest-700" : "text-sand-700"}`}>
                  {t.label}
                </p>
                <p className="mt-0.5 text-[10px] text-sand-400">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-sand-200 bg-white p-10 text-center transition-colors hover:border-forest-300 hover:bg-forest-50/20"
        >
          <input ref={fileInputRef} type="file" multiple accept=".xml,.pdf" onChange={handleFileSelect} className="hidden" />
          <Upload className="mx-auto h-8 w-8 text-sand-300" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] font-medium text-sand-600">
            Glissez vos fichiers ici ou cliquez pour parcourir
          </p>
          <p className="mt-1 text-[11px] text-sand-300">XML (camt.053) et PDF (Viseca) acceptés</p>
        </div>

        {/* File list */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              {files.map((f, i) => (
                <motion.div
                  key={f.name + i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-sand-200/60 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-sand-400" />
                    <div>
                      <p className="text-[13px] font-medium text-sand-700">{f.name}</p>
                      <p className="text-[11px] text-sand-300">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-[11px] font-medium text-sand-400 hover:text-ember-500">
                    Retirer
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload button */}
        {files.length > 0 && !result && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleUpload}
            disabled={upload.isPending}
            className="flex items-center gap-2.5 rounded-xl bg-sand-900 px-6 py-3 text-[13px] font-semibold text-sand-50 shadow-lg shadow-sand-900/20 transition-all hover:bg-sand-800 disabled:opacity-60"
          >
            <FileUp className="h-4 w-4" />
            {upload.isPending ? "Import en cours..." : `Importer ${files.length} fichier${files.length > 1 ? "s" : ""}`}
          </motion.button>
        )}

        {/* Error */}
        {upload.isError && (
          <div className="flex items-center gap-3 rounded-xl border border-ember-200 bg-ember-50 p-4 text-[13px] text-ember-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {String((upload.error as Error)?.message || "Erreur lors de l'import")}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-2xl border border-sand-200/60 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-forest-100 p-2">
                  <Check className="h-5 w-5 text-forest-600" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-sand-800">Import réussi</p>
                  <p className="text-[12px] text-sand-400">
                    {result.transactions_created} transactions créées pour {result.month}
                  </p>
                </div>
              </div>

              {result.reconciliation && (result.reconciliation as Record<string, unknown>).status === "reconciled" && (
                <div className="rounded-xl bg-dusk-50 p-3.5 text-[12px] text-dusk-700">
                  <span className="font-semibold">Réconciliation CC :</span>{" "}
                  {String((result.reconciliation as Record<string, unknown>).cc_transactions)} transactions liées à la facture Viseca
                </div>
              )}

              {result.reconciliation && (result.reconciliation as Record<string, unknown>).status === "no_match" && (
                <ReconciliationPicker
                  batchId={result.batch_id}
                  ccTotal={String((result.reconciliation as Record<string, unknown>).cc_total)}
                  candidates={(result.reconciliation as Record<string, unknown>).candidates as { id: number; date: string; description: string; merchant_name: string; amount: string }[]}
                  onReconciled={() => setResult({ ...result, reconciliation: { status: "reconciled", cc_transactions: (result.reconciliation as Record<string, unknown>).cc_transactions } })}
                />
              )}

              <button
                onClick={() => applyRules.mutate()}
                disabled={applyRules.isPending}
                className="flex items-center gap-2.5 rounded-xl bg-forest-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-forest-600/20 transition-all hover:bg-forest-700 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {applyRules.isPending ? "Catégorisation en cours..." : "Appliquer les règles de catégorisation"}
              </button>

              {applyRules.isSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl bg-forest-50 p-3.5 text-[12px] text-forest-700"
                >
                  <span className="font-semibold">{(applyRules.data as Record<string, number>).categorized}</span> transactions catégorisées,{" "}
                  <span className="font-semibold">{(applyRules.data as Record<string, number>).remaining}</span> restantes
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
