import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileUp, Check, AlertCircle, Sparkles, Upload, FileText } from "lucide-react";
import { useUploadImport, useApplyRules } from "../lib/hooks";
import { currentMonth } from "../lib/utils";
import type { ImportResponse } from "../lib/types";

export function ImportPage() {
  const [month, setMonth] = useState(currentMonth());
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
    formData.append("month", month);
    files.forEach((f) => formData.append("files", f));
    upload.mutate(formData, { onSuccess: (data) => setResult(data) });
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sand-400">Importer</p>
      <h1 className="mt-1 font-display text-3xl text-sand-900">Import des releves</h1>
      <p className="mt-2 text-[13px] text-sand-500">
        Deposez vos fichiers camt.053 (XML) et Viseca (PDF) pour importer les transactions du mois.
      </p>

      <div className="mt-6 space-y-5">
        {/* Month selector */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sand-400">Mois cible</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1.5 block w-full max-w-xs rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-[13px] text-sand-700 shadow-sm focus:border-sand-400 focus:outline-none"
          />
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
          <p className="mt-1 text-[11px] text-sand-300">XML (camt.053) et PDF (Viseca) acceptes</p>
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
                  <p className="text-[14px] font-semibold text-sand-800">Import reussi</p>
                  <p className="text-[12px] text-sand-400">
                    {result.transactions_created} transactions creees pour {result.month}
                  </p>
                </div>
              </div>

              {result.reconciliation && (
                <div className="rounded-xl bg-dusk-50 p-3.5 text-[12px] text-dusk-700">
                  <span className="font-semibold">Reconciliation CC :</span>{" "}
                  {String((result.reconciliation as Record<string, unknown>).cc_transactions)} transactions liees a la facture Viseca
                </div>
              )}

              <button
                onClick={() => applyRules.mutate()}
                disabled={applyRules.isPending}
                className="flex items-center gap-2.5 rounded-xl bg-forest-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-forest-600/20 transition-all hover:bg-forest-700 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {applyRules.isPending ? "Categorisation en cours..." : "Appliquer les regles de categorisation"}
              </button>

              {applyRules.isSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl bg-forest-50 p-3.5 text-[12px] text-forest-700"
                >
                  <span className="font-semibold">{(applyRules.data as Record<string, number>).categorized}</span> transactions categorisees,{" "}
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
